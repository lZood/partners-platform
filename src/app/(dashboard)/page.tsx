import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getDashboardData } from "@/actions/dashboard";
import { DashboardClient } from "./dashboard-client";

interface PageProps {
  searchParams: Promise<{
    partner?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const supabase = createServerSupabaseClient();
  const params = await searchParams;

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user role
  const { data: appUser } = await supabase
    .from("users")
    .select(`
      id,
      user_partner_roles (role, partner_id)
    `)
    .eq("auth_user_id", user.id)
    .single();

  const roles = (appUser?.user_partner_roles as any[]) ?? [];
  const userRole = roles[0]?.role ?? "collaborator";

  // Get partners for filter dropdown
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

  // For collaborators, scope to their partner
  const partnerId =
    params.partner ??
    (userRole === "collaborator" ? roles[0]?.partner_id : undefined);

  // Fetch dashboard data
  const result = await getDashboardData(partnerId);

  if (!result.success) {
    return (
      <div className="p-6">
        <p className="text-red-500">Error cargando dashboard: {result.error}</p>
      </div>
    );
  }

  return (
    <DashboardClient
      data={result.data}
      partners={partners}
      currentPartnerId={partnerId}
      userRole={userRole}
    />
  );
}
