import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { MainContent } from "@/components/layout/main-content";
import { OnboardingTrigger } from "@/components/onboarding/onboarding-trigger";
import { getUnreadCount } from "@/actions/notifications";
import { getActivePartnerContext } from "@/lib/active-partner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getActivePartnerContext();
  if (!ctx) {
    redirect("/login");
  }

  const supabase = createServerSupabaseClient();
  const { data: profile } = await supabase
    .from("users")
    .select("name, email, avatar_url")
    .eq("id", ctx.appUserId ?? "")
    .maybeSingle();

  const userName =
    (profile as any)?.name ?? (profile as any)?.email ?? "Usuario";
  const avatarUrl = (profile as any)?.avatar_url ?? null;
  const unreadCount = ctx.appUserId ? await getUnreadCount(ctx.appUserId) : 0;

  const canSwitchPartner =
    ctx.isSuperAdmin && ctx.accessiblePartners.length > 1;

  // Partner shown in the navbar selector. Non super admins only see their own.
  const navbarPartners = ctx.isSuperAdmin
    ? ctx.accessiblePartners
    : ctx.activePartnerId
      ? [
          {
            id: ctx.activePartnerId,
            name: ctx.activePartnerName ?? "Partner",
            logoUrl: ctx.activePartnerLogoUrl,
          },
        ]
      : [];

  const sidebarCollapsed = cookies().get("sidebar_collapsed")?.value === "1";

  return (
    <SidebarShell collapsed={sidebarCollapsed}>
      <Sidebar
        userRole={ctx.role}
        userName={userName}
        avatarUrl={avatarUrl}
      />
      <Navbar
        userName={userName}
        userRole={ctx.role}
        userId={ctx.appUserId ?? ""}
        unreadCount={unreadCount}
        partners={navbarPartners}
        activePartnerId={ctx.activePartnerId ?? ""}
        canSwitchPartner={canSwitchPartner}
      />
      <MainContent>{children}</MainContent>
      <OnboardingTrigger
        userId={ctx.authUserId}
        role={ctx.role}
        userName={userName}
      />
    </SidebarShell>
  );
}
