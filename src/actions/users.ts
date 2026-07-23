"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { sendInvitationEmail } from "@/lib/email";
import { userSchema } from "@/lib/validations/schemas";
import type { UserRole } from "@/types/database";

export type UserActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Get the app's base URL.
 * Prefers the NEXT_PUBLIC_APP_URL env var (set in production),
 * falls back to reading request headers.
 */
function getBaseUrl(): string {
  // Use explicit env var if available (recommended for production)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  const headersList = headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

// Wrap Supabase's raw verify URL in our /auth/confirm page so email-security
// scanners (Gmail/Outlook/etc.) cannot pre-fetch and burn the one-time token.
// See src/app/auth/confirm/page.tsx for full rationale.
function wrapAuthLink(
  hashedToken: string,
  type: "recovery" | "invite" | "magiclink" | "email" | "email_change",
  next: string
): string {
  const params = new URLSearchParams({
    token_hash: hashedToken,
    type,
    next,
  });
  return `${getBaseUrl()}/auth/confirm?${params.toString()}`;
}
/**
 * Get all collaborators visible to the current user.
 * Includes their partner roles.
 */
export async function getCollaborators(): Promise<UserActionResult> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("users")
    .select(
      `
      id,
      name,
      email,
      user_type,
      is_active,
      created_at,
      user_partner_roles (
        id,
        role,
        partner_id,
        partners (id, name)
      )
    `
    )
    .order("name", { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

/**
 * Get collaborators for a specific partner.
 */
export async function getCollaboratorsByPartner(
  partnerId: string
): Promise<UserActionResult> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("user_partner_roles")
    .select(
      `
      id,
      role,
      users (
        id,
        name,
        email,
        user_type,
        is_active,
        created_at
      )
    `
    )
    .eq("partner_id", partnerId)
    .order("role", { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

/**
 * Create a new collaborator.
 * - virtual_profile: just a name entry for accounting
 * - system_user: creates Supabase auth user + sends invite email
 */
export async function createCollaborator(
  formData: FormData
): Promise<UserActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  if (!currentUser) {
    return { success: false, error: "No autenticado" };
  }

  const raw = {
    name: formData.get("name") as string,
    email: (formData.get("email") as string) || "",
    userType: formData.get("userType") as "system_user" | "virtual_profile",
  };
  const partnerId = formData.get("partnerId") as string;
  const role = (formData.get("role") as UserRole) || "collaborator";

  const parsed = userSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(", "),
    };
  }

  if (!partnerId) {
    return { success: false, error: "Selecciona un Partner" };
  }

  let authUserId: string | null = null;
  let emailWarning: string | null = null;

  // If system_user, create auth account and optionally send invite email
  if (parsed.data.userType === "system_user") {
    if (!parsed.data.email) {
      return {
        success: false,
        error: "El email es requerido para usuarios con acceso al sistema",
      };
    }

    const serviceClient = createServiceRoleClient();

    // Check if email is already registered
    const { data: existingUsers } =
      await serviceClient.auth.admin.listUsers();
    const alreadyExists = existingUsers?.users?.some(
      (u) => u.email?.toLowerCase() === parsed.data.email!.toLowerCase()
    );
    if (alreadyExists) {
      return {
        success: false,
        error: `El email "${parsed.data.email}" ya esta registrado`,
      };
    }

    const skipInvite = formData.get("skipInvite") === "true";

    // Step 1: Generate an invite link using Supabase admin API
    // This creates the auth user AND generates the magic link, but does NOT send email
    // redirectTo points directly to set-password page — Supabase's action_link
    // verifies the token and redirects with access_token in the hash fragment,
    // which the set-password page's client-side code picks up automatically.
    const { data: linkData, error: linkError } =
      await serviceClient.auth.admin.generateLink({
        type: "invite",
        email: parsed.data.email,
        options: {
          data: { name: parsed.data.name },
          redirectTo: `${getBaseUrl()}/auth/set-password`,
        },
      });

    if (linkError) {
      const msg =
        linkError.message ||
        (typeof linkError === "object"
          ? JSON.stringify(linkError)
          : String(linkError));
      return {
        success: false,
        error: `Error creando cuenta: ${msg || "Error desconocido"}`,
      };
    }

    authUserId = linkData.user.id;

    // Step 2: Send the email ourselves via our own SMTP (Mailu)
    if (!skipInvite) {
      // Use Supabase's action_link which goes through their /auth/v1/verify endpoint.
      // This handles OTP verification properly, then redirects to our redirectTo URL.
      const inviteLink = wrapAuthLink(linkData.properties.hashed_token, "invite", "/auth/set-password");

      const emailResult = await sendInvitationEmail({
        to: parsed.data.email,
        userName: parsed.data.name,
        inviteLink,
      });

      if (!emailResult.success) {
        emailWarning = emailResult.error ?? "No se pudo enviar el email";
        console.error("Email send failed:", emailWarning);
      }
    }
  }

  // Create user record — system_user starts inactive until they set their password
  const { data: newUser, error: userError } = await supabase
    .from("users")
    .insert({
      name: parsed.data.name,
      email: parsed.data.email || null,
      user_type: parsed.data.userType,
      auth_user_id: authUserId,
      is_active: parsed.data.userType === "system_user" ? false : true,
    })
    .select()
    .single();

  if (userError) {
    return { success: false, error: userError.message };
  }

  // Assign role in partner
  const { error: roleError } = await supabase
    .from("user_partner_roles")
    .insert({
      user_id: newUser.id,
      partner_id: partnerId,
      role,
    });

  if (roleError) {
    return { success: false, error: roleError.message };
  }

  revalidatePath("/collaborators");
  return {
    success: true,
    data: { ...newUser, emailWarning },
  };
}

/**
 * Update a collaborator's basic info.
 */
export async function updateCollaborator(
  id: string,
  formData: FormData
): Promise<UserActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "No autenticado" };
  }

  const name = formData.get("name") as string;
  const email = (formData.get("email") as string) || null;

  if (!name) {
    return { success: false, error: "El nombre es requerido" };
  }

  const { data, error } = await supabase
    .from("users")
    .update({ name, email })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    // Unique-violation on the email column: the raw Postgres message
    // ("duplicate key value violates unique constraint users_email_key") is
    // cryptic, so surface an actionable one that points to the merge flow.
    if (
      (error as any).code === "23505" ||
      /users_email_key/i.test(error.message)
    ) {
      return {
        success: false,
        error:
          "Ese email ya pertenece a otra cuenta. Usa 'Invitar al sistema' para fusionar los perfiles.",
      };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/collaborators");
  return { success: true, data };
}

