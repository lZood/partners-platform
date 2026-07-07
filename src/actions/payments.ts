"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  generateReceiptPDF,
  type PaymentReceiptData,
  type PaymentReceiptProductRow,
  type PaymentReceiptConceptRow,
} from "@/lib/pdf/receipt-pdf";
import { uploadBuffer, deleteFile } from "@/lib/supabase/storage-server";
import { createNotification } from "@/actions/notifications";
import { sendPaymentNotificationEmail } from "@/lib/email";
import { formatMonth, signedConceptAmount } from "@/lib/utils";

export type PaymentActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

export interface CollaboratorPaymentSummary {
  userId: string;
  userName: string;
  userEmail: string | null;
  avatarUrl: string | null;
  partners: string[];
  unpaidEarningsUsd: number;
  unpaidConceptsUsd: number;
  totalPendingUsd: number;
  unpaidMonths: number;
  lastPaymentDate: string | null;
}

export interface UserPaymentDetail {
  userId: string;
  userName: string;
  userEmail: string | null;
  avatarUrl: string | null;
  // Unpaid earnings grouped by report month
  unpaidEarnings: {
    reportId: string;
    reportMonth: string;
    partnerName: string;
    partnerId: string;
    exchangeRate: number;
    totalFinalUsd: number;
    totalFinalMxn: number;
    isLocked: boolean;
  }[];
  // Unpaid extra concepts
  unpaidConcepts: {
    id: string;
    conceptType: string;
    description: string;
    amountUsd: number;
    amountMxn: number;
    exchangeRate: number;
    conceptDate: string;
    partnerName: string;
    partnerId: string;
  }[];
  // Payment history
  payments: {
    id: string;
    totalUsd: number;
    totalMxn: number;
    exchangeRate: number;
    paymentMethod: string | null;
    notes: string | null;
    receiptUrl: string | null;
    paidAt: string;
    createdByName: string | null;
    items: {
      id: string;
      itemType: string;
      description: string;
      amountUsd: number;
      amountMxn: number;
    }[];
  }[];
}

/**
 * Get payment summary for all collaborators visible to the current admin.
 */
