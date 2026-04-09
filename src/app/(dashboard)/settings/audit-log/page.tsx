import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAuditLogs } from "@/actions/audit";
import { AuditLogClient } from "./audit-log-client";

export default async function AuditLogPage() {
  const supabase = createServerSupabaseClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verify admin role
  const { data: appUser } = await supabase
    .from("users")
    .select("id, user_partner_roles (role)")
    .eq("auth_user_id", user.id)
    .single();

  const userRole = (appUser?.user_partner_roles as any)?.[0]?.role ?? "collaborator";

  if (userRole === "collaborator") {
    redirect("/");
  }

  // Fetch initial data
  const result = await getAuditLogs({ page: 1 });

  if (!result.success) {
    return (
      <div className="p-6">
        <p className="text-red-500">Error cargando audit log: {result.error}</p>
      </div>
    );
  }

  return <AuditLogClient initialData={result.data} />;
}
