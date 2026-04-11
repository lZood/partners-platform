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

// ── Extended data for role-based dashboards ──────────────────────

export interface CalendarEvent {
  date: string; // YYYY-MM-DD
  type: "report" | "payment";
  label: string;
}

export interface Notification {
  id: string;
  type: "report_generated" | "payment_registered" | "payment_received" | "user_unassigned" | "concept_added";
  message: string;
  timestamp: string;
}

export interface PendingPaymentSummary {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  totalPendingUsd: number;
  unpaidMonths: number;
}

export interface PartnerOverview {
  id: string;
  name: string;
  logoUrl: string | null;
  currentMonthUsd: number;
  memberCount: number;
}

export interface AdminDashboardExtra {
  totalPendingPayments: number;
  totalPaidThisMonth: number;
  totalAccumulatedUsd: number;
  pendingPayments: PendingPaymentSummary[];
  partnersOverview: PartnerOverview[];
  unassignedUsersCount: number;
  calendar: CalendarEvent[];
  notifications: Notification[];
}

export interface CollaboratorProduct {
  name: string;
  productType: string;
  percentageShare: number;
}

export interface CollaboratorDashboardData {
  stats: {
    currentMonthUsd: number;
    currentMonthMxn: number;
    totalAccumulatedUsd: number;
    totalPaymentsReceived: number;
    assignedProducts: number;
  };
  monthlyTrends: MonthlyTrend[];
  pendingPaymentUsd: number;
  pendingConceptsUsd: number;
  lastPayment: {
    id: string;
    totalUsd: number;
    totalMxn: number;
    paidAt: string;
    paymentMethod: string | null;
  } | null;
  myProducts: CollaboratorProduct[];
  calendar: CalendarEvent[];
  notifications: Notification[];
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

/**
 * Get extra dashboard data for admin/super_admin roles.
 */
export async function getAdminDashboardExtra(
  partnerId?: string
): Promise<{ success: true; data: AdminDashboardExtra } | { success: false; error: string }> {
  try {
    const supabase = createServerSupabaseClient();
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    // Total pending payments (all unpaid report earnings)
    let lineItemsQuery = supabase
      .from("report_line_items")
      .select("final_usd, user_id, report_id, monthly_reports!inner (partner_id)")
      .gt("final_usd", 0);
    if (partnerId) lineItemsQuery = lineItemsQuery.eq("monthly_reports.partner_id", partnerId);
    const { data: allLineItems } = await lineItemsQuery;

    // Get all paid report references
    const { data: paidItemsRaw } = await supabase
      .from("payment_items")
      .select("reference_id, payments!inner (user_id)")
      .eq("item_type", "report_earnings");
    const paidByUser = new Map<string, Set<string>>();
    for (const pi of (paidItemsRaw ?? []) as any[]) {
      const uid = pi.payments?.user_id;
      if (!paidByUser.has(uid)) paidByUser.set(uid, new Set());
      paidByUser.get(uid)!.add(pi.reference_id);
    }

    // Calculate per-user pending
    const userPending = new Map<string, { usd: number; months: Set<string> }>();
    for (const item of (allLineItems ?? []) as any[]) {
      const uid = item.user_id;
      const rid = item.report_id;
      const userPaid = paidByUser.get(uid);
      if (userPaid?.has(rid)) continue;
      if (!userPending.has(uid)) userPending.set(uid, { usd: 0, months: new Set() });
      const entry = userPending.get(uid)!;
      entry.usd += Number(item.final_usd ?? 0);
      entry.months.add(rid);
    }

    const totalPendingPayments = Array.from(userPending.values()).reduce((s, e) => s + e.usd, 0);

    // Get user names for top pending
    const topUserIds = Array.from(userPending.entries())
      .sort((a, b) => b[1].usd - a[1].usd)
      .slice(0, 5)
      .map(([uid]) => uid);

    let pendingPayments: PendingPaymentSummary[] = [];
    if (topUserIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, name, avatar_url")
        .in("id", topUserIds);
      pendingPayments = topUserIds.map((uid) => {
        const u = (users ?? []).find((x: any) => x.id === uid) as any;
        const p = userPending.get(uid)!;
        return {
          userId: uid,
          userName: u?.name ?? "—",
          avatarUrl: u?.avatar_url ?? null,
          totalPendingUsd: Math.round(p.usd * 100) / 100,
          unpaidMonths: p.months.size,
        };
      });
    }

    // Total paid this month
    let paymentsQuery = supabase
      .from("payments")
      .select("total_usd")
      .gte("paid_at", monthStart);
    if (partnerId) paymentsQuery = paymentsQuery.eq("partner_id", partnerId);
    const { data: monthPayments } = await paymentsQuery;
    const totalPaidThisMonth = (monthPayments ?? []).reduce((s, p: any) => s + Number(p.total_usd ?? 0), 0);

    // Total accumulated
    let allPaymentsQuery = supabase.from("payments").select("total_usd");
    if (partnerId) allPaymentsQuery = allPaymentsQuery.eq("partner_id", partnerId);
    const { data: allPayments } = await allPaymentsQuery;
    const totalAccumulatedUsd = (allPayments ?? []).reduce((s, p: any) => s + Number(p.total_usd ?? 0), 0);

    // Partners overview
    const { data: partners } = await supabase
      .from("partners")
      .select("id, name, logo_url")
      .eq("is_active", true)
      .order("name");

    const partnersOverview: PartnerOverview[] = [];
    for (const p of (partners ?? []) as any[]) {
      if (partnerId && p.id !== partnerId) continue;
      const { data: report } = await supabase
        .from("monthly_reports")
        .select("total_usd")
        .eq("partner_id", p.id)
        .eq("report_month", monthStart)
        .single();
      const { count: memberCount } = await supabase
        .from("user_partner_roles")
        .select("id", { count: "exact", head: true })
        .eq("partner_id", p.id);
      partnersOverview.push({
        id: p.id,
        name: p.name,
        logoUrl: p.logo_url,
        currentMonthUsd: Number(report?.total_usd ?? 0),
        memberCount: memberCount ?? 0,
      });
    }

    // Unassigned users
    const { data: allUsers } = await supabase.from("users").select("id").eq("user_type", "system_user");
    const { data: assignedRoles } = await supabase.from("user_partner_roles").select("user_id");
    const assignedIds = new Set((assignedRoles ?? []).map((r: any) => r.user_id));
    const unassignedUsersCount = (allUsers ?? []).filter((u: any) => !assignedIds.has(u.id)).length;

    // Calendar events (this month)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthEndStr = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, "0")}-${String(monthEnd.getDate()).padStart(2, "0")}`;

    let reportsCalQuery = supabase
      .from("monthly_reports")
      .select("created_at, report_month, partners (name)")
      .gte("created_at", monthStart)
      .lte("created_at", monthEndStr + "T23:59:59");
    if (partnerId) reportsCalQuery = reportsCalQuery.eq("partner_id", partnerId);
    const { data: calReports } = await reportsCalQuery;

    let paymentsCalQuery = supabase
      .from("payments")
      .select("paid_at, total_usd, users!payments_user_id_fkey (name)")
      .gte("paid_at", monthStart)
      .lte("paid_at", monthEndStr + "T23:59:59");
    if (partnerId) paymentsCalQuery = paymentsCalQuery.eq("partner_id", partnerId);
    const { data: calPayments } = await paymentsCalQuery;

    const calendar: CalendarEvent[] = [
      ...(calReports ?? []).map((r: any) => ({
        date: r.created_at.substring(0, 10),
        type: "report" as const,
        label: `Reporte ${r.partners?.name ?? ""}`,
      })),
      ...(calPayments ?? []).map((p: any) => ({
        date: p.paid_at.substring(0, 10),
        type: "payment" as const,
        label: `Pago a ${p.users?.name ?? ""}`,
      })),
    ];

    // Notifications
    const notifications: Notification[] = [];

    // Recent reports
    for (const r of (calReports ?? []).slice(0, 3) as any[]) {
      notifications.push({
        id: `report-${r.created_at}`,
        type: "report_generated",
        message: `Reporte generado para ${r.partners?.name ?? "partner"}`,
        timestamp: r.created_at,
      });
    }

    // Recent payments
    for (const p of (calPayments ?? []).slice(0, 3) as any[]) {
      notifications.push({
        id: `payment-${p.paid_at}`,
        type: "payment_registered",
        message: `Pago de ${formatUsdShort(Number(p.total_usd))} a ${p.users?.name ?? "colaborador"}`,
        timestamp: p.paid_at,
      });
    }

    if (unassignedUsersCount > 0) {
      notifications.push({
        id: "unassigned",
        type: "user_unassigned",
        message: `${unassignedUsersCount} usuario(s) esperando asignacion`,
        timestamp: new Date().toISOString(),
      });
    }

    notifications.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return {
      success: true,
      data: {
        totalPendingPayments: Math.round(totalPendingPayments * 100) / 100,
        totalPaidThisMonth: Math.round(totalPaidThisMonth * 100) / 100,
        totalAccumulatedUsd: Math.round(totalAccumulatedUsd * 100) / 100,
        pendingPayments,
        partnersOverview,
        unassignedUsersCount,
        calendar,
        notifications: notifications.slice(0, 8),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

function formatUsdShort(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Get dashboard data for a collaborator.
 */
export async function getCollaboratorDashboard(
  userId: string
): Promise<{ success: true; data: CollaboratorDashboardData } | { success: false; error: string }> {
  try {
    const supabase = createServerSupabaseClient();
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    // My line items
    const { data: myItems } = await supabase
      .from("report_line_items")
      .select("final_usd, final_mxn, report_id, monthly_reports!inner (report_month)")
      .eq("user_id", userId);

    let currentMonthUsd = 0;
    let currentMonthMxn = 0;
    let totalAccumulatedUsd = 0;
    const monthlyMap = new Map<string, { totalUsd: number; totalMxn: number }>();

    for (const item of (myItems ?? []) as any[]) {
      const usd = Number(item.final_usd ?? 0);
      const mxn = Number(item.final_mxn ?? 0);
      totalAccumulatedUsd += usd;
      const rm = item.monthly_reports?.report_month;
      if (rm === currentMonth) {
        currentMonthUsd += usd;
        currentMonthMxn += mxn;
      }
      if (rm) {
        const key = rm.substring(0, 7);
        const e = monthlyMap.get(key) ?? { totalUsd: 0, totalMxn: 0 };
        e.totalUsd += usd;
        e.totalMxn += mxn;
        monthlyMap.set(key, e);
      }
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

    // Payments received
    const { data: myPayments } = await supabase
      .from("payments")
      .select("id, total_usd, total_mxn, paid_at, payment_method")
      .eq("user_id", userId)
      .order("paid_at", { ascending: false });

    const totalPaymentsReceived = (myPayments ?? []).length;
    const lastPayment = (myPayments ?? [])[0]
      ? {
          id: (myPayments as any)[0].id,
          totalUsd: Number((myPayments as any)[0].total_usd),
          totalMxn: Number((myPayments as any)[0].total_mxn),
          paidAt: (myPayments as any)[0].paid_at,
          paymentMethod: (myPayments as any)[0].payment_method,
        }
      : null;

    // Pending payments (unpaid reports)
    const { data: paidItems } = await supabase
      .from("payment_items")
      .select("reference_id, payments!inner (user_id)")
      .eq("payments.user_id", userId)
      .eq("item_type", "report_earnings");
    const paidReportIds = new Set((paidItems ?? []).map((pi: any) => pi.reference_id));

    let pendingPaymentUsd = 0;
    for (const item of (myItems ?? []) as any[]) {
      if (!paidReportIds.has(item.report_id)) {
        pendingPaymentUsd += Number(item.final_usd ?? 0);
      }
    }

    // Pending concepts
    const { data: pendingConcepts } = await supabase
      .from("payment_concepts")
      .select("amount_usd")
      .eq("user_id", userId)
      .eq("is_paid", false);
    const pendingConceptsUsd = (pendingConcepts ?? []).reduce(
      (s, c: any) => s + Number(c.amount_usd ?? 0), 0
    );

    // My products
    const { data: distributions } = await supabase
      .from("product_distributions")
      .select("percentage_share, products!inner (name, is_active, product_types (name))")
      .eq("user_id", userId);
    const myProducts: CollaboratorProduct[] = ((distributions ?? []) as any[])
      .filter((d) => d.products?.is_active)
      .map((d) => ({
        name: d.products.name,
        productType: d.products.product_types?.name ?? "Sin tipo",
        percentageShare: Number(d.percentage_share),
      }));

    // Calendar
    const calendar: CalendarEvent[] = (myPayments ?? [])
      .filter((p: any) => p.paid_at?.startsWith(now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0")))
      .map((p: any) => ({
        date: p.paid_at.substring(0, 10),
        type: "payment" as const,
        label: `Pago recibido $${Number(p.total_usd).toFixed(2)}`,
      }));

    // Notifications
    const notifications: Notification[] = [];
    for (const p of (myPayments ?? []).slice(0, 3) as any[]) {
      notifications.push({
        id: `pay-${p.id}`,
        type: "payment_received",
        message: `Pago recibido de $${Number(p.total_usd).toFixed(2)} USD`,
        timestamp: p.paid_at,
      });
    }
    if (pendingPaymentUsd > 0) {
      notifications.push({
        id: "pending",
        type: "payment_received",
        message: `Tienes $${pendingPaymentUsd.toFixed(2)} USD pendientes de cobro`,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      success: true,
      data: {
        stats: {
          currentMonthUsd: Math.round(currentMonthUsd * 100) / 100,
          currentMonthMxn: Math.round(currentMonthMxn * 100) / 100,
          totalAccumulatedUsd: Math.round(totalAccumulatedUsd * 100) / 100,
          totalPaymentsReceived,
          assignedProducts: myProducts.length,
        },
        monthlyTrends,
        pendingPaymentUsd: Math.round(pendingPaymentUsd * 100) / 100,
        pendingConceptsUsd: Math.round(pendingConceptsUsd * 100) / 100,
        lastPayment,
        myProducts,
        calendar,
        notifications: notifications.slice(0, 8),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
