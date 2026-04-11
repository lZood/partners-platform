"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateReceiptPDF } from "@/lib/pdf/receipt-pdf";
import { uploadBuffer } from "@/lib/supabase/storage-server";
import { createNotification } from "@/actions/notifications";
import { sendPaymentNotificationEmail } from "@/lib/email";

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
        .select("amount_usd")
        .eq("user_id", userId)
        .eq("is_paid", false);
      if (partnerId) conceptsQuery = conceptsQuery.eq("partner_id", partnerId);

      const { data: concepts } = await conceptsQuery;
      const unpaidConceptsUsd = (concepts ?? []).reduce(
        (sum, c: any) => sum + Number(c.amount_usd ?? 0),
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
    const unpaidConcepts = (concepts ?? []).map((c: any) => ({
      id: c.id,
      conceptType: c.concept_type,
      description: c.description,
      amountUsd: Number(c.amount_usd),
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
 * Register a payment for a user.
 */
export async function registerPayment(
  data: {
    partnerId: string;
    userId: string;
    reportIds: string[];
    conceptIds: string[];
    exchangeRate: number;
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
      .select("id, concept_type, description, amount_usd, partners (name)")
      .eq("id", conceptId)
      .single();

    if (concept) {
      const amountUsd = Number((concept as any).amount_usd);
      const amountMxn = amountUsd * data.exchangeRate;
      totalUsd += amountUsd;
      totalMxn += amountMxn;

      const typeLabel = {
        commission: "Comision",
        work: "Trabajo",
        bonus: "Bono",
        deduction: "Deduccion",
      }[(concept as any).concept_type] ?? (concept as any).concept_type;

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

  // Create payment
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      partner_id: data.partnerId,
      user_id: data.userId,
      total_usd: Math.round(totalUsd * 100) / 100,
      total_mxn: Math.round(totalMxn * 100) / 100,
      exchange_rate: data.exchangeRate,
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

  // Generate and store receipt PDF
  try {
    // Get user and partner info for receipt
    const { data: payUser } = await supabase
      .from("users")
      .select("name, email")
      .eq("id", data.userId)
      .single();

    const { data: payPartner } = await supabase
      .from("partners")
      .select("name, logo_url")
      .eq("id", data.partnerId)
      .single();

    const pdfBuffer = await generateReceiptPDF({
      paymentId,
      partnerName: (payPartner as any)?.name ?? "Partner",
      partnerLogoUrl: (payPartner as any)?.logo_url ?? null,
      userName: (payUser as any)?.name ?? "—",
      userEmail: (payUser as any)?.email ?? null,
      totalUsd: Math.round(totalUsd * 100) / 100,
      totalMxn: Math.round(totalMxn * 100) / 100,
      exchangeRate: data.exchangeRate,
      paymentMethod: data.paymentMethod ?? null,
      notes: data.notes ?? null,
      paidAt: new Date().toISOString(),
      createdByName: null,
      items: items.map((i) => ({
        description: i.description,
        amountUsd: i.amount_usd,
        amountMxn: i.amount_mxn,
      })),
    });

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
        link: "/my-earnings",
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