/**
 * Turn an existing `users` row into a system_user with login access:
 * generates a Supabase invite (creates the auth account) and emails it via
 * our SMTP. Mirrors the system_user path of `createCollaborator`. Returns an
 * `emailWarning` (not an error) when the account was created but the SMTP
 * send failed, so callers can still surface success.
 */
async function inviteExistingUser(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  name: string | null,
  email: string
): Promise<{ success: boolean; error?: string; emailWarning?: string | null }> {
  const { data: linkData, error: linkError } =
    await serviceClient.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: { name: name ?? "" },
        redirectTo: `${getBaseUrl()}/auth/set-password`,
      },
    });

  if (linkError || !linkData?.user) {
    const msg =
      linkError?.message ||
      (linkError ? JSON.stringify(linkError) : "Error desconocido");
    return { success: false, error: `Error creando acceso: ${msg}` };
  }

  await serviceClient
    .from("users")
    .update({
      auth_user_id: linkData.user.id,
      user_type: "system_user",
      email,
      is_active: false,
    })
    .eq("id", userId);

  const inviteLink = wrapAuthLink(
    linkData.properties.hashed_token,
    "invite",
    "/auth/set-password"
  );
  const emailResult = await sendInvitationEmail({
    to: email,
    userName: name ?? "Usuario",
    inviteLink,
  });

  return {
    success: true,
    emailWarning: emailResult.success
      ? null
      : emailResult.error ?? "No se pudo enviar el email de invitacion",
  };
}

