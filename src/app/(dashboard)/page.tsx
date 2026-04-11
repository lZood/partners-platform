import { Suspense } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  getDashboardData,
  getAdminDashboardExtra,
  getCollaboratorDashboard,
} from "@/actions/dashboard";
import { DashboardClient } from "./dashboard-client";
import { DashboardCollaborator } from "./dashboard-collaborator";
import { DashboardSkeleton } from "./dashboard-skeleton";

interface PageProps {
  searchParams: Promise<{
    partner?: string;
    from?: string;
    to?: string;
  }>;
}

async function DashboardContent({ searchParams }: PageProps) {
  const supabase = createServerSupabaseClient();
  const params = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: appUser } = await supabase
    .from("users")
    .select(`
      id,
      name,
      user_partner_roles (role, partner_id)
    `)
    .eq("auth_user_id", user.id)
    .single();

  const roles = (appUser?.user_partner_roles as any[]) ?? [];
  const userRole = roles[0]?.role ?? "collaborator";
  const userName = (appUser as any)?.name ?? "Usuario";

  // ── Collaborator dashboard ──
  if (userRole === "collaborator") {
    const result = await getCollaboratorDashboard(appUser?.id ?? "");
    if (!result.success) {
      return <p className="text-red-500">Error: {result.error}</p>;
    }
    return (
      <DashboardCollaborator data={result.data} userName={userName} />
    );
  }

  // ── Admin / Super Admin dashboard ──
  let partners: { id: string; name: string }[] = [];

  if (userRole === "super_admin") {
    const { data } = await supabase
      .from("partners")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    partners = (data as any[]) ?? [];
  } else if (userRole === "admin") {
    const partnerIds = roles.map((r: any) => r.partner_id);
    const { data } = await supabase
      .from("partners")
      .select("id, name")
      .in("id", partnerIds)
      .eq("is_active", true)
      .order("name");
    partners = (data as any[]) ?? [];
  }

  const partnerId = params.partner;
  const dateFrom = params.from;
  const dateTo = params.to;

  // Fetch base + extra data in parallel
  const [baseResult, extraResult] = await Promise.all([
    getDashboardData(partnerId, dateFrom, dateTo),
    getAdminDashboardExtra(partnerId, dateFrom, dateTo),
  ]);

  if (!baseResult.success) {
    return <p className="text-red-500">Error: {baseResult.error}</p>;
  }

  return (
    <DashboardClient
      data={baseResult.data}
      extra={extraResult.success ? extraResult.data : null}
      partners={partners}
      currentPartnerId={partnerId}
      currentDateFrom={dateFrom}
      currentDateTo={dateTo}
      userRole={userRole}
      userName={userName}
    />
  );
}

export default function DashboardPage(props: PageProps) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent {...props} />
    </Suspense>
  );
}
