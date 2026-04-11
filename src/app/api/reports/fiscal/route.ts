import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateFiscalExcel } from "@/lib/excel/fiscal-excel";

const MONTH_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? new Date().getFullYear().toString());
  const userId = searchParams.get("userId");
  const partnerId = searchParams.get("partnerId");

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  // Fetch all line items for the year
  let lineItemsQuery = supabase
    .from("report_line_items")
    .select(`
      user_id, gross_usd, after_taxes_usd, final_usd, final_mxn,
      monthly_reports!inner (report_month, partner_id, exchange_rates (usd_to_mxn)),
      users (name, email)
    `)
    .gte("monthly_reports.report_month", yearStart)
    .lte("monthly_reports.report_month", yearEnd);

  if (userId) lineItemsQuery = lineItemsQuery.eq("user_id", userId);
  if (partnerId) lineItemsQuery = lineItemsQuery.eq("monthly_reports.partner_id", partnerId);

  const { data: lineItems } = await lineItemsQuery;

  // Fetch adjustments for the year
  let adjQuery = supabase
    .from("adjustments")
    .select("user_id, adjustment_type, description, amount_usd, monthly_reports!inner (report_month)")
    .gte("monthly_reports.report_month", yearStart)
    .lte("monthly_reports.report_month", yearEnd);

  if (userId) adjQuery = adjQuery.eq("user_id", userId);

  const { data: adjustments } = await adjQuery;

  // Fetch payments for the year
  let paymentsQuery = supabase
    .from("payments")
    .select("user_id, total_usd")
    .gte("paid_at", yearStart)
    .lte("paid_at", yearEnd + "T23:59:59");

  if (partnerId) paymentsQuery = paymentsQuery.eq("partner_id", partnerId);

  const { data: payments } = await paymentsQuery;

  // Group by user
  const userMap = new Map<string, any>();

  for (const item of (lineItems ?? []) as any[]) {
    const uid = item.user_id;
    if (!userMap.has(uid)) {
      userMap.set(uid, {
        userName: item.users?.name ?? "—",
        userEmail: item.users?.email ?? null,
        totalGrossUsd: 0,
        totalTaxesUsd: 0,
        totalNetUsd: 0,
        totalNetMxn: 0,
        totalPaymentsReceived: 0,
        monthsMap: new Map(),
        adjustments: [],
      });
    }
    const u = userMap.get(uid)!;
    const gross = Number(item.gross_usd ?? 0);
    const afterTax = Number(item.after_taxes_usd ?? 0);
    const net = Number(item.final_usd ?? 0);
    const mxn = Number(item.final_mxn ?? 0);
    const month = item.monthly_reports?.report_month ?? "";
    const rate = Number(item.monthly_reports?.exchange_rates?.usd_to_mxn ?? 1);

    u.totalGrossUsd += gross;
    u.totalTaxesUsd += (gross - afterTax);
    u.totalNetUsd += net;
    u.totalNetMxn += mxn;

    if (!u.monthsMap.has(month)) {
      const [y, m] = month.split("-");
      u.monthsMap.set(month, {
        month,
        label: `${MONTH_LABELS[parseInt(m) - 1]} ${y}`,
        grossUsd: 0,
        taxesUsd: 0,
        netUsd: 0,
        exchangeRate: rate,
        netMxn: 0,
      });
    }
    const me = u.monthsMap.get(month)!;
    me.grossUsd += gross;
    me.taxesUsd += (gross - afterTax);
    me.netUsd += net;
    me.netMxn += mxn;
  }

  // Add adjustments
  for (const adj of (adjustments ?? []) as any[]) {
    const uid = adj.user_id;
    if (userMap.has(uid)) {
      userMap.get(uid)!.adjustments.push({
        type: adj.adjustment_type,
        description: adj.description,
        amountUsd: Number(adj.amount_usd),
        month: adj.monthly_reports?.report_month ?? "",
      });
    }
  }

  // Add payments totals
  for (const p of (payments ?? []) as any[]) {
    if (userMap.has(p.user_id)) {
      userMap.get(p.user_id)!.totalPaymentsReceived += Number(p.total_usd);
    }
  }

  // Get partner name
  let partnerName: string | null = null;
  if (partnerId) {
    const { data: p } = await supabase.from("partners").select("name").eq("id", partnerId).single();
    partnerName = (p as any)?.name ?? null;
  }

  const users = Array.from(userMap.values()).map((u) => ({
    ...u,
    totalGrossUsd: Math.round(u.totalGrossUsd * 100) / 100,
    totalTaxesUsd: Math.round(u.totalTaxesUsd * 100) / 100,
    totalNetUsd: Math.round(u.totalNetUsd * 100) / 100,
    totalNetMxn: Math.round(u.totalNetMxn * 100) / 100,
    totalPaymentsReceived: Math.round(u.totalPaymentsReceived * 100) / 100,
    months: Array.from(u.monthsMap.values()).sort((a: any, b: any) =>
      a.month.localeCompare(b.month)
    ),
    monthsMap: undefined,
  }));

  const buffer = await generateFiscalExcel({ year, partnerName, users });

  const filename = `reporte-fiscal-${year}.xlsx`;
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
