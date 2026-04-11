"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { applyCascadeTaxes } from "@/lib/calculations/cascade-tax";
import { createNotificationsBatch } from "@/actions/notifications";
import { sendReportNotificationEmail } from "@/lib/email";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

interface CsvProductRow {
  productName: string;
  amountUsd: number;
}

interface GenerateReportInput {
  partnerId: string;
  reportMonth: string; // YYYY-MM-01
  usdToMxn: number;
  rows: CsvProductRow[];
  filename: string;
}

/**
 * Generate a monthly report from parsed CSV data.
 * This is the core business logic:
 * 1. Upsert exchange rate
 * 2. Match products (or skip unmatched)
 * 3. Validate distributions (100% each)
 * 4. Apply cascade taxes per partner
 * 5. Calculate user earnings
 * 6. Create monthly_report + report_line_items
 */
export async function generateReport(
  input: GenerateReportInput
): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  // Get app user id
  const { data: appUser } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!appUser) return { success: false, error: "Usuario no encontrado" };

  const { partnerId, reportMonth, usdToMxn, rows, filename } = input;

  // 1. Upsert exchange rate
  const { data: exchangeRate, error: erError } = await supabase
    .from("exchange_rates")
    .upsert(
      { partner_id: partnerId, month: reportMonth, usd_to_mxn: usdToMxn },
      { onConflict: "partner_id,month" }
    )
    .select()
    .single();

  if (erError) return { success: false, error: `Error guardando tipo de cambio: ${erError.message}` };

  // 2. Check if report already exists for this month
  const { data: existingReport } = await supabase
    .from("monthly_reports")
    .select("id, is_locked")
    .eq("partner_id", partnerId)
    .eq("report_month", reportMonth)
    .single();

  if (existingReport?.is_locked) {
    return {
      success: false,
      error: "El reporte de este mes ya esta congelado. No se puede reemplazar.",
    };
  }

  // If exists and not locked, save adjustments, delete old report, then reassign
  let savedAdjustments: any[] = [];
  if (existingReport) {
    // Save adjustments before deleting (CASCADE would remove them)
    const { data: existingAdjustments } = await supabase
      .from("adjustments")
      .select("*")
      .eq("monthly_report_id", existingReport.id);
    savedAdjustments = existingAdjustments ?? [];

    // Delete old line items and report (adjustments cascade-deleted)
    await supabase
      .from("report_line_items")
      .delete()
      .eq("report_id", existingReport.id);
    await supabase
      .from("monthly_reports")
      .delete()
      .eq("id", existingReport.id);
  }

  // 3. Get partner's active taxes (ordered)
  const { data: taxes } = await supabase
    .from("taxes")
    .select("id, name, percentage_rate, priority_order")
    .eq("partner_id", partnerId)
    .eq("is_active", true)
    .order("priority_order", { ascending: true });

  const taxInputs = (taxes ?? []).map((t) => ({
    name: t.name,
    rate: Number(t.percentage_rate),
    order: t.priority_order,
  }));

  // 4. Get all partner products with distributions
  const { data: products } = await supabase
    .from("products")
    .select(
      `
      id,
      name,
      product_distributions (
        user_id,
        percentage_share,
        users (id, name)
      )
    `
    )
    .eq("partner_id", partnerId)
    .eq("is_active", true);

  const productMap = new Map(
    (products ?? []).map((p: any) => [p.name.toLowerCase().trim(), p])
  );

  // 5. Process each CSV row
  const lineItems: any[] = [];
  const errors: string[] = [];
  let totalUsd = 0;
  let totalMxn = 0;

  for (const row of rows) {
    const product = productMap.get(row.productName.toLowerCase().trim());
    if (!product) {
      errors.push(`Producto "${row.productName}" no encontrado en la base de datos`);
      continue;
    }

    const distributions = product.product_distributions ?? [];
    const distTotal = distributions.reduce(
      (sum: number, d: any) => sum + Number(d.percentage_share),
      0
    );

    if (Math.abs(distTotal - 100) > 0.01) {
      errors.push(
        `Producto "${row.productName}": distribucion suma ${distTotal}%, debe ser 100%`
      );
      continue;
    }

    // Calculate each user's share
    for (const dist of distributions) {
      const userShare = row.amountUsd * (Number(dist.percentage_share) / 100);
      const taxResult = applyCascadeTaxes(userShare, taxInputs);
      const finalUsd = taxResult.netAmount;
      const finalMxn = Math.round(finalUsd * usdToMxn * 1000000) / 1000000;

      lineItems.push({
        user_id: dist.user_id,
        product_id: product.id,
        product_name: product.name,
        percentage_applied: Number(dist.percentage_share),
        gross_usd: Math.round(userShare * 1000000) / 1000000,
        after_taxes_usd: finalUsd,
        tax_breakdown: taxResult.breakdown,
        adjustments_usd: 0,
        final_usd: finalUsd,
        final_mxn: finalMxn,
      });

      totalUsd += finalUsd;
      totalMxn += finalMxn;
    }
  }

  if (errors.length > 0 && lineItems.length === 0) {
    return {
      success: false,
      error: `No se pudo procesar ningun producto:\n${errors.join("\n")}`,
    };
  }

  // 6. Create monthly report
  const { data: report, error: reportError } = await supabase
    .from("monthly_reports")
    .insert({
      partner_id: partnerId,
      report_month: reportMonth,
      exchange_rate_id: exchangeRate.id,
      total_usd: Math.round(totalUsd * 1000000) / 1000000,
      total_mxn: Math.round(totalMxn * 1000000) / 1000000,
      is_locked: false,
    })
    .select()
    .single();

  if (reportError) {
    return { success: false, error: `Error creando reporte: ${reportError.message}` };
  }

  // 7. Insert line items
  const itemsWithReportId = lineItems.map((item) => ({
    ...item,
    report_id: report.id,
  }));

  const { error: itemsError } = await supabase
    .from("report_line_items")
    .insert(itemsWithReportId);

  if (itemsError) {
    return { success: false, error: `Error guardando items: ${itemsError.message}` };
  }

  // 7b. Reassign saved adjustments to the new report
  if (savedAdjustments.length > 0) {
    const adjustmentsToInsert = savedAdjustments.map((adj) => ({
      monthly_report_id: report.id,
      user_id: adj.user_id,
      adjustment_type: adj.adjustment_type,
      amount_usd: adj.amount_usd,
      description: adj.description,
      created_by: adj.created_by,
    }));

    const { error: adjError } = await supabase
      .from("adjustments")
      .insert(adjustmentsToInsert);

    if (adjError) {
      // Non-fatal: report was created, just log warning
      console.warn("Error re-inserting adjustments:", adjError.message);
    }
  }

  // 8. Record CSV upload
  await supabase.from("csv_uploads").insert({
    partner_id: partnerId,
    report_month: reportMonth,
    filename,
    status: "completed",
    row_count: rows.length,
    monthly_report_id: report.id,
    created_by: appUser.id,
    processed_at: new Date().toISOString(),
  });

  // 9. Notify affected users
  try {
    // Get unique user IDs from line items
    const affectedUserIds = [...new Set(lineItems.map((li: any) => li.user_id))];
    if (affectedUserIds.length > 0) {
      // Get user details for email
      const { data: affectedUsers } = await supabase
        .from("users")
        .select("id, name, email")
        .in("id", affectedUserIds);

      // Get partner name
      const { data: partnerInfo } = await supabase
        .from("partners")
        .select("name")
        .eq("id", partnerId)
        .single();
      const pName = (partnerInfo as any)?.name ?? "Partner";

      const monthLabel = new Date(reportMonth + "T00:00:00").toLocaleDateString("es-MX", { month: "long", year: "numeric" });

      // Create in-app notifications
      const notifications = affectedUserIds.map((uid: string) => {
        const userItems = lineItems.filter((li: any) => li.user_id === uid);
        const userTotal = userItems.reduce((s: number, li: any) => s + Number(li.final_usd ?? 0), 0);
        return {
          userId: uid,
          type: "report_generated" as const,
          title: "Nuevo reporte de ganancias",
          message: `Se genero un reporte para ${pName} (${monthLabel}). Tus ganancias: $${userTotal.toFixed(2)} USD.`,
          link: `/my-earnings`,
        };
      });
      await createNotificationsBatch(notifications);

      // Send emails (non-blocking)
      for (const u of (affectedUsers ?? []) as any[]) {
        if (!u.email) continue;
        const userItems = lineItems.filter((li: any) => li.user_id === u.id);
        const userTotal = userItems.reduce((s: number, li: any) => s + Number(li.final_usd ?? 0), 0);
        sendReportNotificationEmail({
          to: u.email,
          userName: u.name,
          reportMonth: monthLabel,
          partnerName: pName,
          totalUsd: userTotal,
        }).catch((err) => console.error("Email failed for", u.email, err));
      }
    }
  } catch (notifError) {
    console.error("Notification error (non-fatal):", notifError);
  }

  revalidatePath("/reports");
  revalidatePath("/");

  return {
    success: true,
    data: {
      reportId: report.id,
      processedProducts: lineItems.length,
      skippedErrors: errors,
      totalUsd: Math.round(totalUsd * 100) / 100,
      totalMxn: Math.round(totalMxn * 100) / 100,
      migratedAdjustments: savedAdjustments.length,
    },
  };
}

