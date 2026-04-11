import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { getUnreadCount } from "@/actions/notifications";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile and role
  const { data: appUser } = await supabase
    .from("users")
    .select(
      `
      id,
      name,
      email,
      avatar_url,
      user_partner_roles (
        role,
        partner_id,
        partners (name)
      )
    `
    )
    .eq("auth_user_id", user.id)
    .single();

  const userRole =
    (appUser?.user_partner_roles as any)?.[0]?.role ?? "collaborator";
  const partnerName =
    (appUser?.user_partner_roles as any)?.[0]?.partners?.name ?? "Sin Partner";
  const userName = appUser?.name ?? user.email ?? "Usuario";
  const appUserId = appUser?.id ?? "";
  const unreadCount = appUserId ? await getUnreadCount(appUserId) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        userRole={userRole}
        userName={userName}
        partnerName={partnerName}
        avatarUrl={(appUser as any)?.avatar_url ?? null}
      />
      <div className="lg:pl-64">
        <Navbar
          userName={userName}
          userRole={userRole}
          partnerName={partnerName}
          userId={appUserId}
          unreadCount={unreadCount}
        />
        <main className="px-4 pb-8 pt-2 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
