import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateReportExcel } from "@/lib/excel/report-excel";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params;
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Fetch report with all data
  const { data: report } = await supabase
    .from("monthly_reports")
    .select("*, partners (name), exchange_rates (usd_to_mxn)")
    .eq("id", reportId)
    .single();

  if (!report) {
    return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
  }

  const r = report as any;

  // Fetch line items grouped by user
  const { data: lineItems } = await supabase
    .from("report_line_items")
    .select("*, users (name)")
    .eq("report_id", reportId);

  // Fetch adjustments
  const { data: adjustments } = await supabase
    .from("adjustments")
    .select("*, users (name)")
    .eq("monthly_report_id", reportId);

  // Group by user
  const userMap = new Map<string, any>();
  for (const item of (lineItems ?? []) as any[]) {
    const uid = item.user_id;
    if (!userMap.has(uid)) {
      userMap.set(uid, {
        userName: item.users?.name ?? "—",
        items: [],
        adjustments: [],
        totalGrossUsd: 0,
        totalAfterTaxesUsd: 0,
        totalAdjustmentsUsd: 0,
        totalFinalUsd: 0,
        totalFinalMxn: 0,
      });
    }
    const u = userMap.get(uid)!;
    u.items.push({
      productName: item.product_name,
      percentageApplied: Number(item.percentage_applied ?? 0),
      grossUsd: Number(item.gross_usd ?? 0),
      afterTaxesUsd: Number(item.after_taxes_usd ?? 0),
      finalUsd: Number(item.final_usd ?? 0),
      finalMxn: Number(item.final_mxn ?? 0),
    });
    u.totalGrossUsd += Number(item.gross_usd ?? 0);
    u.totalAfterTaxesUsd += Number(item.after_taxes_usd ?? 0);
    u.totalFinalUsd += Number(item.final_usd ?? 0);
    u.totalFinalMxn += Number(item.final_mxn ?? 0);
  }

  for (const adj of (adjustments ?? []) as any[]) {
    const uid = adj.user_id;
    if (userMap.has(uid)) {
      const u = userMap.get(uid)!;
      const amount = adj.adjustment_type === "deduction"
        ? -Math.abs(Number(adj.amount_usd))
        : Number(adj.amount_usd);
      u.adjustments.push({
        type: adj.adjustment_type,
        description: adj.description,
        amountUsd: amount,
      });
      u.totalAdjustmentsUsd += amount;
    }
  }

  const buffer = await generateReportExcel({
    reportMonth: r.report_month,
    partnerName: r.partners?.name ?? "Partner",
    exchangeRate: Number(r.exchange_rates?.usd_to_mxn ?? 1),
    isLocked: r.is_locked,
    grandTotalUsd: Number(r.total_usd ?? 0),
    grandTotalMxn: Number(r.total_mxn ?? 0),
    users: Array.from(userMap.values()),
  });

  const filename = `reporte-${r.report_month}.xlsx`;
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
