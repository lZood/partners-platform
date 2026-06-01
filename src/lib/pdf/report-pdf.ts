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

// ── Brand palette ──────────────────────────────────────────────
const C = {
  brand: "#1E3A8A", // deep blue
  brandLight: "#3B82F6", // blue
  accent: "#0EA5E9", // sky
  totalRow: "#DBEAFE", // light blue
  zebra: "#F1F5F9", // slate-100
  cardBg: "#F8FAFC",
  white: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  line: "#E5E7EB",
  positive: "#059669",
  negative: "#DC2626",
  amber: "#D97706",
};

// Letter geometry
const PAGE_W = 612;
const PAGE_H = 792;
const M = { left: 50, right: 50, top: 40, bottom: 54 };
const CONTENT_W = PAGE_W - M.left - M.right; // 512
const CONTENT_BOTTOM = PAGE_H - M.bottom; // available content area bottom

type Align = "left" | "right" | "center";
interface Col {
  label: string;
  w: number;
  align: Align;
}
const COLS: Col[] = [
  { label: "Producto", w: 150, align: "left" },
  { label: "%", w: 50, align: "right" },
  { label: "Bruto USD", w: 78, align: "right" },
  { label: "Post-Tax USD", w: 78, align: "right" },
  { label: "Neto USD", w: 78, align: "right" },
  { label: "Neto MXN", w: 78, align: "right" },
];
const PAD = 6;
const ROW_H = 16;
const HEADER_H = 20;

