import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MyEarningsClient } from "./my-earnings-client";

export default async function MyEarningsPage() {
  const supabase = createServerSupabaseClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get app user id
  const { data: appUser } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!appUser) {
    redirect("/login");
  }

  // Get report line items for this user with report and exchange rate data
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
      final_usd,
      final_mxn,
      monthly_reports (
        id,
        report_month,
        partners (id, name),
        exchange_rates (usd_to_mxn)
      )
    `
    )
    .eq("user_id", appUser.id)
    .order("monthly_reports(report_month)", { ascending: false });

  // Get adjustments for this user
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
      monthly_reports (
        id,
        report_month
      )
    `
    )
    .eq("user_id", appUser.id)
    .order("created_at", { ascending: false });

  return (
    <MyEarningsClient
      userId={appUser.id}
      lineItems={lineItems ?? []}
      adjustments={adjustments ?? []}
    />
  );
}