/**
 * Convert a virtual profile into a system_user (create login + send invite).
 *
 * If the email already belongs to another account, no change is made and the
 * result reports `data.needsMerge` with the conflicting account so the UI can
 * confirm a merge (see `mergeAndConvertToSystemUser`).
 */
export async function convertToSystemUser(
  userId: string,
  email: string
): Promise<UserActionResult> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const emailNorm = (email ?? "").trim().toLowerCase();
  if (!emailNorm || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailNorm)) {
    return { success: false, error: "Ingresa un email valido" };
  }

  const serviceClient = createServiceRoleClient();

  const { data: target } = await serviceClient
    .from("users")
    .select("id, name, email, user_type")
    .eq("id", userId)
    .single();

  if (!target) return { success: false, error: "Usuario no encontrado" };
  if (target.user_type === "system_user") {
    return { success: false, error: "Este usuario ya tiene acceso al sistema" };
  }

  // Collision with another app user → offer to merge.
  const { data: existing } = await serviceClient
    .from("users")
    .select("id, name")
    .ilike("email", emailNorm)
    .neq("id", userId)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      error: `El email ya pertenece a "${existing.name}".`,
      data: {
        needsMerge: true,
        targetId: existing.id,
        targetName: existing.name,
      },
    };
  }

  // Collision with an auth account that has no app-user row (can't merge).
  const { data: authList } = await serviceClient.auth.admin.listUsers();
  const authExists = authList?.users?.some(
    (u) => u.email?.toLowerCase() === emailNorm
  );
  if (authExists) {
    return {
      success: false,
      error: `El email "${email}" ya esta registrado en el sistema de acceso.`,
    };
  }

  const invite = await inviteExistingUser(
    serviceClient,
    userId,
    target.name,
    emailNorm
  );
  if (!invite.success) return { success: false, error: invite.error };

  revalidatePath("/collaborators");
  revalidatePath(`/collaborators/${userId}`);
  return { success: true, data: { emailWarning: invite.emailWarning } };
}

/**
 * Merge the account `absorbedId` into `userId`, then ensure `userId` is a
 * system_user with login access.
 *
 * `userId` (the profile the admin is viewing — typically the virtual profile
 * that holds the earnings) is the SURVIVOR. `absorbedId` (the account that
 * owns the wanted email) is repointed into the survivor and then deleted, so
 * the least financial data moves. Every table referencing `users(id)` is
 * repointed BEFORE the absorbed row is deleted, so no cascade can drop data.
 * Non-atomic (sequential writes) but guarded and admin-only.
 */