export async function generateReportPDF(data: ReportPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "letter",
      margins: { top: M.top, bottom: M.bottom, left: M.left, right: M.right },
      bufferPages: true,
    });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── helpers ────────────────────────────────────────────────
    /** Draw one row of cell values across the COLS grid. */
    const drawRow = (
      y: number,
      values: string[],
      opts: {
        bold?: boolean;
        color?: string;
        size?: number;
        bg?: string;
        height?: number;
      } = {}
    ) => {
      const h = opts.height ?? ROW_H;
      if (opts.bg) {
        doc.save();
        doc.rect(M.left, y, CONTENT_W, h).fill(opts.bg);
        doc.restore();
      }
      doc
        .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(opts.size ?? 8.5)
        .fillColor(opts.color ?? C.text);

      let x = M.left;
      COLS.forEach((col, i) => {
        const v = values[i] ?? "";
        const textY = y + (h - (opts.size ?? 8.5)) / 2 - 1;
        if (col.align === "left") {
          doc.text(v, x + PAD, textY, {
            width: col.w - PAD * 2,
            align: "left",
            lineBreak: false,
            ellipsis: true,
          });
        } else {
          doc.text(v, x, textY, {
            width: col.w - PAD,
            align: "right",
            lineBreak: false,
          });
        }
        x += col.w;
      });
    };

    const hLine = (y: number, color = C.line, width = 0.5) => {
      doc
        .save()
        .moveTo(M.left, y)
        .lineTo(M.left + CONTENT_W, y)
        .lineWidth(width)
        .strokeColor(color)
        .stroke()
        .restore();
    };

    /** Draw the table column header at y; return y below it. */
    const drawTableHeader = (y: number): number => {
      doc.save();
      doc.rect(M.left, y, CONTENT_W, HEADER_H).fill(C.brandLight);
      doc.restore();
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.white);
      let x = M.left;
      COLS.forEach((col) => {
        const textY = y + (HEADER_H - 8.5) / 2 - 1;
        if (col.align === "left") {
          doc.text(col.label, x + PAD, textY, {
            width: col.w - PAD * 2,
            align: "left",
            lineBreak: false,
          });
        } else {
          doc.text(col.label, x, textY, {
            width: col.w - PAD,
            align: "right",
            lineBreak: false,
          });
        }
        x += col.w;
      });
      return y + HEADER_H;
    };

    /** Ensure `needed` vertical px are available; otherwise start a new page. */
    const ensureSpace = (y: number, needed: number): number => {
      if (y + needed > CONTENT_BOTTOM) {
        doc.addPage();
        return M.top;
      }
      return y;
    };

    // ════════════════════════════════════════════════════════════
    // Header banner
    // ════════════════════════════════════════════════════════════
    const bannerH = 76;
    doc.save();
    doc.rect(0, 0, PAGE_W, bannerH + M.top - 10).fill(C.brand);
    doc.restore();

    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor(C.white)
      .text("Reporte de Ganancias", M.left, 28, { lineBreak: false });

    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#DBEAFE")
      .text(
        `${data.partnerName}  ·  ${formatMonth(data.reportMonth)}`,
        M.left,
        56,
        { lineBreak: false }
      );

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#BFDBFE")
      .text(
        `Tipo de cambio: $${data.exchangeRate.toFixed(4)} MXN/USD`,
        M.left,
        72,
        { lineBreak: false }
      );

    // Status pill (top-right)
    const statusText = data.isLocked ? "CONGELADO" : "BORRADOR";
    const pillColor = data.isLocked ? C.positive : C.amber;
    doc.font("Helvetica-Bold").fontSize(8.5);
    const pillTextW = doc.widthOfString(statusText);
    const pillW = pillTextW + 22;
    const pillH = 18;
    const pillX = PAGE_W - M.right - pillW;
    const pillY = 30;
    doc.save();
    doc.roundedRect(pillX, pillY, pillW, pillH, 9).fill(pillColor);
    doc.restore();
    doc
      .fillColor(C.white)
      .text(statusText, pillX, pillY + (pillH - 8.5) / 2 - 1, {
        width: pillW,
        align: "center",
        lineBreak: false,
      });

    let y = bannerH + M.top + 8;

    // ════════════════════════════════════════════════════════════
    // KPI cards
    // ════════════════════════════════════════════════════════════
    const totalGross = data.userSummaries.reduce(
      (s, u) => s + u.totalGrossUsd,
      0
    );
    const totalAfterTax = data.userSummaries.reduce(
      (s, u) => s + u.totalAfterTaxesUsd,
      0
    );
    const cards: { label: string; value: string; emphasize?: boolean }[] = [
      { label: "TOTAL BRUTO", value: formatUSD(totalGross) },
      { label: "POST-IMPUESTOS", value: formatUSD(totalAfterTax) },
      { label: "TOTAL NETO USD", value: formatUSD(data.grandTotalUsd), emphasize: true },
      { label: "TOTAL NETO MXN", value: formatMXN(data.grandTotalMxn), emphasize: true },
    ];
    const gap = 10;
    const cardW = (CONTENT_W - gap * (cards.length - 1)) / cards.length;
    const cardH = 52;
    cards.forEach((card, i) => {
      const cx = M.left + i * (cardW + gap);
      doc.save();
      doc.roundedRect(cx, y, cardW, cardH, 6).fill(card.emphasize ? C.brand : C.cardBg);
      doc.restore();
      if (!card.emphasize) {
        doc.save();
        doc.roundedRect(cx, y, cardW, cardH, 6).lineWidth(0.7).strokeColor(C.line).stroke();
        doc.restore();
      }
      // accent strip
      doc.save();
      doc.rect(cx, y + 6, 3, cardH - 12).fill(card.emphasize ? C.accent : C.brandLight);
      doc.restore();

      doc
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor(card.emphasize ? "#BFDBFE" : C.muted)
        .text(card.label, cx + 10, y + 9, {
          width: cardW - 14,
          lineBreak: false,
        });
      doc
        .font("Helvetica-Bold")
        .fontSize(12.5)
        .fillColor(card.emphasize ? C.white : C.brand)
        .text(card.value, cx + 10, y + 25, {
          width: cardW - 14,
          lineBreak: false,
          ellipsis: true,
        });
    });

    y += cardH + 22;

    // ════════════════════════════════════════════════════════════
    // Per-collaborator sections
    // ════════════════════════════════════════════════════════════
    for (const user of data.userSummaries) {
      // Need room for: name bar + table header + at least one row
      y = ensureSpace(y, 24 + HEADER_H + ROW_H + 24);

      // Collaborator name bar
      doc.save();
      doc.roundedRect(M.left, y, CONTENT_W, 22, 4).fill(C.accent);
      doc.restore();
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(C.white)
        .text(user.userName, M.left + 10, y + 6, {
          width: CONTENT_W - 20,
          lineBreak: false,
          ellipsis: true,
        });
      y += 22 + 4;

      // Table header
      y = drawTableHeader(y);

      // Item rows (zebra)
      let zebra = false;
      for (const item of user.items) {
        if (y + ROW_H > CONTENT_BOTTOM) {
          doc.addPage();
          y = M.top;
          y = drawTableHeader(y);
        }
        drawRow(
          y,
          [
            item.productName,
            formatPercentage(item.percentageApplied),
            formatUSD(item.grossUsd),
            formatUSD(item.afterTaxesUsd),
            formatUSD(item.finalUsd),
            formatMXN(item.finalMxn),
          ],
          { bg: zebra ? C.zebra : C.white }
        );
        y += ROW_H;
        zebra = !zebra;
      }

      // Adjustments
      if (user.adjustments && user.adjustments.length > 0) {
        for (const adj of user.adjustments) {
          if (y + ROW_H > CONTENT_BOTTOM) {
            doc.addPage();
            y = M.top;
            y = drawTableHeader(y);
          }
          const adjType =
            adj.type === "bonus"
              ? "Bono"
              : adj.type === "deduction"
                ? "Deducción"
                : "Corrección";
          const signed =
            adj.type === "deduction"
              ? -Math.abs(adj.amountUsd)
              : adj.amountUsd;
          const isNeg = signed < 0;
          doc.save();
          doc.rect(M.left, y, CONTENT_W, ROW_H).fill(C.white);
          doc.restore();
          doc
            .font("Helvetica-Oblique")
            .fontSize(8)
            .fillColor(isNeg ? C.negative : C.positive)
            .text(`↳ ${adjType}: ${adj.description}`, M.left + PAD + 6, y + 4, {
              width: COLS[0].w + COLS[1].w + COLS[2].w + COLS[3].w - PAD,
              lineBreak: false,
              ellipsis: true,
            });
          // amount under "Neto USD" column
          const amtX =
            M.left + COLS[0].w + COLS[1].w + COLS[2].w + COLS[3].w;
          doc.text(formatUSD(signed), amtX, y + 4, {
            width: COLS[4].w - PAD,
            align: "right",
            lineBreak: false,
          });
          y += ROW_H;
        }
      }

      // Subtotal row
      if (y + ROW_H + 4 > CONTENT_BOTTOM) {
        doc.addPage();
        y = M.top;
        y = drawTableHeader(y);
      }
      hLine(y + 1, C.brandLight, 1);
      drawRow(
        y + 2,
        [
          `Total · ${user.userName}`,
          "",
          formatUSD(user.totalGrossUsd),
          formatUSD(user.totalAfterTaxesUsd),
          formatUSD(user.totalFinalUsd),
          formatMXN(user.totalFinalMxn),
        ],
        { bold: true, bg: C.totalRow, color: C.brand, height: ROW_H + 2 }
      );
      y += ROW_H + 2;

      y += 22; // gap between collaborators
    }

    // ════════════════════════════════════════════════════════════
    // Grand total band
    // ════════════════════════════════════════════════════════════
    y = ensureSpace(y, 40);
    const bandH = 30;
    doc.save();
    doc.roundedRect(M.left, y, CONTENT_W, bandH, 5).fill(C.brand);
    doc.restore();
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(C.white)
      .text("GRAN TOTAL", M.left + 14, y + (bandH - 12) / 2 - 1, {
        lineBreak: false,
      });
    // USD + MXN right aligned
    const gtText = `${formatUSD(data.grandTotalUsd)}   |   ${formatMXN(
      data.grandTotalMxn
    )}`;
    doc.text(gtText, M.left, y + (bandH - 12) / 2 - 1, {
      width: CONTENT_W - 14,
      align: "right",
      lineBreak: false,
    });

    // ════════════════════════════════════════════════════════════
    // Footer (page numbers) — applied to every buffered page
    // ════════════════════════════════════════════════════════════
    const range = doc.bufferedPageRange();
    const generatedAt = new Date().toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const footY = PAGE_H - 38;
      doc
        .save()
        .moveTo(M.left, footY)
        .lineTo(PAGE_W - M.right, footY)
        .lineWidth(0.5)
        .strokeColor(C.line)
        .stroke()
        .restore();
      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor(C.muted)
        .text(
          `BoxFi Partners · ${data.partnerName} · Generado el ${generatedAt}`,
          M.left,
          footY + 6,
          { lineBreak: false }
        );
      doc.text(
        `Página ${i - range.start + 1} de ${range.count}`,
        M.left,
        footY + 6,
        { width: CONTENT_W, align: "right", lineBreak: false }
      );
    }

    doc.end();
  });
}
