import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateReportPDF } from "@/lib/pdf/report-pdf";

export async function GET(
  request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const reportId = params.reportId;

    // Fetch report
    const { data: report, error: reportError } = await supabase
      .from("monthly_reports")
      .select(
        `
        id,
        report_month,
        is_locked,
        exchange_rates (usd_to_mxn),
        partners (name)
      `
      )
      .eq("id", reportId)
      .single();

    if (reportError || !report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    // Fetch line items
    const { data: lineItems, error: itemsError } = await supabase
      .from("report_line_items")
      .select(
        `
        id,
        product_name,
        percentage_applied,
        gross_usd,
        after_taxes_usd,
        final_usd,
        final_mxn,
        user_id,
        users (id, name, email)
      `
      )
      .eq("report_id", reportId);

    if (itemsError) {
      return NextResponse.json(
        { error: "Failed to fetch line items" },
        { status: 500 }
      );
    }

    // Fetch adjustments
    const { data: adjustments, error: adjError } = await supabase
      .from("adjustments")
      .select(
        `
        id,
        user_id,
        adjustment_type,
        amount_usd,
        description,
        users (id, name)
      `
      )
      .eq("monthly_report_id", reportId);

    if (adjError) {
      return NextResponse.json(
        { error: "Failed to fetch adjustments" },
        { status: 500 }
      );
    }

    // Group line items by user (same logic as report-detail-client.tsx)
    const userMap = new Map<string, any>();

    for (const item of lineItems || []) {
      const uid = item.user_id;
      if (!userMap.has(uid)) {
        userMap.set(uid, {
          userId: uid,
          userName: item.users?.name ?? "Desconocido",
          userEmail: item.users?.email ?? null,
          totalGrossUsd: 0,
          totalAfterTaxesUsd: 0,
          totalAdjustmentsUsd: 0,
          totalFinalUsd: 0,
          totalFinalMxn: 0,
          items: [],
        });
      }

      const summary = userMap.get(uid)!;
      summary.totalGrossUsd += Number(item.gross_usd);
      summary.totalAfterTaxesUsd += Number(item.after_taxes_usd);
      summary.totalFinalUsd += Number(item.final_usd);
      summary.totalFinalMxn += Number(item.final_mxn);

      summary.items.push({
        productName: item.product_name,
        percentageApplied: Number(item.percentage_applied),
        grossUsd: Number(item.gross_usd),
        afterTaxesUsd: Number(item.after_taxes_usd),
        finalUsd: Number(item.final_usd),
        finalMxn: Number(item.final_mxn),
      });
    }

    // Add adjustments to user summaries
    const exchangeRate = Number(report.exchange_rates?.usd_to_mxn ?? 0);

    for (const adj of adjustments || []) {
      const uid = adj.user_id;
      if (userMap.has(uid)) {
        const summary = userMap.get(uid)!;

        const amount =
          adj.adjustment_type === "deduction"
            ? -Math.abs(Number(adj.amount_usd))
            : Number(adj.amount_usd);

        summary.totalAdjustmentsUsd += amount;
        summary.totalFinalUsd += amount;
        summary.totalFinalMxn += amount * exchangeRate;

        if (!summary.adjustments) {
          summary.adjustments = [];
        }
        summary.adjustments.push({
          type: adj.adjustment_type,
          description: adj.description,
          amountUsd: Number(adj.amount_usd),
        });
      }
    }

    // Sort users by name
    const userSummaries = Array.from(userMap.values()).sort((a, b) =>
      a.userName.localeCompare(b.userName)
    );

    // Calculate grand totals
    const grandTotalUsd = userSummaries.reduce(
      (sum, u) => sum + u.totalFinalUsd,
      0
    );
    const grandTotalMxn = userSummaries.reduce(
      (sum, u) => sum + u.totalFinalMxn,
      0
    );

    // Generate PDF
    const pdfBuffer = await generateReportPDF({
      reportMonth: report.report_month,
      partnerName: report.partners?.name ?? "Unknown",
      exchangeRate,
      isLocked: report.is_locked,
      userSummaries,
      grandTotalUsd,
      grandTotalMxn,
    });

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="reporte-ganancias-${report.report_month}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
