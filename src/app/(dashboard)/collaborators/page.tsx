import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getUnassignedUsers } from "@/actions/users";
import { CollaboratorsClient } from "./collaborators-client";

export default async function CollaboratorsPage() {
  const supabase = createServerSupabaseClient();

  // Check if current user is super_admin
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let isSuperAdmin = false;
  if (authUser) {
    const { data: roles } = await supabase
      .from("user_partner_roles")
      .select("role, users!inner (auth_user_id)")
      .eq("users.auth_user_id", authUser.id);

    isSuperAdmin = (roles ?? []).some((r: any) => r.role === "super_admin");
  }

  // Fetch collaborators with their roles and partners
  const { data: allUsers } = await supabase
    .from("users")
    .select(
      `
      id,
      name,
      email,
      user_type,
      is_active,
      created_at,
      auth_user_id,
      user_partner_roles (
        id,
        role,
        partner_id,
        partners (id, name)
      )
    `
    )
    .order("name", { ascending: true });

  // Only show users that have at least one partner assignment in the main table
  // Unassigned users appear in the separate "Usuarios sin Asignar" section
  const users = (allUsers ?? []).filter(
    (u: any) => u.user_partner_roles && u.user_partner_roles.length > 0
  );

  // Fetch partners for the create form
  const { data: partners } = await supabase
    .from("partners")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  // Fetch unassigned users (self-registered, no partner yet)
  const unassignedResult = await getUnassignedUsers();

  return (
    <CollaboratorsClient
      initialUsers={users}
      partners={partners ?? []}
      unassignedUsers={unassignedResult.success ? unassignedResult.data ?? [] : []}
      isSuperAdmin={isSuperAdmin}
    />
  );
}
