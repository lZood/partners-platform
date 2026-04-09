import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReportDetailClient } from "./report-detail-client";

interface Props {
  params: { reportId: string };
}

export default async function ReportDetailPage({ params }: Props) {
  const supabase = createServerSupabaseClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user role and app user id
  const { data: appUser } = await supabase
    .from("users")
    .select(
      `
      id,
      user_partner_roles (role)
    `
    )
    .eq("auth_user_id", user.id)
    .single();

  const userRole = (appUser?.user_partner_roles as any)?.[0]?.role ?? "collaborator";
  const userId = appUser?.id;

  // Fetch report with exchange rate
  const { data: report, error } = await supabase
    .from("monthly_reports")
    .select(
      `
      id,
      report_month,
      total_usd,
      total_mxn,
      is_locked,
      locked_at,
      created_at,
      partner_id,
      partners (id, name),
      exchange_rates (usd_to_mxn)
    `
    )
    .eq("id", params.reportId)
    .single();

  if (error || !report) redirect("/reports");

  // Fetch line items
  const { data: lineItems } = await supabase
    .from("report_line_items")
    .select(
      `
      id,
      user_id,
      product_id,
      product_name,
      percentage_applied,
      gross_usd,
      after_taxes_usd,
      tax_breakdown,
      adjustments_usd,
      final_usd,
      final_mxn,
      users (id, name, email)
    `
    )
    .eq("report_id", params.reportId)
    .order("product_name", { ascending: true });

  // Fetch adjustments
  const { data: adjustments } = await supabase
    .from("adjustments")
    .select(
      `
      id,
      user_id,
      adjustment_type,
      amount_usd,
      description,
      created_at,
      users!adjustments_user_id_fkey (id, name)
    `
    )
    .eq("monthly_report_id", params.reportId)
    .order("created_at", { ascending: false });

  // Get users in this partner for adjustment form
  const { data: partnerUsers } = await supabase
    .from("user_partner_roles")
    .select("users (id, name)")
    .eq("partner_id", report.partner_id);

  const availableUsers = (partnerUsers ?? [])
    .map((r: any) => r.users)
    .filter(Boolean);

  return (
    <ReportDetailClient
      report={report as any}
      lineItems={lineItems ?? []}
      adjustments={adjustments ?? []}
      availableUsers={availableUsers}
      currentUserId={userRole === "collaborator" ? userId : undefined}
    />
  );
}
