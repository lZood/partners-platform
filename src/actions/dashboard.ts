"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface DashboardStats {
  currentMonthUsd: number;
  currentMonthMxn: number;
  previousMonthUsd: number;
  activeProducts: number;
  activeCollaborators: number;
  totalReports: number;
}

export interface MonthlyTrend {
  month: string;
  label: string;
  totalUsd: number;
  totalMxn: number;
}

export interface ProductTypeProfitability {
  productType: string;
  totalUsd: number;
  productCount: number;
}

export interface TopProduct {
  name: string;
  totalUsd: number;
  productType: string;
}

export interface RecentReport {
  id: string;
  partnerName: string;
  reportMonth: string;
  totalUsd: number;
  totalMxn: number;
  isLocked: boolean;
  createdAt: string;
}

export interface DashboardData {
  stats: DashboardStats;
  monthlyTrends: MonthlyTrend[];
  productTypeProfitability: ProductTypeProfitability[];
  topProducts: TopProduct[];
  recentReports: RecentReport[];
}

const MONTH_LABELS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export async function getDashboardData(
  partnerId?: string
): Promise<{ success: true; data: DashboardData } | { success: false; error: string }> {
  try {
    const supabase = createServerSupabaseClient();

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-01`;

    // ── Fetch reports ────────────────────────────────────────────────
    let reportsQuery = supabase
      .from("monthly_reports")
      .select("id, report_month, total_usd, total_mxn, is_locked, created_at, partner_id, partners (name)")
      .order("report_month", { ascending: false });
    if (partnerId) reportsQuery = reportsQuery.eq("partner_id", partnerId);
    const { data: rawReports } = await reportsQuery;
    const allReports = (rawReports ?? []) as any[];

    // ── Active products ──────────────────────────────────────────────
    let productsQuery = supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);
    if (partnerId) productsQuery = productsQuery.eq("partner_id", partnerId);
    const { count: productCount } = await productsQuery;

    // ── Active collaborators ─────────────────────────────────────────
    let distQuery = supabase
      .from("product_distributions")
      .select("user_id, products!inner (partner_id)");
    if (partnerId) distQuery = distQuery.eq("products.partner_id", partnerId);
    const { data: distributions } = await distQuery;
    const uniqueCollaborators = new Set(
      (distributions ?? []).map((d: any) => d.user_id)
    ).size;

    // ── Stats ────────────────────────────────────────────────────────
    const currentMonthReport = allReports.find((r) => r.report_month === currentMonth);
    const previousMonthReport = allReports.find((r) => r.report_month === previousMonth);

    const stats: DashboardStats = {
      currentMonthUsd: Number(currentMonthReport?.total_usd ?? 0),
      currentMonthMxn: Number(currentMonthReport?.total_mxn ?? 0),
      previousMonthUsd: Number(previousMonthReport?.total_usd ?? 0),
      activeProducts: productCount ?? 0,
      activeCollaborators: uniqueCollaborators,
      totalReports: allReports.length,
    };

    // ── Monthly trends (last 12) ────────────────────────────────────
    const monthlyMap = new Map<string, { totalUsd: number; totalMxn: number }>();
    for (const r of allReports) {
      const key = r.report_month?.substring(0, 7);
      if (!key) continue;
      const e = monthlyMap.get(key) ?? { totalUsd: 0, totalMxn: 0 };
      e.totalUsd += Number(r.total_usd ?? 0);
      e.totalMxn += Number(r.total_mxn ?? 0);
      monthlyMap.set(key, e);
    }

    const monthlyTrends: MonthlyTrend[] = Array.from(monthlyMap.entries())
      .map(([month, d]) => {
        const [y, m] = month.split("-");
        return {
          month,
          label: `${MONTH_LABELS[parseInt(m) - 1]} ${y}`,
          totalUsd: Math.round(d.totalUsd * 100) / 100,
          totalMxn: Math.round(d.totalMxn * 100) / 100,
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);

    // ── Line items for profitability + top products ──────────────────
    const reportIds = allReports.map((r) => r.id);
    let lineItemsData: any[] = [];

    if (reportIds.length > 0) {
      const { data } = await supabase
        .from("report_line_items")
        .select("gross_usd, product_name, product_id, products (product_types (name))")
        .in("report_id", reportIds);
      lineItemsData = data ?? [];
    }

    // Product type profitability
    const typeMap = new Map<string, { totalUsd: number; productIds: Set<string> }>();
    for (const item of lineItemsData) {
      const typeName = item.products?.product_types?.name ?? "Sin tipo";
      const e = typeMap.get(typeName) ?? { totalUsd: 0, productIds: new Set<string>() };
      e.totalUsd += Number(item.gross_usd ?? 0);
      if (item.product_id) e.productIds.add(item.product_id);
      typeMap.set(typeName, e);
    }

    const productTypeProfitability: ProductTypeProfitability[] = Array.from(typeMap.entries())
      .map(([productType, d]) => ({
        productType,
        totalUsd: Math.round(d.totalUsd * 100) / 100,
        productCount: d.productIds.size,
      }))
      .sort((a, b) => b.totalUsd - a.totalUsd);

    // Top products by gross USD
    const prodMap = new Map<string, { totalUsd: number; productType: string }>();
    for (const item of lineItemsData) {
      const name = item.product_name ?? "Desconocido";
      const typeName = item.products?.product_types?.name ?? "Sin tipo";
      const e = prodMap.get(name) ?? { totalUsd: 0, productType: typeName };
      e.totalUsd += Number(item.gross_usd ?? 0);
      prodMap.set(name, e);
    }

    const topProducts: TopProduct[] = Array.from(prodMap.entries())
      .map(([name, d]) => ({
        name,
        totalUsd: Math.round(d.totalUsd * 100) / 100,
        productType: d.productType,
      }))
      .sort((a, b) => b.totalUsd - a.totalUsd)
      .slice(0, 10);

    // ── Recent reports (last 5) ──────────────────────────────────────
    const recentReports: RecentReport[] = allReports.slice(0, 5).map((r) => ({
      id: r.id,
      partnerName: r.partners?.name ?? "—",
      reportMonth: r.report_month,
      totalUsd: Number(r.total_usd ?? 0),
      totalMxn: Number(r.total_mxn ?? 0),
      isLocked: r.is_locked,
      createdAt: r.created_at,
    }));

    return {
      success: true,
      data: { stats, monthlyTrends, productTypeProfitability, topProducts, recentReports },
    };
  } catch (error: any) {
    return { success: false, error: error.message ?? "Error al cargar datos del dashboard" };
  }
}
