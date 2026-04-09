"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

// ── Interfaces ──────────────────────────────────────────────────────

export interface ProductMetrics {
  totalGrossUsd: number;
  totalAfterTaxesUsd: number;
  totalFinalUsd: number;
  totalFinalMxn: number;
  averageMonthlyUsd: number;
  strongestMonth: { month: string; grossUsd: number } | null;
  weakestMonth: { month: string; grossUsd: number } | null;
  firstAppearance: string | null;
  lastAppearance: string | null;
  totalMonthsActive: number;
  totalReportsIn: number;
}

export interface MonthlySalesEntry {
  month: string;
  label: string;
  grossUsd: number;
  afterTaxesUsd: number;
  finalUsd: number;
  finalMxn: number;
}

export interface ProductCollaboratorShare {
  userId: string;
  userName: string;
  percentageShare: number;
  totalEarnedUsd: number;
  totalEarnedMxn: number;
}

export interface ProductAnalyticsData {
  metrics: ProductMetrics;
  monthlySales: MonthlySalesEntry[];
  collaboratorShares: ProductCollaboratorShare[];
}

const MONTH_LABELS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function monthLabel(monthStr: string): string {
  const [y, m] = monthStr.split("-");
  return `${MONTH_LABELS[parseInt(m) - 1]} ${y}`;
}

// ── Main analytics function ─────────────────────────────────────────

