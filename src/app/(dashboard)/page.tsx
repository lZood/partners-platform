import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  getDashboardData,
  getAdminDashboardExtra,
  getCollaboratorDashboard,
} from "@/actions/dashboard";
import { getActivePartnerContext } from "@/lib/active-partner";
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
  const ctx = await getActivePartnerContext();
  if (!ctx) redirect("/login");

  const params = await searchParams;
  const userName = ctx.activePartnerName ?? "Usuario";

  // ── Collaborator dashboard ──
  if (ctx.role === "collaborator") {
    const result = await getCollaboratorDashboard(ctx.appUserId ?? "");
    if (!result.success) {
      return <p className="text-red-500">Error: {result.error}</p>;
    }
    return <DashboardCollaborator data={result.data} userName={userName} />;
  }

  // ── Admin / Super Admin dashboard ──
  // Always scope to the active partner from the navbar switcher.
  const partnerId = ctx.activePartnerId ?? undefined;
  const dateFrom = params.from;
  const dateTo = params.to;

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
      currentDateFrom={dateFrom}
      currentDateTo={dateTo}
      userRole={ctx.role}
      userName={userName}
      partnerName={ctx.activePartnerName ?? undefined}
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
