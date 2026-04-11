import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPartnersWithMetrics } from "@/actions/partners";
import { getAuditLogs } from "@/actions/audit";
import { AdminSettingsClient } from "./admin-settings-client";

export default async function AdminSettingsPage() {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: appUser } = await supabase
    .from("users")
    .select("id, user_partner_roles (role)")
    .eq("auth_user_id", user.id)
    .single();

  const userRole = (appUser?.user_partner_roles as any)?.[0]?.role ?? "collaborator";

  if (userRole === "collaborator") {
    redirect("/");
  }

  const isSuperAdmin = userRole === "super_admin";

  // Fetch data in parallel
  const [partnersResult, auditResult] = await Promise.all([
    isSuperAdmin ? getPartnersWithMetrics() : Promise.resolve({ success: true, data: [] }),
    getAuditLogs({ page: 1 }),
  ]);

  return (
    <AdminSettingsClient
      isSuperAdmin={isSuperAdmin}
      initialPartners={partnersResult.data ?? []}
      initialAuditData={auditResult.success ? auditResult.data : null}
    />
  );
}
