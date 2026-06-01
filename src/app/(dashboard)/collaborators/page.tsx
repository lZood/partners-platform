import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUnassignedUsers } from "@/actions/users";
import { getActivePartnerContext } from "@/lib/active-partner";
import { CollaboratorsClient } from "./collaborators-client";

export default async function CollaboratorsPage() {
  const ctx = await getActivePartnerContext();
  if (!ctx) redirect("/login");
  if (ctx.role === "collaborator") redirect("/");

  const supabase = createServerSupabaseClient();

  const { data: allUsers } = await supabase
    .from("users")
    .select(
      `
      id, name, email, user_type, is_active, created_at, auth_user_id, avatar_url,
      user_partner_roles (id, role, partner_id, partners (id, name))
    `
    )
    .order("name", { ascending: true });

  // Scope to users that have a role within the active partner.
  const users = (allUsers ?? []).filter((u: any) => {
    const roles = u.user_partner_roles ?? [];
    if (roles.length === 0) return false;
    if (!ctx.activePartnerId) return true;
    return roles.some((r: any) => r.partner_id === ctx.activePartnerId);
  });

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

  const enrichedUsers = users.map((u: any) => ({
    ...u,
    lastActivity: lastActivityMap[u.id] ?? null,
  }));

  const unassignedResult = await getUnassignedUsers();

  return (
    <CollaboratorsClient
      initialUsers={enrichedUsers}
      partners={ctx.accessiblePartners}
      unassignedUsers={
        unassignedResult.success ? unassignedResult.data ?? [] : []
      }
      isSuperAdmin={ctx.isSuperAdmin}
    />
  );
}
