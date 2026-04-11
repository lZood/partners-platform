import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPaymentsSummary } from "@/actions/payments";
import { PaymentsClient } from "./payments-client";

interface PageProps {
  searchParams: Promise<{ partner?: string }>;
}

export default async function PaymentsPage({ searchParams }: PageProps) {
  const supabase = createServerSupabaseClient();
  const params = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get user role and partners
  const { data: appUser } = await supabase
    .from("users")
    .select("id, user_partner_roles (role, partner_id)")
    .eq("auth_user_id", user.id)
    .single();

  const roles = (appUser?.user_partner_roles as any[]) ?? [];
  const userRole = roles[0]?.role ?? "collaborator";

  if (userRole === "collaborator") redirect("/");

  let partners: { id: string; name: string }[] = [];
  if (userRole === "super_admin") {
    const { data } = await supabase
      .from("partners")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    partners = (data as any[]) ?? [];
  } else {
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
  const result = await getPaymentsSummary(partnerId);

  return (
    <PaymentsClient
      summaries={result.success ? result.data : []}
      partners={partners}
      currentPartnerId={partnerId}
    />
  );
}
