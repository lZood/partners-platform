"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const ALL_PERMISSIONS = [
  { key: "view_reports", label: "Ver reportes", description: "Acceder a la seccion de reportes" },
  { key: "create_reports", label: "Crear reportes", description: "Subir CSV y generar reportes" },
  { key: "manage_products", label: "Gestionar productos", description: "Crear, editar y eliminar productos" },
  { key: "manage_collaborators", label: "Gestionar colaboradores", description: "Crear, editar y eliminar colaboradores" },
  { key: "manage_payments", label: "Gestionar pagos", description: "Registrar pagos y conceptos extras" },
  { key: "view_payments", label: "Ver pagos", description: "Ver pagos pendientes y realizados" },
  { key: "manage_taxes", label: "Gestionar impuestos", description: "Configurar impuestos del partner" },
  { key: "manage_partners", label: "Gestionar partners", description: "CRUD de partners (solo super_admin)" },
  { key: "view_audit_log", label: "Ver audit log", description: "Acceder al registro de auditoria" },
] as const;

export type PermissionKey = typeof ALL_PERMISSIONS[number]["key"];

const DEFAULT_PERMISSIONS: Record<string, PermissionKey[]> = {
  super_admin: ALL_PERMISSIONS.map((p) => p.key),
  admin: [
    "view_reports",
    "create_reports",
    "manage_products",
    "manage_collaborators",
    "manage_payments",
    "view_payments",
    "manage_taxes",
    "view_audit_log",
  ],
  collaborator: ["view_reports", "view_payments"],
};

/**
 * Get default permissions for a role.
 */
export async function getDefaultPermissions(role: string): Promise<PermissionKey[]> {
  return DEFAULT_PERMISSIONS[role] ?? DEFAULT_PERMISSIONS.collaborator;
}

/**
 * Get effective permissions for a user-partner-role.
 * Returns custom permissions if set, otherwise defaults for the role.
 */
export async function getUserPermissions(
  userPartnerRoleId: string,
  role: string
): Promise<{ permissions: Record<PermissionKey, boolean>; isCustom: boolean }> {
  const supabase = createServerSupabaseClient();

  const { data: custom } = await supabase
    .from("user_permissions")
    .select("permission, granted")
    .eq("user_partner_role_id", userPartnerRoleId);

  if (!custom || custom.length === 0) {
    // No custom permissions — use defaults
    const defaults = getDefaultPermissions(role);
    const permissions = {} as Record<PermissionKey, boolean>;
    for (const p of ALL_PERMISSIONS) {
      permissions[p.key] = defaults.includes(p.key);
    }
    return { permissions, isCustom: false };
  }

  // Has custom permissions
  const permissions = {} as Record<PermissionKey, boolean>;
  for (const p of ALL_PERMISSIONS) {
    const found = (custom as any[]).find((c) => c.permission === p.key);
    permissions[p.key] = found ? found.granted : false;
  }
  return { permissions, isCustom: true };
}

/**
 * Update permissions for a user-partner-role.
 */
export async function updateUserPermissions(
  userPartnerRoleId: string,
  partnerId: string,
  permissions: Record<string, boolean>
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerSupabaseClient();

  // Delete existing custom permissions
  await supabase
    .from("user_permissions")
    .delete()
    .eq("user_partner_role_id", userPartnerRoleId);

  // Insert new permissions
  const rows = Object.entries(permissions).map(([perm, granted]) => ({
    user_partner_role_id: userPartnerRoleId,
    permission: perm,
    granted,
  }));

  if (rows.length > 0) {
    const { error } = await supabase.from("user_permissions").insert(rows);
    if (error) return { success: false, error: error.message };
  }

  revalidatePath(`/settings/partners/${partnerId}`);
  return { success: true };
}

/**
 * Reset permissions to role defaults.
 */
export async function resetToDefaultPermissions(
  userPartnerRoleId: string,
  partnerId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("user_permissions")
    .delete()
    .eq("user_partner_role_id", userPartnerRoleId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/settings/partners/${partnerId}`);
  return { success: true };
}

/**
 * Quick permission check for a user in a partner context.
 */
export async function hasPermission(
  userId: string,
  partnerId: string,
  permission: PermissionKey
): Promise<boolean> {
  const supabase = createServerSupabaseClient();

  const { data: role } = await supabase
    .from("user_partner_roles")
    .select("id, role")
    .eq("user_id", userId)
    .eq("partner_id", partnerId)
    .single();

  if (!role) return false;
  const r = role as any;

  // Super admin always has all permissions
  if (r.role === "super_admin") return true;

  const result = await getUserPermissions(r.id, r.role);
  return result.permissions[permission] === true;
}