export async function mergeAndConvertToSystemUser(
  userId: string,
  absorbedId: string
): Promise<UserActionResult> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  if (userId === absorbedId) {
    return { success: false, error: "No se puede fusionar un perfil consigo mismo" };
  }

  // Only super_admins may merge accounts.
  const { data: appUser } = await supabase
    .from("users")
    .select("id, user_partner_roles (role)")
    .eq("auth_user_id", user.id)
    .single();
  const roles = ((appUser?.user_partner_roles as any[]) ?? []).map(
    (r) => r.role
  );
  if (!roles.includes("super_admin")) {
    return {
      success: false,
      error: "Solo un super admin puede fusionar cuentas",
    };
  }

  const serviceClient = createServiceRoleClient();

  const { data: survivor } = await serviceClient
    .from("users")
    .select("id, name, email, user_type, auth_user_id, is_active")
    .eq("id", userId)
    .single();
  const { data: absorbed } = await serviceClient
    .from("users")
    .select("id, name, email, user_type, auth_user_id, is_active")
    .eq("id", absorbedId)
    .single();

  if (!survivor || !absorbed) {
    return { success: false, error: "Una de las cuentas no existe" };
  }
  // Never absorb the account the current admin is logged in with.
  if (absorbed.auth_user_id && absorbed.auth_user_id === user.id) {
    return {
      success: false,
      error: "No puedes fusionar tu propia cuenta activa",
    };
  }

  // ── Repoint children absorbed → survivor, deduping UNIQUE constraints ──

  // user_partner_roles UNIQUE(user_id, partner_id)
  const { data: survRoles } = await serviceClient
    .from("user_partner_roles")
    .select("partner_id")
    .eq("user_id", userId);
  const survPartners = new Set((survRoles ?? []).map((r: any) => r.partner_id));
  const { data: absRoles } = await serviceClient
    .from("user_partner_roles")
    .select("id, partner_id")
    .eq("user_id", absorbedId);
  for (const r of (absRoles ?? []) as any[]) {
    if (survPartners.has(r.partner_id)) {
      // survivor already in this partner → drop the duplicate role (and its perms)
      await serviceClient
        .from("user_permissions")
        .delete()
        .eq("user_partner_role_id", r.id);
      await serviceClient.from("user_partner_roles").delete().eq("id", r.id);
    } else {
      await serviceClient
        .from("user_partner_roles")
        .update({ user_id: userId })
        .eq("id", r.id);
      survPartners.add(r.partner_id);
    }
  }

  // product_distributions UNIQUE(product_id, user_id)
  let skippedDistributions = 0;
  const { data: survDist } = await serviceClient
    .from("product_distributions")
    .select("product_id")
    .eq("user_id", userId);
  const survProducts = new Set((survDist ?? []).map((d: any) => d.product_id));
  const { data: absDist } = await serviceClient
    .from("product_distributions")
    .select("id, product_id")
    .eq("user_id", absorbedId);
  for (const d of (absDist ?? []) as any[]) {
    if (survProducts.has(d.product_id)) {
      await serviceClient.from("product_distributions").delete().eq("id", d.id);
      skippedDistributions++;
    } else {
      await serviceClient
        .from("product_distributions")
        .update({ user_id: userId })
        .eq("id", d.id);
      survProducts.add(d.product_id);
    }
  }

  // report_line_items UNIQUE(report_id, user_id, product_id)
  let skippedLineItems = 0;
  const { data: survLI } = await serviceClient
    .from("report_line_items")
    .select("report_id, product_id")
    .eq("user_id", userId);
  const survLIKeys = new Set(
    (survLI ?? []).map((x: any) => `${x.report_id}:${x.product_id}`)
  );
  const { data: absLI } = await serviceClient
    .from("report_line_items")
    .select("id, report_id, product_id")
    .eq("user_id", absorbedId);
  for (const li of (absLI ?? []) as any[]) {
    const key = `${li.report_id}:${li.product_id}`;
    if (survLIKeys.has(key)) {
      await serviceClient.from("report_line_items").delete().eq("id", li.id);
      skippedLineItems++;
    } else {
      await serviceClient
        .from("report_line_items")
        .update({ user_id: userId })
        .eq("id", li.id);
      survLIKeys.add(key);
    }
  }

  // Simple repoints (data-bearing + actor refs). Financial user_id repoints are
  // checked; actor/audit repoints are best-effort.
  const critical: { table: string; column: string }[] = [
    { table: "adjustments", column: "user_id" },
    { table: "payments", column: "user_id" },
    { table: "payment_concepts", column: "user_id" },
    { table: "notifications", column: "user_id" },
  ];
  for (const { table, column } of critical) {
    const { error } = await (serviceClient as any)
      .from(table)
      .update({ [column]: userId })
      .eq(column, absorbedId);
    if (error) {
      return {
        success: false,
        error: `Error moviendo ${table}: ${error.message}. La fusion se detuvo; las cuentas siguen separadas.`,
      };
    }
  }

  // Actor / audit / session refs — best-effort (repoint keeps history and
  // avoids ON DELETE RESTRICT blocking the delete). Ignore per-table errors.
  const bestEffort: { table: string; column: string }[] = [
    { table: "adjustments", column: "created_by" },
    { table: "payments", column: "created_by" },
    { table: "payment_concepts", column: "created_by" },
    { table: "csv_uploads", column: "created_by" },
    { table: "monthly_reports", column: "locked_by" },
    { table: "audit_logs", column: "created_by" },
    { table: "login_logs", column: "user_id" },
    { table: "user_sessions", column: "user_id" },
  ];
  for (const { table, column } of bestEffort) {
    await (serviceClient as any)
      .from(table)
      .update({ [column]: userId })
      .eq(column, absorbedId);
  }

  // Delete the absorbed users row (now childless → cascade drops nothing).
  // This frees the email + auth_user_id UNIQUE slots for the survivor.
  const { error: deleteError } = await serviceClient
    .from("users")
    .delete()
    .eq("id", absorbedId);
  if (deleteError) {
    return {
      success: false,
      error: `Error eliminando la cuenta absorbida: ${deleteError.message}`,
    };
  }

  // Promote the survivor to a system_user.
  let emailWarning: string | null = null;
  if (absorbed.auth_user_id) {
    // Absorbed had a real login → survivor inherits it directly.
    await serviceClient
      .from("users")
      .update({
        email: absorbed.email,
        auth_user_id: absorbed.auth_user_id,
        user_type: "system_user",
        is_active: survivor.is_active || absorbed.is_active || false,
      })
      .eq("id", userId);
  } else if (absorbed.email) {
    // Neither had a login (merging two virtual profiles) → invite the email.
    await serviceClient
      .from("users")
      .update({ email: absorbed.email })
      .eq("id", userId);
    const invite = await inviteExistingUser(
      serviceClient,
      userId,
      survivor.name,
      absorbed.email
    );
    if (!invite.success) return { success: false, error: invite.error };
    emailWarning = invite.emailWarning ?? null;
  }

  revalidatePath("/collaborators");
  revalidatePath(`/collaborators/${userId}`);
  return {
    success: true,
    data: {
      mergedFrom: absorbed.name,
      skippedDistributions,
      skippedLineItems,
      emailWarning,
    },
  };
}

