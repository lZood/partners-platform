"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { userSchema } from "@/lib/validations/schemas";
import type { UserRole } from "@/types/database";

export type UserActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

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

  // If system_user, create auth account via service role
  if (parsed.data.userType === "system_user") {
    if (!parsed.data.email) {
      return {
        success: false,
        error: "El email es requerido para usuarios con acceso al sistema",
      };
    }

    const serviceClient = createServiceRoleClient();
    const { data: authData, error: authError } =
      await serviceClient.auth.admin.createUser({
        email: parsed.data.email,
        email_confirm: true,
        user_metadata: { name: parsed.data.name },
      });

    if (authError) {
      if (authError.message.includes("already been registered")) {
        return {
          success: false,
          error: `El email "${parsed.data.email}" ya esta registrado`,
        };
      }
      return { success: false, error: authError.message };
    }

    authUserId = authData.user.id;
  }

  // Create user record
  const { data: newUser, error: userError } = await supabase
    .from("users")
    .insert({
      name: parsed.data.name,
      email: parsed.data.email || null,
      user_type: parsed.data.userType,
      auth_user_id: authUserId,
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
  return { success: true, data: newUser };
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
