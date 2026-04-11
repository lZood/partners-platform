"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const MONTH_LABELS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export interface MonthlyComparison {
  month: string;
  label: string;
  grossUsd: number;
  netUsd: number;
  netMxn: number;
}

export interface PartnerComparison {
  name: string;
  totalUsd: number;
  percentage: number;
}

export interface ProductRanking {
  name: string;
  productType: string;
  totalUsd: number;
  percentage: number;
}

export interface PaymentTrend {
  month: string;
  label: string;
  paidUsd: number;
  pendingUsd: number;
}

export interface AnalyticsData {
  monthlyComparison: MonthlyComparison[];
  partnerComparison: PartnerComparison[];
  productRanking: ProductRanking[];
  paymentTrend: PaymentTrend[];
  totals: {
    totalGrossUsd: number;
    totalNetUsd: number;
    totalPaidUsd: number;
    totalPendingUsd: number;
  };
}

export async function getAnalyticsData(
  year: number,
  partnerId?: string
): Promise<{ success: true; data: AnalyticsData } | { success: false; error: string }> {
  try {
    const supabase = createServerSupabaseClient();
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    // Monthly data from reports
    let reportsQuery = supabase
      .from("monthly_reports")
      .select("report_month, total_usd, total_mxn, partner_id, partners (name)")
      .gte("report_month", yearStart)
      .lte("report_month", yearEnd);
    if (partnerId) reportsQuery = reportsQuery.eq("partner_id", partnerId);
    const { data: reports } = await reportsQuery;

    // Line items for gross/net breakdown
    const reportIds = (reports ?? []).map((r: any) => r.id).filter(Boolean);

    let lineItemsQuery = supabase
      .from("report_line_items")
      .select("gross_usd, final_usd, product_name, product_id, products (product_types (name)), monthly_reports!inner (report_month, partner_id)")
      .gte("monthly_reports.report_month", yearStart)
      .lte("monthly_reports.report_month", yearEnd);
    if (partnerId) lineItemsQuery = lineItemsQuery.eq("monthly_reports.partner_id", partnerId);
    const { data: lineItems } = await lineItemsQuery;

    // Monthly comparison
    const monthMap = new Map<string, { grossUsd: number; netUsd: number; netMxn: number }>();
    for (const item of (lineItems ?? []) as any[]) {
      const rm = item.monthly_reports?.report_month;
      if (!rm) continue;
      const key = rm.substring(0, 7);
      const entry = monthMap.get(key) ?? { grossUsd: 0, netUsd: 0, netMxn: 0 };
      entry.grossUsd += Number(item.gross_usd ?? 0);
      entry.netUsd += Number(item.final_usd ?? 0);
      monthMap.set(key, entry);
    }
    // Add MXN from reports
    for (const r of (reports ?? []) as any[]) {
      const key = r.report_month?.substring(0, 7);
      if (key && monthMap.has(key)) {
        monthMap.get(key)!.netMxn += Number(r.total_mxn ?? 0);
      }
    }

    const monthlyComparison: MonthlyComparison[] = Array.from(monthMap.entries())
      .map(([month, d]) => {
        const [y, m] = month.split("-");
        return {
          month,
          label: `${MONTH_LABELS[parseInt(m) - 1]} ${y}`,
          grossUsd: Math.round(d.grossUsd * 100) / 100,
          netUsd: Math.round(d.netUsd * 100) / 100,
          netMxn: Math.round(d.netMxn * 100) / 100,
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month));

    // Partner comparison
    const partnerMap = new Map<string, number>();
    for (const r of (reports ?? []) as any[]) {
      const name = r.partners?.name ?? "Sin partner";
      partnerMap.set(name, (partnerMap.get(name) ?? 0) + Number(r.total_usd ?? 0));
    }
    const totalPartnerUsd = Array.from(partnerMap.values()).reduce((s, v) => s + v, 0);
    const partnerComparison: PartnerComparison[] = Array.from(partnerMap.entries())
      .map(([name, totalUsd]) => ({
        name,
        totalUsd: Math.round(totalUsd * 100) / 100,
        percentage: totalPartnerUsd > 0 ? Math.round((totalUsd / totalPartnerUsd) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.totalUsd - a.totalUsd);

    // Product ranking
    const prodMap = new Map<string, { totalUsd: number; productType: string }>();
    for (const item of (lineItems ?? []) as any[]) {
      const name = item.product_name ?? "Desconocido";
      const type = item.products?.product_types?.name ?? "Sin tipo";
      const entry = prodMap.get(name) ?? { totalUsd: 0, productType: type };
      entry.totalUsd += Number(item.gross_usd ?? 0);
      prodMap.set(name, entry);
    }
    const totalProdUsd = Array.from(prodMap.values()).reduce((s, v) => s + v.totalUsd, 0);
    const productRanking: ProductRanking[] = Array.from(prodMap.entries())
      .map(([name, d]) => ({
        name,
        productType: d.productType,
        totalUsd: Math.round(d.totalUsd * 100) / 100,
        percentage: totalProdUsd > 0 ? Math.round((d.totalUsd / totalProdUsd) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.totalUsd - a.totalUsd)
      .slice(0, 15);

    // Payment trend
    let paymentsQuery = supabase
      .from("payments")
      .select("paid_at, total_usd")
      .gte("paid_at", yearStart)
      .lte("paid_at", yearEnd + "T23:59:59");
    if (partnerId) paymentsQuery = paymentsQuery.eq("partner_id", partnerId);
    const { data: payments } = await paymentsQuery;

    const paymentMonthMap = new Map<string, number>();
    for (const p of (payments ?? []) as any[]) {
      const key = p.paid_at?.substring(0, 7);
      if (key) paymentMonthMap.set(key, (paymentMonthMap.get(key) ?? 0) + Number(p.total_usd ?? 0));
    }

    const paymentTrend: PaymentTrend[] = monthlyComparison.map((mc) => {
      const paid = paymentMonthMap.get(mc.month) ?? 0;
      return {
        month: mc.month,
        label: mc.label,
        paidUsd: Math.round(paid * 100) / 100,
        pendingUsd: Math.round(Math.max(0, mc.netUsd - paid) * 100) / 100,
      };
    });

    const totalGrossUsd = monthlyComparison.reduce((s, m) => s + m.grossUsd, 0);
    const totalNetUsd = monthlyComparison.reduce((s, m) => s + m.netUsd, 0);
    const totalPaidUsd = (payments ?? []).reduce((s, p: any) => s + Number(p.total_usd ?? 0), 0);

    return {
      success: true,
      data: {
        monthlyComparison,
        partnerComparison,
        productRanking,
        paymentTrend,
        totals: {
          totalGrossUsd: Math.round(totalGrossUsd * 100) / 100,
          totalNetUsd: Math.round(totalNetUsd * 100) / 100,
          totalPaidUsd: Math.round(totalPaidUsd * 100) / 100,
          totalPendingUsd: Math.round(Math.max(0, totalNetUsd - totalPaidUsd) * 100) / 100,
        },
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