/**
 * Update a user's role within a partner.
 */
export async function updateUserRole(
  userId: string,
  partnerId: string,
  newRole: UserRole
): Promise<UserActionResult> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("user_partner_roles")
    .update({ role: newRole })
    .eq("user_id", userId)
    .eq("partner_id", partnerId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/collaborators");
  return { success: true };
}

/**
 * Toggle a collaborator's active status.
 */
export async function toggleCollaboratorActive(
  id: string,
  isActive: boolean
): Promise<UserActionResult> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("users")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/collaborators");
  return { success: true };
}

/**
 * Resend invitation email to a system_user who hasn't set their password yet.
 * Only callable by super_admin.
 */
export async function resendInvitation(
  userId: string
): Promise<UserActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  if (!currentUser) return { success: false, error: "No autenticado" };

  // Get the user record to find their email and auth_user_id
  const { data: targetUser, error: fetchError } = await supabase
    .from("users")
    .select("id, name, email, user_type, auth_user_id")
    .eq("id", userId)
    .single();

  if (fetchError || !targetUser) {
    return { success: false, error: "Usuario no encontrado" };
  }

  if (targetUser.user_type !== "system_user") {
    return {
      success: false,
      error: "Solo se puede reenviar invitaciones a usuarios del sistema",
    };
  }

  if (!targetUser.email) {
    return { success: false, error: "El usuario no tiene email registrado" };
  }

  const serviceClient = createServiceRoleClient();

  // If the user already has an auth account, delete it first
  // Then re-create with generateLink so we get a fresh token
  if (targetUser.auth_user_id) {
    const { error: deleteAuthError } =
      await serviceClient.auth.admin.deleteUser(targetUser.auth_user_id);

    if (deleteAuthError) {
      return {
        success: false,
        error: `Error eliminando cuenta anterior: ${deleteAuthError.message}`,
      };
    }
  }

  // Generate invite link (creates auth user + token, does NOT send email)
  // redirectTo points directly to set-password — Supabase handles token verification
  const { data: linkData, error: linkError } =
    await serviceClient.auth.admin.generateLink({
      type: "invite",
      email: targetUser.email,
      options: {
        data: { name: targetUser.name },
        redirectTo: `${getBaseUrl()}/auth/set-password`,
      },
    });

  if (linkError) {
    const msg =
      linkError.message ||
      (typeof linkError === "object" ? JSON.stringify(linkError) : String(linkError));
    return {
      success: false,
      error: `Error generando invitacion: ${msg || "Error desconocido"}`,
    };
  }

  // Update the auth_user_id in case it changed
  if (linkData.user) {
    await serviceClient
      .from("users")
      .update({ auth_user_id: linkData.user.id })
      .eq("id", userId);
  }

  // Send the email ourselves via our SMTP
  // Use Supabase's action_link which handles OTP verification properly
  const inviteLink = wrapAuthLink(linkData.properties.hashed_token, "invite", "/auth/set-password");

  const emailResult = await sendInvitationEmail({
    to: targetUser.email,
    userName: targetUser.name ?? "Usuario",
    inviteLink,
  });

  if (!emailResult.success) {
    return {
      success: false,
      error: emailResult.error ?? "Error enviando email. Verifica la configuracion SMTP.",
    };
  }

  revalidatePath("/collaborators");
  return { success: true, data: { email: targetUser.email } };
}

