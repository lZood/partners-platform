import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUserPaymentDetail } from "@/actions/payments";
import { MyIncomeClient } from "./my-income-client";

export default async function MyIncomePage() {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!appUser) redirect("/login");

  const [paymentResult, lineItemsRes, adjustmentsRes] = await Promise.all([
    getUserPaymentDetail(appUser.id),
    supabase
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
      .order("monthly_reports(report_month)", { ascending: false }),
    supabase
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
      .order("created_at", { ascending: false }),
  ]);

  if (!paymentResult.success) {
    return (
      <div className="p-4">
        <p className="text-red-500">Error: {paymentResult.error}</p>
      </div>
    );
  }

  return (
    <MyIncomeClient
      userId={appUser.id}
      paymentDetail={paymentResult.data}
      lineItems={(lineItemsRes.data ?? []) as any}
      adjustments={(adjustmentsRes.data ?? []) as any}
    />
  );
}
