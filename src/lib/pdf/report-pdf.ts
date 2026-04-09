import PDFDocument from "pdfkit";
import { formatUSD, formatMXN, formatPercentage, formatMonth } from "@/lib/utils";

export interface ReportPDFData {
  reportMonth: string; // "2026-03-01"
  partnerName: string;
  exchangeRate: number;
  isLocked: boolean;
  userSummaries: {
    userName: string;
    items: {
      productName: string;
      percentageApplied: number;
      grossUsd: number;
      afterTaxesUsd: number;
      finalUsd: number;
      finalMxn: number;
    }[];
    adjustments: {
      type: string;
      description: string;
      amountUsd: number;
    }[];
    totalGrossUsd: number;
    totalAfterTaxesUsd: number;
    totalAdjustmentsUsd: number;
    totalFinalUsd: number;
    totalFinalMxn: number;
  }[];
  grandTotalUsd: number;
  grandTotalMxn: number;
}

export async function generateReportPDF(data: ReportPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "letter",
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
    });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Title and header
    doc.fontSize(20).font("Helvetica-Bold").text("Reporte de Ganancias", {
      align: "center",
    });

    doc
      .fontSize(12)
      .font("Helvetica")
      .text(`${formatMonth(data.reportMonth).toUpperCase()}`, {
        align: "center",
      });

    // Partner and exchange rate
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Partner: ${data.partnerName}`, { align: "center" });
    doc.text(`Tipo de Cambio: $${data.exchangeRate.toFixed(5)} MXN/USD`, {
      align: "center",
    });

    // Status badge
    doc.moveDown(0.8);
    const statusText = data.isLocked ? "CONGELADO" : "BORRADOR";
    const statusColor = data.isLocked ? "#000000" : "#FF9500";
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor(statusColor)
      .text(statusText, { align: "center" });

    doc.fillColor("#000000");

    // Grand summary section
    doc.moveDown(1);
    doc.fontSize(11).font("Helvetica-Bold").text("Resumen General", {
      underline: true,
    });

    doc.moveDown(0.4);
    doc.fontSize(9).font("Helvetica");

    const summaryLeft = 60;
    const summaryTop = doc.y;
    const colWidth = 140;

    doc.text(`Total Bruto USD:`, summaryLeft, summaryTop);
    doc.text(`${formatUSD(data.userSummaries.reduce((s, u) => s + u.totalGrossUsd, 0))}`, summaryLeft + 125, summaryTop, {
      align: "right",
      width: 100,
    });

    doc.text(`Post-Impuestos USD:`, summaryLeft, summaryTop + 15);
    doc.text(`${formatUSD(data.userSummaries.reduce((s, u) => s + u.totalAfterTaxesUsd, 0))}`, summaryLeft + 125, summaryTop + 15, {
      align: "right",
      width: 100,
    });

    doc.text(`Total Neto USD:`, summaryLeft, summaryTop + 30);
    doc.text(`${formatUSD(data.grandTotalUsd)}`, summaryLeft + 125, summaryTop + 30, {
      align: "right",
      width: 100,
      bold: true,
    });

    doc.text(`Total Neto MXN:`, summaryLeft, summaryTop + 45);
    doc.text(`${formatMXN(data.grandTotalMxn)}`, summaryLeft + 125, summaryTop + 45, {
      align: "right",
      width: 100,
      bold: true,
    });

    doc.moveDown(3.5);

    // Per-user sections
    for (const user of data.userSummaries) {
      // User name header
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .text(`${user.userName}`, { underline: true });

      doc.moveDown(0.3);

      // Items table
      const tableTop = doc.y;
      const tableLeft = 50;
      const colWidths = [90, 35, 60, 70, 60, 70];
      const cols = [
        "Producto",
        "%",
        "Bruto USD",
        "Post-Tax USD",
        "Neto USD",
        "Neto MXN",
      ];

      doc.fontSize(8).font("Helvetica-Bold");

      // Header row
      let colX = tableLeft;
      cols.forEach((col, i) => {
        const align = i > 1 ? "right" : "left";
        doc.text(col, colX, tableTop, { width: colWidths[i], align });
        colX += colWidths[i];
      });

      // Separator line
      doc
        .moveTo(tableLeft, tableTop + 12)
        .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), tableTop + 12)
        .stroke();

      // Data rows
      doc.fontSize(8).font("Helvetica");
      let rowY = tableTop + 15;

      for (const item of user.items) {
        colX = tableLeft;
        const values = [
          item.productName,
          formatPercentage(item.percentageApplied),
          formatUSD(item.grossUsd),
          formatUSD(item.afterTaxesUsd),
          formatUSD(item.finalUsd),
          formatMXN(item.finalMxn),
        ];

        values.forEach((val, i) => {
          const align = i > 1 ? "right" : "left";
          doc.text(val, colX, rowY, { width: colWidths[i], align });
          colX += colWidths[i];
        });

        rowY += 12;
      }

      // Adjustments table if exists
      if (user.adjustments && user.adjustments.length > 0) {
        rowY += 5;

        doc
          .fontSize(8)
          .font("Helvetica-Bold")
          .text("Ajustes:", tableLeft, rowY);
        rowY += 12;

        doc.fontSize(7).font("Helvetica");

        for (const adj of user.adjustments) {
          const adjType =
            adj.type === "bonus"
              ? "Bono"
              : adj.type === "deduction"
                ? "Deducción"
                : "Corrección";

          doc.text(
            `${adjType}: ${adj.description}`,
            tableLeft + 10,
            rowY,
            { width: 200 }
          );

          const adjAmount =
            adj.type === "deduction"
              ? formatUSD(-adj.amountUsd)
              : formatUSD(adj.amountUsd);
          doc.text(adjAmount, tableLeft + 250, rowY, {
            align: "right",
            width: 60,
          });

          rowY += 10;
        }
      }

      // User total row
      rowY += 5;
      doc
        .fontSize(8)
        .font("Helvetica-Bold")
        .moveTo(tableLeft, rowY)
        .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), rowY)
        .stroke();

      rowY += 5;

      colX = tableLeft;
      const totalValues = [
        "TOTAL",
        "",
        formatUSD(user.totalGrossUsd),
        formatUSD(user.totalAfterTaxesUsd),
        formatUSD(user.totalFinalUsd),
        formatMXN(user.totalFinalMxn),
      ];

      totalValues.forEach((val, i) => {
        const align = i > 1 ? "right" : "left";
        doc.text(val, colX, rowY, { width: colWidths[i], align });
        colX += colWidths[i];
      });

      doc.moveDown(2.5);

      // Page break if needed
      if (doc.y > 650) {
        doc.addPage();
      }
    }

    // Footer
    doc.moveDown(1);
    doc
      .fontSize(7)
      .font("Helvetica")
      .fillColor("#666666")
      .text(
        `Generado por Partners Platform | ${new Date().toLocaleDateString("es-MX")}`,
        {
          align: "center",
        }
      );

    doc.end();
  });
}