/**
 * Delete a user completely: auth account + user record + partner roles.
 * Only callable by super_admin. Cascading deletes should handle related records.
 */
export async function deleteUser(userId: string): Promise<UserActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  if (!currentUser) return { success: false, error: "No autenticado" };

  // Get the user record
  const { data: targetUser, error: fetchError } = await supabase
    .from("users")
    .select("id, name, auth_user_id, user_type")
    .eq("id", userId)
    .single();

  if (fetchError || !targetUser) {
    return { success: false, error: "Usuario no encontrado" };
  }

  // Prevent deleting yourself
  if (targetUser.auth_user_id === currentUser.id) {
    return { success: false, error: "No puedes eliminarte a ti mismo" };
  }

  const serviceClient = createServiceRoleClient();

  // Delete auth account if exists
  if (targetUser.auth_user_id) {
    const { error: deleteAuthError } =
      await serviceClient.auth.admin.deleteUser(targetUser.auth_user_id);

    if (deleteAuthError) {
      // Continue anyway — auth user might already be deleted
      console.error("Error deleting auth user:", deleteAuthError.message);
    }
  }

  // Delete partner role assignments
  await serviceClient
    .from("user_partner_roles")
    .delete()
    .eq("user_id", userId);

  // Delete product distributions
  await serviceClient
    .from("product_distributions")
    .delete()
    .eq("user_id", userId);

  // Delete the user record itself
  const { error: deleteError } = await serviceClient
    .from("users")
    .delete()
    .eq("id", userId);

  if (deleteError) {
    return { success: false, error: `Error al eliminar: ${deleteError.message}` };
  }

  revalidatePath("/collaborators");
  return { success: true, data: { name: targetUser.name } };
}

/**
 * Called after a user self-registers via /register.
 * Creates their record in the users table so admins can see and assign them.
 */
export async function createUserRecord(
  authUserId: string,
  name: string,
  email: string
): Promise<UserActionResult> {
  // Use service role to bypass RLS — new users can't insert into users table
  const supabase = createServiceRoleClient();

  // Check if user record already exists
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .single();

  if (existing) {
    return { success: true, data: existing }; // Already exists, nothing to do
  }

  const { data, error } = await supabase
    .from("users")
    .insert({
      auth_user_id: authUserId,
      name,
      email,
      user_type: "system_user",
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

/**
 * Update the current user's avatar.
 */
export async function updateUserAvatar(
  avatarUrl: string
): Promise<UserActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: appUser } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!appUser) return { success: false, error: "Usuario no encontrado" };

  const { error } = await supabase
    .from("users")
    .update({ avatar_url: avatarUrl })
    .eq("id", appUser.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/");
  return { success: true };
}

/**
 * Update the current user's profile (name).
 */
export async function updateUserProfile(
  formData: FormData
): Promise<UserActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "No autenticado" };
  }

  const name = (formData.get("name") as string)?.trim();
  if (!name) {
    return { success: false, error: "El nombre es requerido" };
  }

  // Find the app user by auth_user_id
  const { data: appUser } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!appUser) {
    return { success: false, error: "Usuario no encontrado" };
  }

  const { error } = await supabase
    .from("users")
    .update({ name })
    .eq("id", appUser.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings");
  return { success: true };
}