export async function getProductAnalytics(
  productId: string
): Promise<{ success: true; data: ProductAnalyticsData } | { success: false; error: string }> {
  try {
    const supabase = createServerSupabaseClient();

    // 1. Get all line items for this product, joined with report for month
    const { data: lineItems, error: liError } = await supabase
      .from("report_line_items")
      .select(
        `
        id,
        gross_usd,
        after_taxes_usd,
        final_usd,
        final_mxn,
        user_id,
        users (id, name),
        report_id,
        monthly_reports!inner (
          id,
          report_month
        )
      `
      )
      .eq("product_id", productId)
      .order("monthly_reports(report_month)", { ascending: true });

    if (liError) {
      return { success: false, error: liError.message };
    }

    const items = (lineItems ?? []) as any[];

    // 2. Aggregate monthly sales
    const monthlyMap = new Map<
      string,
      { grossUsd: number; afterTaxesUsd: number; finalUsd: number; finalMxn: number }
    >();

    for (const item of items) {
      const reportMonth = item.monthly_reports?.report_month;
      if (!reportMonth) continue;
      const key = reportMonth.substring(0, 7); // YYYY-MM
      const entry = monthlyMap.get(key) ?? {
        grossUsd: 0,
        afterTaxesUsd: 0,
        finalUsd: 0,
        finalMxn: 0,
      };
      entry.grossUsd += Number(item.gross_usd ?? 0);
      entry.afterTaxesUsd += Number(item.after_taxes_usd ?? 0);
      entry.finalUsd += Number(item.final_usd ?? 0);
      entry.finalMxn += Number(item.final_mxn ?? 0);
      monthlyMap.set(key, entry);
    }

    const monthlySales: MonthlySalesEntry[] = Array.from(monthlyMap.entries())
      .map(([month, d]) => ({
        month,
        label: monthLabel(month),
        grossUsd: Math.round(d.grossUsd * 100) / 100,
        afterTaxesUsd: Math.round(d.afterTaxesUsd * 100) / 100,
        finalUsd: Math.round(d.finalUsd * 100) / 100,
        finalMxn: Math.round(d.finalMxn * 100) / 100,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // 3. Calculate aggregate metrics
    let totalGrossUsd = 0;
    let totalAfterTaxesUsd = 0;
    let totalFinalUsd = 0;
    let totalFinalMxn = 0;

    for (const entry of monthlySales) {
      totalGrossUsd += entry.grossUsd;
      totalAfterTaxesUsd += entry.afterTaxesUsd;
      totalFinalUsd += entry.finalUsd;
      totalFinalMxn += entry.finalMxn;
    }

    const totalMonthsActive = monthlySales.length;
    const averageMonthlyUsd =
      totalMonthsActive > 0 ? totalGrossUsd / totalMonthsActive : 0;

    let strongestMonth: { month: string; grossUsd: number } | null = null;
    let weakestMonth: { month: string; grossUsd: number } | null = null;

    for (const entry of monthlySales) {
      if (!strongestMonth || entry.grossUsd > strongestMonth.grossUsd) {
        strongestMonth = { month: entry.label, grossUsd: entry.grossUsd };
      }
      if (!weakestMonth || entry.grossUsd < weakestMonth.grossUsd) {
        weakestMonth = { month: entry.label, grossUsd: entry.grossUsd };
      }
    }

    const firstAppearance = monthlySales.length > 0 ? monthlySales[0].label : null;
    const lastAppearance =
      monthlySales.length > 0 ? monthlySales[monthlySales.length - 1].label : null;

    // Count unique reports
    const reportIds = new Set(items.map((item: any) => item.report_id));
    const totalReportsIn = reportIds.size;

    const metrics: ProductMetrics = {
      totalGrossUsd: Math.round(totalGrossUsd * 100) / 100,
      totalAfterTaxesUsd: Math.round(totalAfterTaxesUsd * 100) / 100,
      totalFinalUsd: Math.round(totalFinalUsd * 100) / 100,
      totalFinalMxn: Math.round(totalFinalMxn * 100) / 100,
      averageMonthlyUsd: Math.round(averageMonthlyUsd * 100) / 100,
      strongestMonth,
      weakestMonth,
      firstAppearance,
      lastAppearance,
      totalMonthsActive,
      totalReportsIn,
    };

    // 4. Collaborator earnings from line items
    const collabMap = new Map<
      string,
      { userName: string; totalUsd: number; totalMxn: number }
    >();

    for (const item of items) {
      const userId = item.user_id;
      if (!userId) continue;
      const userName = item.users?.name ?? "Desconocido";
      const entry = collabMap.get(userId) ?? {
        userName,
        totalUsd: 0,
        totalMxn: 0,
      };
      entry.totalUsd += Number(item.final_usd ?? 0);
      entry.totalMxn += Number(item.final_mxn ?? 0);
      collabMap.set(userId, entry);
    }

    // 5. Get current distribution percentages
    const { data: distData } = await supabase
      .from("product_distributions")
      .select("user_id, percentage_share, users (id, name)")
      .eq("product_id", productId);

    const distMap = new Map<string, number>();
    for (const d of (distData ?? []) as any[]) {
      distMap.set(d.user_id, Number(d.percentage_share));
      // Ensure collaborator exists in map even if no line items yet
      if (!collabMap.has(d.user_id)) {
        collabMap.set(d.user_id, {
          userName: d.users?.name ?? "Desconocido",
          totalUsd: 0,
          totalMxn: 0,
        });
      }
    }

    const collaboratorShares: ProductCollaboratorShare[] = Array.from(
      collabMap.entries()
    )
      .map(([userId, d]) => ({
        userId,
        userName: d.userName,
        percentageShare: distMap.get(userId) ?? 0,
        totalEarnedUsd: Math.round(d.totalUsd * 100) / 100,
        totalEarnedMxn: Math.round(d.totalMxn * 100) / 100,
      }))
      .sort((a, b) => b.totalEarnedUsd - a.totalEarnedUsd);

    return {
      success: true,
      data: { metrics, monthlySales, collaboratorShares },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message ?? "Error al cargar analytics del producto",
    };
  }
}

// ── Affected reports info (for distribution change warnings) ────────

export interface AffectedReportsInfo {
  lockedReports: { id: string; month: string }[];
  unlockedReports: { id: string; month: string }[];
}

export async function getProductAffectedReports(
  productId: string
): Promise<{ success: true; data: AffectedReportsInfo } | { success: false; error: string }> {
  try {
    const supabase = createServerSupabaseClient();

    // Find all reports that have line items for this product
    const { data: lineItems, error } = await supabase
      .from("report_line_items")
      .select(
        `
        report_id,
        monthly_reports!inner (
          id,
          report_month,
          is_locked
        )
      `
      )
      .eq("product_id", productId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Deduplicate by report_id
    const reportMap = new Map<string, { id: string; month: string; isLocked: boolean }>();
    for (const item of (lineItems ?? []) as any[]) {
      const report = item.monthly_reports;
      if (!report || reportMap.has(report.id)) continue;
      reportMap.set(report.id, {
        id: report.id,
        month: report.report_month,
        isLocked: report.is_locked,
      });
    }

    const lockedReports: { id: string; month: string }[] = [];
    const unlockedReports: { id: string; month: string }[] = [];

    Array.from(reportMap.values()).forEach((r) => {
      if (r.isLocked) {
        lockedReports.push({ id: r.id, month: r.month });
      } else {
        unlockedReports.push({ id: r.id, month: r.month });
      }
    });

    // Sort by month descending
    lockedReports.sort((a, b) => b.month.localeCompare(a.month));
    unlockedReports.sort((a, b) => b.month.localeCompare(a.month));

    return { success: true, data: { lockedReports, unlockedReports } };
  } catch (error: any) {
    return { success: false, error: error.message ?? "Error obteniendo reportes afectados" };
  }
}

// ── Product changelog from audit_logs ───────────────────────────────

export interface ProductChangelogEntry {
  id: string;
  action: string;
  tableName: string;
  changedAt: string;
  userName: string | null;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
}

export async function getProductChangelog(
  productId: string
): Promise<{ success: true; data: ProductChangelogEntry[] } | { success: false; error: string }> {
  try {
    const supabase = createServerSupabaseClient();

    // Fetch audit logs related to this product
    // Check both record_id matching the product and changes in product_distributions
    const { data: logs, error } = await supabase
      .from("audit_logs")
      .select("id, table_name, action, old_values, new_values, created_at, user_id, users (name)")
      .or(`and(table_name.eq.products,record_id.eq.${productId}),and(table_name.eq.product_distributions,old_values->>product_id.eq.${productId}),and(table_name.eq.product_distributions,new_values->>product_id.eq.${productId})`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      // If the audit_logs table doesn't exist or query fails, return empty
      return { success: true, data: [] };
    }

    const entries: ProductChangelogEntry[] = (logs ?? []).map((log: any) => ({
      id: log.id,
      action: log.action,
      tableName: log.table_name,
      changedAt: log.created_at,
      userName: log.users?.name ?? null,
      oldValues: log.old_values,
      newValues: log.new_values,
    }));

    return { success: true, data: entries };
  } catch {
    return { success: true, data: [] };
  }
}

// ── Revenue summary for products list (batch) ──────────────────────

export interface ProductRevenueSummary {
  productId: string;
  totalGrossUsd: number;
  monthCount: number;
  lastMonthGrossUsd: number;
  trend: number[]; // last 6 months gross USD for sparkline
}

export async function getProductsRevenueSummary(
  productIds: string[]
): Promise<{ success: true; data: Map<string, ProductRevenueSummary> } | { success: false; error: string }> {
  try {
    if (productIds.length === 0) {
      return { success: true, data: new Map() };
    }

    const supabase = createServerSupabaseClient();

    const { data: lineItems, error } = await supabase
      .from("report_line_items")
      .select(
        `
        product_id,
        gross_usd,
        monthly_reports!inner (report_month)
      `
      )
      .in("product_id", productIds);

    if (error) {
      return { success: false, error: error.message };
    }

    // Group by product
    const productMap = new Map<
      string,
      Map<string, number>
    >();

    for (const item of (lineItems ?? []) as any[]) {
      const pid = item.product_id;
      const month = item.monthly_reports?.report_month?.substring(0, 7);
      if (!pid || !month) continue;

      if (!productMap.has(pid)) productMap.set(pid, new Map());
      const monthMap = productMap.get(pid)!;
      monthMap.set(month, (monthMap.get(month) ?? 0) + Number(item.gross_usd ?? 0));
    }

    // Build summaries
    const result = new Map<string, ProductRevenueSummary>();

    // Get last 6 month keys
    const now = new Date();
    const last6Months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      last6Months.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      );
    }

    for (const pid of productIds) {
      const monthMap = productMap.get(pid);
      if (!monthMap) {
        result.set(pid, {
          productId: pid,
          totalGrossUsd: 0,
          monthCount: 0,
          lastMonthGrossUsd: 0,
          trend: [0, 0, 0, 0, 0, 0],
        });
        continue;
      }

      let totalGross = 0;
      Array.from(monthMap.values()).forEach((v) => { totalGross += v; });

      const trend = last6Months.map((m) =>
        Math.round((monthMap.get(m) ?? 0) * 100) / 100
      );

      const lastMonthKey = last6Months[last6Months.length - 1];
      const lastMonthGross = monthMap.get(lastMonthKey) ?? 0;

      result.set(pid, {
        productId: pid,
        totalGrossUsd: Math.round(totalGross * 100) / 100,
        monthCount: monthMap.size,
        lastMonthGrossUsd: Math.round(lastMonthGross * 100) / 100,
        trend,
      });
    }

    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message ?? "Error cargando resumen de ingresos" };
  }
}
