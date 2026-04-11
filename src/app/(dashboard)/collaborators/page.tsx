import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUnassignedUsers } from "@/actions/users";
import { CollaboratorsClient } from "./collaborators-client";

export default async function CollaboratorsPage() {
  const supabase = createServerSupabaseClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  // Check role
  let isSuperAdmin = false;
  if (authUser) {
    const { data: roles } = await supabase
      .from("user_partner_roles")
      .select("role, users!inner (auth_user_id)")
      .eq("users.auth_user_id", authUser.id);
    isSuperAdmin = (roles ?? []).some((r: any) => r.role === "super_admin");
  }

  // Fetch collaborators
  const { data: allUsers } = await supabase
    .from("users")
    .select(`
      id, name, email, user_type, is_active, created_at, auth_user_id, avatar_url,
      user_partner_roles (id, role, partner_id, partners (id, name))
    `)
    .order("name", { ascending: true });

  const users = (allUsers ?? []).filter(
    (u: any) => u.user_partner_roles && u.user_partner_roles.length > 0
  );

  // Last activity per user (from login_logs)
  const userIds = users.map((u: any) => u.id);
  let lastActivityMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: logins } = await supabase
      .from("login_logs")
      .select("user_id, created_at")
      .in("user_id", userIds)
      .eq("status", "success")
      .order("created_at", { ascending: false });

    for (const log of (logins ?? []) as any[]) {
      if (!lastActivityMap[log.user_id]) {
        lastActivityMap[log.user_id] = log.created_at;
      }
    }
  }

  // Enrich users with last activity
  const enrichedUsers = users.map((u: any) => ({
    ...u,
    lastActivity: lastActivityMap[u.id] ?? null,
  }));

  const { data: partners } = await supabase
    .from("partners")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const unassignedResult = await getUnassignedUsers();

  return (
    <CollaboratorsClient
      initialUsers={enrichedUsers}
      partners={partners ?? []}
      unassignedUsers={unassignedResult.success ? unassignedResult.data ?? [] : []}
      isSuperAdmin={isSuperAdmin}
    />
  );
}