// ── Duplicate / conflict detection ──────────────────────────────────

export interface ExistingReportInfo {
  reportId: string;
  reportMonth: string;
  isLocked: boolean;
  lockedAt: string | null;
  totalUsd: number;
  totalMxn: number;
  createdAt: string;
  productCount: number;
  products: { name: string; grossUsd: number }[];
  exchangeRate: number;
  adjustmentCount: number;
  lastUpload: {
    filename: string;
    rowCount: number;
    processedAt: string;
  } | null;
}

/**
 * Check if a report already exists for the given partner + month.
 * Returns detailed info about the existing report so the UI can
 * show a meaningful comparison to the user.
 */
export async function checkExistingReport(
  partnerId: string,
  reportMonth: string
): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  // Check for existing report
  const { data: existing } = await supabase
    .from("monthly_reports")
    .select(
      `
      id,
      report_month,
      is_locked,
      locked_at,
      total_usd,
      total_mxn,
      created_at,
      exchange_rates (usd_to_mxn)
    `
    )
    .eq("partner_id", partnerId)
    .eq("report_month", reportMonth)
    .single();

  if (!existing) {
    return { success: true, data: null }; // No conflict
  }

  // Get products in existing report (aggregated by product name)
  const { data: lineItems } = await supabase
    .from("report_line_items")
    .select("product_name, gross_usd")
    .eq("report_id", existing.id);

  const productMap = new Map<string, number>();
  for (const item of lineItems ?? []) {
    const key = item.product_name;
    productMap.set(key, (productMap.get(key) ?? 0) + Number(item.gross_usd));
  }

  const products = Array.from(productMap.entries())
    .map(([name, grossUsd]) => ({ name, grossUsd }))
    .sort((a, b) => b.grossUsd - a.grossUsd);

  // Count adjustments on existing report
  const { count: adjustmentCount } = await supabase
    .from("adjustments")
    .select("id", { count: "exact", head: true })
    .eq("monthly_report_id", existing.id);

  // Get last CSV upload for this month
  const { data: lastUpload } = await supabase
    .from("csv_uploads")
    .select("filename, row_count, processed_at")
    .eq("partner_id", partnerId)
    .eq("report_month", reportMonth)
    .order("processed_at", { ascending: false })
    .limit(1)
    .single();

  const info: ExistingReportInfo = {
    reportId: existing.id,
    reportMonth: existing.report_month,
    isLocked: existing.is_locked,
    lockedAt: existing.locked_at,
    totalUsd: Number(existing.total_usd),
    totalMxn: Number(existing.total_mxn),
    createdAt: existing.created_at,
    productCount: products.length,
    products,
    exchangeRate: Number((existing as any).exchange_rates?.usd_to_mxn ?? 0),
    adjustmentCount: adjustmentCount ?? 0,
    lastUpload: lastUpload
      ? {
          filename: lastUpload.filename,
          rowCount: lastUpload.row_count,
          processedAt: lastUpload.processed_at,
        }
      : null,
  };

  return { success: true, data: info };
}

export async function lockReport(reportId: string): Promise<ActionResult> {
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

  const { error } = await supabase
    .from("monthly_reports")
    .update({
      is_locked: true,
      locked_at: new Date().toISOString(),
      locked_by: appUser?.id ?? null,
    })
    .eq("id", reportId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);
  return { success: true };
}

export async function unlockReport(reportId: string): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("monthly_reports")
    .update({ is_locked: false, locked_at: null, locked_by: null })
    .eq("id", reportId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);
  return { success: true };
}
