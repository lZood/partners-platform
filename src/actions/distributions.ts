"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { sendInvitationEmail } from "@/lib/email";
import type { UserRole } from "@/types/database";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

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

  const headersList = headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

interface DistributionEntry {
  userId: string;
  percentageShare: number;
}

/**
 * Save the full distribution for a product.
 * Replaces all existing distributions with the new set.
 * Validates that percentages sum to exactly 100%.
 */
export async function saveDistributions(
  productId: string,
  distributions: DistributionEntry[]
): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  // Validate sum = 100
  const total = distributions.reduce((sum, d) => sum + d.percentageShare, 0);
  const rounded = Math.round(total * 100) / 100;

  if (Math.abs(rounded - 100) > 0.01) {
    return {
      success: false,
      error: `Los porcentajes suman ${rounded}%. Deben sumar exactamente 100%.`,
    };
  }

  // Validate no zeros or negatives
  for (const d of distributions) {
    if (d.percentageShare <= 0) {
      return {
        success: false,
        error: "Todos los porcentajes deben ser mayores a 0%",
      };
    }
    if (d.percentageShare > 100) {
      return {
        success: false,
        error: "Ningun porcentaje puede exceder 100%",
      };
    }
  }

  // Check for duplicate users
  const userIds = distributions.map((d) => d.userId);
  if (new Set(userIds).size !== userIds.length) {
    return {
      success: false,
      error: "No puedes asignar el mismo usuario mas de una vez",
    };
  }

  // Delete existing distributions for this product
  const { error: deleteError } = await supabase
    .from("product_distributions")
    .delete()
    .eq("product_id", productId);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  // Insert new distributions
  if (distributions.length > 0) {
    const rows = distributions.map((d) => ({
      product_id: productId,
      user_id: d.userId,
      percentage_share: d.percentageShare,
    }));

    const { error: insertError } = await supabase
      .from("product_distributions")
      .insert(rows);

    if (insertError) {
      return { success: false, error: insertError.message };
    }
  }

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

/**
 * Add a collaborator in the context of a product distribution.
 * Handles three modes:
 *   - "existing_partner": user already in partner, just return the record (noop server-side)
 *   - "assign_existing": system user exists elsewhere → assign to this partner
 *   - "create_virtual": create a virtual_profile and assign
 *   - "invite_system": create a system_user, generate invite link, send email, assign
 * Returns the user record so the client can append it to the distribution list.
 */
export async function addCollaboratorForProduct(input: {
  mode: "assign_existing" | "create_virtual" | "invite_system";
  partnerId: string;
  role?: UserRole;
  userId?: string;
  name?: string;
  email?: string;
  skipInvite?: boolean;
}): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  if (!currentUser) return { success: false, error: "No autenticado" };

  if (!input.partnerId) {
    return { success: false, error: "Partner requerido" };
  }

  const role: UserRole = input.role ?? "collaborator";

  // Mode: assign an existing user (system_user from another partner or unassigned)
  if (input.mode === "assign_existing") {
    if (!input.userId) {
      return { success: false, error: "Usuario requerido" };
    }

    const { data: existingRole } = await supabase
      .from("user_partner_roles")
      .select("id")
      .eq("user_id", input.userId)
      .eq("partner_id", input.partnerId)
      .maybeSingle();

    if (!existingRole) {
      const { error: roleError } = await supabase
        .from("user_partner_roles")
        .insert({
          user_id: input.userId,
          partner_id: input.partnerId,
          role,
        });
      if (roleError) return { success: false, error: roleError.message };

      // Activate if they were pending self-registration
      await supabase
        .from("users")
        .update({ is_active: true })
        .eq("id", input.userId)
        .eq("is_active", false);
    }

    const { data: userRecord, error: fetchError } = await supabase
      .from("users")
      .select("id, name, email, user_type")
      .eq("id", input.userId)
      .single();

    if (fetchError || !userRecord) {
      return { success: false, error: "No se pudo recuperar el usuario" };
    }

    revalidatePath("/collaborators");
    return { success: true, data: userRecord };
  }

  // Mode: create virtual_profile
  if (input.mode === "create_virtual") {
    const name = (input.name ?? "").trim();
    if (!name) return { success: false, error: "El nombre es requerido" };

    const { data: newUser, error: userError } = await supabase
      .from("users")
      .insert({
        name,
        email: input.email ? input.email.trim() : null,
        user_type: "virtual_profile",
        is_active: true,
      })
      .select("id, name, email, user_type")
      .single();

    if (userError) return { success: false, error: userError.message };

    const { error: roleError } = await supabase
      .from("user_partner_roles")
      .insert({
        user_id: newUser.id,
        partner_id: input.partnerId,
        role,
      });
    if (roleError) return { success: false, error: roleError.message };

    revalidatePath("/collaborators");
    return { success: true, data: newUser };
  }

  // Mode: invite system_user (create + send invite email)
  if (input.mode === "invite_system") {
    const name = (input.name ?? "").trim();
    const email = (input.email ?? "").trim();
    if (!name) return { success: false, error: "El nombre es requerido" };
    if (!email) return { success: false, error: "El email es requerido" };

    const serviceClient = createServiceRoleClient();

    const { data: existingUsers } = await serviceClient.auth.admin.listUsers();
    const alreadyExists = existingUsers?.users?.some(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (alreadyExists) {
      return {
        success: false,
        error: `El email "${email}" ya esta registrado`,
      };
    }

    const { data: linkData, error: linkError } =
      await serviceClient.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          data: { name },
          redirectTo: `${getBaseUrl()}/auth/set-password`,
        },
      });

    if (linkError) {
      return {
        success: false,
        error: `Error creando cuenta: ${linkError.message || "Error desconocido"}`,
      };
    }

    const authUserId = linkData.user.id;
    let emailWarning: string | null = null;

    if (!input.skipInvite) {
      const inviteLink = wrapAuthLink(linkData.properties.hashed_token, "invite", "/auth/set-password");
      const emailResult = await sendInvitationEmail({
        to: email,
        userName: name,
        inviteLink,
      });
      if (!emailResult.success) {
        emailWarning = emailResult.error ?? "No se pudo enviar el email";
      }
    }

    const { data: newUser, error: userError } = await supabase
      .from("users")
      .insert({
        name,
        email,
        user_type: "system_user",
        auth_user_id: authUserId,
        is_active: false,
      })
      .select("id, name, email, user_type")
      .single();

    if (userError) {
      await serviceClient.auth.admin.deleteUser(authUserId);
      return { success: false, error: userError.message };
    }

    const { error: roleError } = await supabase
      .from("user_partner_roles")
      .insert({
        user_id: newUser.id,
        partner_id: input.partnerId,
        role,
      });
    if (roleError) return { success: false, error: roleError.message };

    revalidatePath("/collaborators");
    return { success: true, data: { ...newUser, emailWarning } };
  }

  return { success: false, error: "Modo no soportado" };
}

/**
 * Get all users available for distribution assignment within a partner.
 */
export async function getAvailableUsers(
  partnerId: string
): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("user_partner_roles")
    .select(
      `
      users (id, name, email, user_type, is_active)
    `
    )
    .eq("partner_id", partnerId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Flatten and filter active users
  const users = (data ?? [])
    .map((row: any) => row.users)
    .filter((u: any) => u && u.is_active);

  return { success: true, data: users };
}