/**
 * Self-registration: creates auth user + users table record using admin API.
 * This bypasses Supabase's email sending entirely (which can't reach our SMTP).
 * The user is auto-confirmed and can log in immediately after admin assignment.
 */
export async function registerUser(
  name: string,
  email: string,
  password: string
): Promise<UserActionResult> {
  const serviceClient = createServiceRoleClient();

  // Check if email is already registered
  const { data: existingUser } = await serviceClient
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (existingUser) {
    return { success: false, error: "Ya existe una cuenta con este correo electronico." };
  }

  // Create auth user with admin API — no confirmation email sent
  const { data: authData, error: authError } =
    await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm, skip verification email
      user_metadata: { name },
    });

  if (authError) {
    const msg = authError.message || "Error desconocido al crear la cuenta";
    if (msg.includes("already been registered") || msg.includes("already exists")) {
      return { success: false, error: "Ya existe una cuenta con este correo electronico." };
    }
    return { success: false, error: msg };
  }

  // Create user record in users table
  const { error: insertError } = await serviceClient
    .from("users")
    .insert({
      auth_user_id: authData.user.id,
      name,
      email,
      user_type: "system_user",
    });

  if (insertError) {
    // Clean up auth user if table insert fails
    await serviceClient.auth.admin.deleteUser(authData.user.id);
    return { success: false, error: `Error creando registro de usuario: ${insertError.message}` };
  }

  return { success: true };
}

/**
 * Activate the current user after they set their password for the first time.
 * Called from the set-password page on success.
 */