export async function getPaymentsSummary(
  partnerId?: string
): Promise<PaymentActionResult> {
  try {
    const supabase = createServerSupabaseClient();

    // Get all users with roles
    let usersQuery = supabase
      .from("user_partner_roles")
      .select(`
        user_id,
        partner_id,
        partners (name),
        users (id, name, email, avatar_url)
      `);
    if (partnerId) usersQuery = usersQuery.eq("partner_id", partnerId);

    const { data: roles } = await usersQuery;
    if (!roles) return { success: true, data: [] };

    // Group by user
    const userMap = new Map<string, {
      user: any;
      partners: string[];
      partnerIds: string[];
    }>();

    for (const role of roles as any[]) {
      const uid = role.user_id;
      if (!userMap.has(uid)) {
        userMap.set(uid, {
          user: role.users,
          partners: [],
          partnerIds: [],
        });
      }
      const entry = userMap.get(uid)!;
      entry.partners.push(role.partners?.name ?? "—");
      entry.partnerIds.push(role.partner_id);
    }

    // For each user, calculate unpaid earnings and concepts
    const summaries: CollaboratorPaymentSummary[] = [];

    for (const [userId, { user, partners, partnerIds }] of userMap) {
      // Get all report line items for this user
      const { data: lineItems } = await supabase
        .from("report_line_items")
        .select(`
          final_usd,
          report_id,
          monthly_reports!inner (id, report_month, partner_id)
        `)
        .eq("user_id", userId);

      // Get all paid report IDs for this user
      const { data: paidItems } = await supabase
        .from("payment_items")
        .select(`
          reference_id,
          payments!inner (user_id)
        `)
        .eq("payments.user_id", userId)
        .eq("item_type", "report_earnings");

      const paidReportIds = new Set(
        (paidItems ?? []).map((pi: any) => pi.reference_id)
      );

      // Calculate unpaid earnings
      const unpaidReportMonths = new Set<string>();
      let unpaidEarningsUsd = 0;
      for (const item of (lineItems ?? []) as any[]) {
        const report = item.monthly_reports;
        if (partnerId && report.partner_id !== partnerId) continue;
        if (!paidReportIds.has(report.id)) {
          unpaidEarningsUsd += Number(item.final_usd ?? 0);
          unpaidReportMonths.add(report.report_month);
        }
      }

      // Unpaid concepts
      let conceptsQuery = supabase
        .from("payment_concepts")
        .select("concept_type, amount_usd")
        .eq("user_id", userId)
        .eq("is_paid", false);
      if (partnerId) conceptsQuery = conceptsQuery.eq("partner_id", partnerId);

      const { data: concepts } = await conceptsQuery;
      const unpaidConceptsUsd = (concepts ?? []).reduce(
        (sum, c: any) =>
          sum + signedConceptAmount(c.concept_type, Number(c.amount_usd ?? 0)),
        0
      );

      // Last payment
      const { data: lastPayment } = await supabase
        .from("payments")
        .select("paid_at")
        .eq("user_id", userId)
        .order("paid_at", { ascending: false })
        .limit(1);

      summaries.push({
        userId,
        userName: user?.name ?? "—",
        userEmail: user?.email ?? null,
        avatarUrl: user?.avatar_url ?? null,
        partners,
        unpaidEarningsUsd: Math.round(unpaidEarningsUsd * 100) / 100,
        unpaidConceptsUsd: Math.round(unpaidConceptsUsd * 100) / 100,
        totalPendingUsd:
          Math.round((unpaidEarningsUsd + unpaidConceptsUsd) * 100) / 100,
        unpaidMonths: unpaidReportMonths.size,
        lastPaymentDate: (lastPayment as any)?.[0]?.paid_at ?? null,
      });
    }

    // Sort by total pending (highest first)
    summaries.sort((a, b) => b.totalPendingUsd - a.totalPendingUsd);

    return { success: true, data: summaries };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get detailed payment info for a specific user.
 */
export async function getUserPaymentDetail(
  userId: string,
  partnerId?: string
): Promise<PaymentActionResult> {
  try {
    const supabase = createServerSupabaseClient();

    // User info
    const { data: user } = await supabase
      .from("users")
      .select("id, name, email, avatar_url")
      .eq("id", userId)
      .single();

    if (!user) return { success: false, error: "Usuario no encontrado" };

    // Get reports with line items for this user
    const { data: lineItems } = await supabase
      .from("report_line_items")
      .select(`
        final_usd, final_mxn, report_id,
        monthly_reports!inner (
          id, report_month, partner_id, is_locked,
          partners (name),
          exchange_rates (usd_to_mxn)
        )
      `)
      .eq("user_id", userId);

    // Get paid report IDs
    const { data: paidItems } = await supabase
      .from("payment_items")
      .select(`
        reference_id,
        payments!inner (user_id)
      `)
      .eq("payments.user_id", userId)
      .eq("item_type", "report_earnings");

    const paidReportIds = new Set(
      (paidItems ?? []).map((pi: any) => pi.reference_id)
    );

    // Group line items by report
    const reportMap = new Map<string, any>();
    for (const item of (lineItems ?? []) as any[]) {
      const report = item.monthly_reports;
      if (partnerId && report.partner_id !== partnerId) continue;
      if (paidReportIds.has(report.id)) continue;

      if (!reportMap.has(report.id)) {
        reportMap.set(report.id, {
          reportId: report.id,
          reportMonth: report.report_month,
          partnerName: report.partners?.name ?? "—",
          partnerId: report.partner_id,
          exchangeRate: Number(report.exchange_rates?.usd_to_mxn ?? 1),
          totalFinalUsd: 0,
          totalFinalMxn: 0,
          isLocked: report.is_locked,
        });
      }
      const entry = reportMap.get(report.id)!;
      entry.totalFinalUsd += Number(item.final_usd ?? 0);
      entry.totalFinalMxn += Number(item.final_mxn ?? 0);
    }

    const unpaidEarnings = Array.from(reportMap.values())
      .map((e) => ({
        ...e,
        totalFinalUsd: Math.round(e.totalFinalUsd * 100) / 100,
        totalFinalMxn: Math.round(e.totalFinalMxn * 100) / 100,
      }))
      .sort((a, b) => a.reportMonth.localeCompare(b.reportMonth));

    // Unpaid concepts
    let conceptsQuery = supabase
      .from("payment_concepts")
      .select("id, concept_type, description, amount_usd, concept_date, partner_id, partners (name)")
      .eq("user_id", userId)
      .eq("is_paid", false)
      .order("concept_date", { ascending: false });
    if (partnerId) conceptsQuery = conceptsQuery.eq("partner_id", partnerId);

    const { data: concepts } = await conceptsQuery;
    const conceptRates = await getConceptExchangeRates(
      supabase,
      (concepts ?? []) as any[]
    );
    const unpaidConcepts = (concepts ?? []).map((c: any) => ({
      id: c.id,
      conceptType: c.concept_type,
      description: c.description,
      amountUsd: Number(c.amount_usd),
      amountMxn:
        Math.round(
          Number(c.amount_usd) *
            getConceptRate(conceptRates, c.partner_id, c.concept_date) *
            100
        ) / 100,
      exchangeRate: getConceptRate(conceptRates, c.partner_id, c.concept_date),
      conceptDate: c.concept_date,
      partnerName: c.partners?.name ?? "—",
      partnerId: c.partner_id,
    }));

    // Payment history
    let paymentsQuery = supabase
      .from("payments")
      .select(`
        id, total_usd, total_mxn, exchange_rate, payment_method, notes, receipt_url, paid_at,
        created_by_user:users!payments_created_by_fkey (name),
        payment_items (id, item_type, description, amount_usd, amount_mxn)
      `)
      .eq("user_id", userId)
      .order("paid_at", { ascending: false })
      .limit(20);
    if (partnerId) paymentsQuery = paymentsQuery.eq("partner_id", partnerId);

    const { data: paymentsData } = await paymentsQuery;
    const payments = (paymentsData ?? []).map((p: any) => ({
      id: p.id,
      totalUsd: Number(p.total_usd),
      totalMxn: Number(p.total_mxn),
      exchangeRate: Number(p.exchange_rate),
      paymentMethod: p.payment_method,
      notes: p.notes,
      receiptUrl: p.receipt_url,
      paidAt: p.paid_at,
      createdByName: p.created_by_user?.name ?? null,
      items: (p.payment_items ?? []).map((i: any) => ({
        id: i.id,
        itemType: i.item_type,
        description: i.description,
        amountUsd: Number(i.amount_usd),
        amountMxn: Number(i.amount_mxn),
      })),
    }));

    return {
      success: true,
      data: {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        avatarUrl: user.avatar_url,
        unpaidEarnings,
        unpaidConcepts,
        payments,
      } as UserPaymentDetail,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Build the full data set for a payment receipt (PDF/Excel).
 *
 * Expands the aggregated `report_earnings` payment items back into their
 * underlying per-product `report_line_items` so the receipt can show the
 * distribution (percentage + product type) the collaborator was paid for.
 * Extra concepts are surfaced separately. Best-effort fetches the partner
 * logo. Returns null if the payment does not exist.
 */
export async function getPaymentReceiptData(
  paymentId: string
): Promise<PaymentReceiptData | null> {
  const supabase = createServerSupabaseClient();

  const { data: payment } = await supabase
    .from("payments")
    .select(`
      id, total_usd, total_mxn, exchange_rate, payment_method, notes, paid_at, user_id,
      partners (name, logo_url),
      users!payments_user_id_fkey (name, email),
      created_by_user:users!payments_created_by_fkey (name),
      payment_items (item_type, reference_id, description, amount_usd, amount_mxn)
    `)
    .eq("id", paymentId)
    .single();

  if (!payment) return null;
  const p = payment as any;
  const rate = Number(p.exchange_rate) || 1;

  const items = (p.payment_items ?? []) as any[];
  const reportItems = items.filter(
    (i) => i.item_type === "report_earnings" && i.reference_id
  );
  const conceptItems = items.filter((i) => i.item_type !== "report_earnings");
  const reportIds = reportItems.map((i) => i.reference_id);

  const products: PaymentReceiptProductRow[] = [];
  const periodSet = new Set<string>();

  if (reportIds.length > 0) {
    const { data: lineItems } = await supabase
      .from("report_line_items")
      .select(`
        product_name, percentage_applied, final_usd, final_mxn, report_id,
        products (product_types (name)),
        monthly_reports!inner (report_month)
      `)
      .in("report_id", reportIds)
      .eq("user_id", p.user_id);

    for (const li of (lineItems ?? []) as any[]) {
      const period = li.monthly_reports?.report_month
        ? formatMonth(li.monthly_reports.report_month)
        : "";
      if (period) periodSet.add(period);

      const pct =
        li.percentage_applied != null ? Number(li.percentage_applied) : null;
      const type = li.products?.product_types?.name ?? null;
      const distParts: string[] = [];
      if (pct != null) distParts.push(formatPctShort(pct));
      if (type) distParts.push(type);

      products.push({
        product: li.product_name ?? "Producto",
        distribution: distParts.join(" · ") || "—",
        percentage: pct,
        productType: type,
        amountUsd: Number(li.final_usd ?? 0),
        amountMxn: Number(li.final_mxn ?? 0),
        salesPeriod: period,
      });
    }
  }

  // Fallback: a paid report with no resolvable line items still needs to
  // appear so the totals reconcile — surface the aggregated payment item.
  if (products.length === 0 && reportItems.length > 0) {
    for (const ri of reportItems) {
      products.push({
        product: ri.description ?? "Comisiones",
        distribution: "—",
        percentage: null,
        productType: null,
        amountUsd: Number(ri.amount_usd ?? 0),
        amountMxn: Number(ri.amount_mxn ?? 0),
        salesPeriod: "",
      });
    }
  }

  products.sort((a, b) =>
    a.salesPeriod === b.salesPeriod
      ? a.product.localeCompare(b.product)
      : a.salesPeriod.localeCompare(b.salesPeriod)
  );

  const concepts: PaymentReceiptConceptRow[] = conceptItems.map((c) => {
    const amountUsd = Number(c.amount_usd ?? 0);
    const isDeduction = amountUsd < 0 || /deduc/i.test(c.description ?? "");
    return {
      description: c.description ?? "Concepto",
      amountUsd,
      amountMxn: Number(c.amount_mxn ?? 0),
      isDeduction,
    };
  });

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const productsSubtotalUsd = round2(
    products.reduce((s, r) => s + r.amountUsd, 0)
  );
  const productsSubtotalMxn = round2(
    products.reduce((s, r) => s + r.amountMxn, 0)
  );
  const conceptsSubtotalUsd = round2(
    concepts.reduce((s, c) => s + c.amountUsd, 0)
  );
  const conceptsSubtotalMxn = round2(
    concepts.reduce((s, c) => s + c.amountMxn, 0)
  );

  // Best-effort partner logo fetch for the PDF header.
  let partnerLogo: Buffer | null = null;
  const logoUrl = p.partners?.logo_url ?? null;
  if (logoUrl) {
    try {
      const res = await fetch(logoUrl);
      if (res.ok) {
        partnerLogo = Buffer.from(await res.arrayBuffer());
      }
    } catch {
      partnerLogo = null;
    }
  }

  return {
    paymentId: p.id,
    partnerName: p.partners?.name ?? "Partner",
    partnerLogoUrl: logoUrl,
    partnerLogo,
    userName: p.users?.name ?? "—",
    userEmail: p.users?.email ?? null,
    paidAt: p.paid_at,
    salesPeriods: Array.from(periodSet).sort(),
    exchangeRate: rate,
    products,
    concepts,
    productsSubtotalUsd,
    productsSubtotalMxn,
    conceptsSubtotalUsd,
    conceptsSubtotalMxn,
    totalUsd: Number(p.total_usd),
    totalMxn: Number(p.total_mxn),
    paymentMethod: p.payment_method,
    notes: p.notes,
    createdByName: p.created_by_user?.name ?? null,
  };
}

/** Format a distribution percentage without trailing ".00" (e.g. "20%", "12.5%"). */
function formatPctShort(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const str = Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace(/0+$/, "");
  return `${str}%`;
}

function monthStart(date: string): string {
  return `${date.substring(0, 7)}-01`;
}

function conceptRateKey(partnerId: string, date: string): string {
  return `${partnerId}:${monthStart(date)}`;
}

async function getConceptExchangeRates(
  supabase: any,
  concepts: any[]
): Promise<Map<string, number>> {
  const keys = new Set<string>();
  const partnerIds = new Set<string>();
  const months = new Set<string>();

  for (const concept of concepts) {
    if (!concept.partner_id || !concept.concept_date) continue;
    const month = monthStart(concept.concept_date);
    keys.add(`${concept.partner_id}:${month}`);
    partnerIds.add(concept.partner_id);
    months.add(month);
  }

  const rates = new Map<string, number>();
  if (keys.size === 0) return rates;

  const { data } = await supabase
    .from("exchange_rates")
    .select("partner_id, month, usd_to_mxn")
    .in("partner_id", Array.from(partnerIds))
    .in("month", Array.from(months));

  for (const rate of (data ?? []) as any[]) {
    rates.set(
      `${rate.partner_id}:${monthStart(rate.month)}`,
      Number(rate.usd_to_mxn)
    );
  }

  for (const key of Array.from(keys)) {
    if (rates.has(key)) continue;
    const [partnerId, month] = key.split(":");
    rates.set(key, await getExchangeRateForConcept(supabase, partnerId, month));
  }

  return rates;
}

function getConceptRate(
  rates: Map<string, number>,
  partnerId: string,
  date: string
): number {
  return rates.get(conceptRateKey(partnerId, date)) ?? 1;
}

async function getExchangeRateForConcept(
  supabase: any,
  partnerId: string,
  date: string
): Promise<number> {
  const month = monthStart(date);
  const { data } = await supabase
    .from("exchange_rates")
    .select("usd_to_mxn")
    .eq("partner_id", partnerId)
    .lte("month", month)
    .order("month", { ascending: false })
    .limit(1);

  const rate = (data as any)?.[0]?.usd_to_mxn;
  if (rate != null) return Number(rate);

  const { data: latestRate } = await supabase
    .from("exchange_rates")
    .select("usd_to_mxn")
    .eq("partner_id", partnerId)
    .order("month", { ascending: false })
    .limit(1);

  return Number((latestRate as any)?.[0]?.usd_to_mxn ?? 1);
}

/**
 * Create a payment concept (extra charge/bonus/deduction).
 */
export async function createPaymentConcept(
  formData: FormData
): Promise<PaymentActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: appUser } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!appUser) return { success: false, error: "Usuario no encontrado" };

  const partnerId = formData.get("partnerId") as string;
  const userId = formData.get("userId") as string;
  const conceptType = formData.get("conceptType") as string;
  const description = formData.get("description") as string;
  const amountUsd = parseFloat(formData.get("amountUsd") as string);
  const conceptDate = (formData.get("conceptDate") as string) || new Date().toISOString().split("T")[0];

  if (!partnerId || !userId || !conceptType || !description || isNaN(amountUsd)) {
    return { success: false, error: "Todos los campos son requeridos" };
  }

  const { error } = await supabase.from("payment_concepts").insert({
    partner_id: partnerId,
    user_id: userId,
    concept_type: conceptType,
    description,
    amount_usd: amountUsd,
    concept_date: conceptDate,
    created_by: appUser.id,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath(`/payments/${userId}`);
  return { success: true };
}

/**
 * Delete a payment concept.
 */
export async function deletePaymentConcept(
  conceptId: string,
  userId: string
): Promise<PaymentActionResult> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("payment_concepts")
    .delete()
    .eq("id", conceptId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/payments/${userId}`);
  return { success: true };
}

/**
 * Revert a registered payment back to pending.
 *
 * Undoes a payment so its underlying reports and extra concepts become
 * unpaid again — used when a payment was registered by mistake or needs a
 * modification. This:
 *   - restores any linked extra concepts to `is_paid = false`,
 *   - deletes the payment items (which is what marks reports as paid), so the
 *     reports reappear as pending earnings,
 *   - deletes the payment record itself, and
 *   - best-effort removes the stored receipt PDF.
 */
export async function revertPayment(
  paymentId: string,
  userId: string
): Promise<PaymentActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: payment } = await supabase
    .from("payments")
    .select("id, user_id, payment_items (item_type, reference_id)")
    .eq("id", paymentId)
    .single();

  if (!payment) return { success: false, error: "Pago no encontrado" };

  const items = ((payment as any).payment_items ?? []) as any[];

  // Restore linked extra concepts to pending.
  const conceptIds = items
    .filter((i) => i.item_type === "extra_concept" && i.reference_id)
    .map((i) => i.reference_id);

  if (conceptIds.length > 0) {
    await supabase
      .from("payment_concepts")
      .update({ is_paid: false })
      .in("id", conceptIds);
  }

  // Remove the payment items first so the reports are no longer considered
  // paid, then delete the payment record.
  await supabase.from("payment_items").delete().eq("payment_id", paymentId);

  const { error: deleteError } = await supabase
    .from("payments")
    .delete()
    .eq("id", paymentId);

  if (deleteError) return { success: false, error: deleteError.message };

  // Best-effort cleanup of the stored receipt PDF (uploaded as `<id>.pdf`).
  try {
    await deleteFile("receipts", `${paymentId}.pdf`);
  } catch {
    // Non-fatal: the payment is already reverted.
  }

  revalidatePath(`/payments/${userId}`);
  revalidatePath("/payments");
  return { success: true };
}

/**
 * Register a payment for a user.
 */
export async function registerPayment(
  data: {
    partnerId: string;
    userId: string;
    reportIds: string[];
    conceptIds: string[];
    exchangeRate?: number;
    paymentMethod?: string;
    notes?: string;
  }
): Promise<PaymentActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: appUser } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!appUser) return { success: false, error: "Usuario no encontrado" };

  // Calculate totals from selected reports
  let totalUsd = 0;
  let totalMxn = 0;
  const items: { item_type: string; reference_id: string; description: string; amount_usd: number; amount_mxn: number }[] = [];

  // Report earnings
  for (const reportId of data.reportIds) {
    const { data: lineItems } = await supabase
      .from("report_line_items")
      .select("final_usd, final_mxn, monthly_reports!inner (report_month, partners (name))")
      .eq("report_id", reportId)
      .eq("user_id", data.userId);

    let reportUsd = 0;
    let reportMxn = 0;
    let reportMonth = "";
    let partnerName = "";

    for (const item of (lineItems ?? []) as any[]) {
      reportUsd += Number(item.final_usd ?? 0);
      reportMxn += Number(item.final_mxn ?? 0);
      reportMonth = item.monthly_reports?.report_month ?? "";
      partnerName = item.monthly_reports?.partners?.name ?? "";
    }

    if (reportUsd > 0) {
      totalUsd += reportUsd;
      totalMxn += reportMxn;
      items.push({
        item_type: "report_earnings",
        reference_id: reportId,
        description: `Comisiones ${reportMonth.substring(0, 7)} - ${partnerName}`,
        amount_usd: Math.round(reportUsd * 100) / 100,
        amount_mxn: Math.round(reportMxn * 100) / 100,
      });
    }
  }

  // Extra concepts
  for (const conceptId of data.conceptIds) {
    const { data: concept } = await supabase
      .from("payment_concepts")
      .select("id, concept_type, description, amount_usd, concept_date, partner_id, partners (name)")
      .eq("id", conceptId)
      .single();

    if (concept) {
      const conceptType = String((concept as any).concept_type);
      // Deductions reduce the payment total, so use the signed amount for
      // both the running totals and the stored payment item.
      const amountUsd = signedConceptAmount(
        conceptType,
        Number((concept as any).amount_usd)
      );
      const conceptRate = await getExchangeRateForConcept(
        supabase,
        (concept as any).partner_id,
        (concept as any).concept_date
      );
      const amountMxn = amountUsd * conceptRate;
      totalUsd += amountUsd;
      totalMxn += amountMxn;

      const typeLabels: Record<string, string> = {
        commission: "Comision",
        work: "Trabajo",
        bonus: "Bono",
        deduction: "Deduccion",
      };
      const typeLabel = typeLabels[conceptType] ?? conceptType;

      items.push({
        item_type: "extra_concept",
        reference_id: conceptId,
        description: `${typeLabel}: ${(concept as any).description}`,
        amount_usd: Math.round(amountUsd * 100) / 100,
        amount_mxn: Math.round(amountMxn * 100) / 100,
      });
    }
  }

  if (items.length === 0) {
    return { success: false, error: "No hay items seleccionados" };
  }

  const effectiveExchangeRate =
    totalUsd !== 0 ? Math.round((totalMxn / totalUsd) * 1000000) / 1000000 : 1;

  // Create payment
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      partner_id: data.partnerId,
      user_id: data.userId,
      total_usd: Math.round(totalUsd * 100) / 100,
      total_mxn: Math.round(totalMxn * 100) / 100,
      exchange_rate: effectiveExchangeRate,
      payment_method: data.paymentMethod || null,
      notes: data.notes || null,
      created_by: appUser.id,
    })
    .select()
    .single();

  if (paymentError) return { success: false, error: paymentError.message };

  // Insert payment items
  const paymentItems = items.map((item) => ({
    payment_id: (payment as any).id,
    ...item,
  }));

  const { error: itemsError } = await supabase
    .from("payment_items")
    .insert(paymentItems);

  if (itemsError) return { success: false, error: itemsError.message };

  // Mark concepts as paid
  if (data.conceptIds.length > 0) {
    await supabase
      .from("payment_concepts")
      .update({ is_paid: true })
      .in("id", data.conceptIds);
  }

  const paymentId = (payment as any).id;

  // Generate and store receipt PDF (redesigned layout with per-product
  // distribution breakdown). Reuses the shared receipt-data builder so the
  // stored PDF matches the on-demand PDF/Excel exports exactly.
  try {
    const receiptData = await getPaymentReceiptData(paymentId);
    if (receiptData) {
      const pdfBuffer = await generateReceiptPDF(receiptData);

      const uploadResult = await uploadBuffer(
        "receipts",
        `${paymentId}.pdf`,
        pdfBuffer
      );

      if ("url" in uploadResult) {
        await supabase
          .from("payments")
          .update({ receipt_url: uploadResult.url })
          .eq("id", paymentId);
      }
    }
  } catch (pdfError) {
    // Don't fail the payment if PDF generation fails
    console.error("Receipt PDF generation failed:", pdfError);
  }

  // Notify the collaborator
  try {
    const { data: payUser } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("id", data.userId)
      .single();

    if (payUser) {
      const pu = payUser as any;
      await createNotification({
        userId: pu.id,
        type: "payment_received",
        title: "Pago recibido",
        message: `Se registro un pago de $${Math.round(totalUsd * 100) / 100} USD a tu favor.`,
        link: "/my-income",
      });

      if (pu.email) {
        sendPaymentNotificationEmail({
          to: pu.email,
          userName: pu.name,
          totalUsd: Math.round(totalUsd * 100) / 100,
          totalMxn: Math.round(totalMxn * 100) / 100,
          paymentMethod: data.paymentMethod ?? null,
          paidAt: new Date().toISOString(),
        }).catch((err) => console.error("Payment email failed:", err));
      }
    }
  } catch (notifError) {
    console.error("Payment notification error (non-fatal):", notifError);
  }

  revalidatePath(`/payments/${data.userId}`);
  revalidatePath("/payments");
  return { success: true, data: { paymentId } };
}
