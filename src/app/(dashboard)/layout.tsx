import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";

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

  return (
    <div className="min-h-screen">
      <Sidebar userRole={userRole} />
      <div className="pl-64">
        <Navbar
          userName={appUser?.name ?? user.email ?? "Usuario"}
          userRole={userRole}
          partnerName={partnerName}
        />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