export async function activateCurrentUser(): Promise<UserActionResult> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "No authenticated user" };
  }

  const serviceClient = createServiceRoleClient();
  const { error } = await serviceClient
    .from("users")
    .update({ is_active: true })
    .eq("auth_user_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get users who registered themselves but have no partner/role assignment.
 * These are users waiting for a super_admin to assign them.
 */
export async function getUnassignedUsers(): Promise<UserActionResult> {
  const supabase = createServerSupabaseClient();

  // Get all users
  const { data: allUsers, error: usersError } = await supabase
    .from("users")
    .select("id, name, email, user_type, is_active, created_at")
    .eq("user_type", "system_user")
    .order("created_at", { ascending: false });

  if (usersError) {
    return { success: false, error: usersError.message };
  }

  // Get users that DO have roles
  const { data: assignedRoles } = await supabase
    .from("user_partner_roles")
    .select("user_id");

  const assignedUserIds = new Set(
    (assignedRoles ?? []).map((r: any) => r.user_id)
  );

  // Filter to only unassigned users
  const unassigned = (allUsers ?? []).filter(
    (u: any) => !assignedUserIds.has(u.id)
  );

  return { success: true, data: unassigned };
}

/**
 * Assign an existing unassigned user to a partner with a role.
 */
export async function assignUserToPartner(
  userId: string,
  partnerId: string,
  role: UserRole
): Promise<UserActionResult> {
  const supabase = createServerSupabaseClient();

  // Check if this specific user+partner combination already exists
  const { data: existing } = await supabase
    .from("user_partner_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("partner_id", partnerId)
    .single();

  if (existing) {
    return { success: false, error: "Este usuario ya esta asignado a este partner" };
  }

  const { error } = await supabase
    .from("user_partner_roles")
    .insert({ user_id: userId, partner_id: partnerId, role });

  if (error) {
    return { success: false, error: error.message };
  }

  // Activate user if they were pending (self-registered)
  await supabase
    .from("users")
    .update({ is_active: true })
    .eq("id", userId)
    .eq("is_active", false);

  revalidatePath("/collaborators");
  return { success: true };
}

/**
 * Get full detail of a collaborator for the detail page.
 */
export async function getCollaboratorDetail(
  userId: string
): Promise<UserActionResult> {
  const supabase = createServerSupabaseClient();

  const { data: user, error } = await supabase
    .from("users")
    .select("id, name, email, user_type, is_active, avatar_url, created_at, updated_at, auth_user_id, totp_enabled")
    .eq("id", userId)
    .single();

  if (error || !user) return { success: false, error: "Usuario no encontrado" };

  const { data: roles } = await supabase
    .from("user_partner_roles")
    .select("id, role, partner_id, partners (id, name)")
    .eq("user_id", userId);

  const { data: distributions } = await supabase
    .from("product_distributions")
    .select("id, percentage_share, products!inner (id, name, is_active, image_url, product_types (name))")
    .eq("user_id", userId);

  const { data: lineItems } = await supabase
    .from("report_line_items")
    .select("final_usd, final_mxn, monthly_reports!inner (report_month)")
    .eq("user_id", userId);

  let totalEarningsUsd = 0;
  const monthlyEarnings = new Map<string, { usd: number; mxn: number }>();
  for (const item of (lineItems ?? []) as any[]) {
    const usd = Number(item.final_usd ?? 0);
    const mxn = Number(item.final_mxn ?? 0);
    totalEarningsUsd += usd;
    const month = item.monthly_reports?.report_month?.substring(0, 7);
    if (month) {
      const e = monthlyEarnings.get(month) ?? { usd: 0, mxn: 0 };
      e.usd += usd;
      e.mxn += mxn;
      monthlyEarnings.set(month, e);
    }
  }

  const { data: payments } = await supabase
    .from("payments")
    .select("id, total_usd, total_mxn, paid_at, payment_method")
    .eq("user_id", userId)
    .order("paid_at", { ascending: false })
    .limit(5);

  const totalPaymentsUsd = (payments ?? []).reduce(
    (s, p: any) => s + Number(p.total_usd ?? 0), 0
  );

  const { data: lastLogin } = await supabase
    .from("login_logs")
    .select("created_at, ip_address")
    .eq("user_id", userId)
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(1);

  const MONTH_LABELS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  return {
    success: true,
    data: {
      user,
      roles: roles ?? [],
      products: (distributions ?? []).map((d: any) => ({
        id: d.products.id,
        name: d.products.name,
        isActive: d.products.is_active,
        imageUrl: d.products.image_url,
        productType: d.products.product_types?.name ?? "Sin tipo",
        percentageShare: Number(d.percentage_share),
      })),
      earnings: {
        totalUsd: Math.round(totalEarningsUsd * 100) / 100,
        totalPaymentsUsd: Math.round(totalPaymentsUsd * 100) / 100,
        pendingUsd: Math.round(Math.max(0, totalEarningsUsd - totalPaymentsUsd) * 100) / 100,
        monthly: Array.from(monthlyEarnings.entries())
          .map(([month, d]) => {
            const [y, m] = month.split("-");
            return { month, label: `${MONTH_LABELS[parseInt(m) - 1]} ${y}`, totalUsd: Math.round(d.usd * 100) / 100 };
          })
          .sort((a, b) => a.month.localeCompare(b.month))
          .slice(-12),
      },
      payments: (payments ?? []).map((p: any) => ({
        id: p.id,
        totalUsd: Number(p.total_usd),
        paidAt: p.paid_at,
        paymentMethod: p.payment_method,
      })),
      lastLogin: (lastLogin as any)?.[0] ? {
        createdAt: (lastLogin as any)[0].created_at,
        ipAddress: (lastLogin as any)[0].ip_address,
      } : null,
    },
  };
}
