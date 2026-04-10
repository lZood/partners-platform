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
      const inviteLink = linkData.properties.action_link;

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
    return { success: false, error: error.message };
  }

  revalidatePath("/collaborators");
  return { success: true, data };
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
  const inviteLink = linkData.properties.action_link;

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
