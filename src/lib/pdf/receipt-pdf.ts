import PDFDocument from "pdfkit";
import { formatUSD, formatMXN } from "@/lib/utils";

/**
 * A single product distribution row in the payment receipt.
 * Mirrors a `report_line_items` record: the collaborator's share of a product.
 */
export interface PaymentReceiptProductRow {
  /** Product name, e.g. "Epic Helpers". */
  product: string;
  /** Distribution descriptor, e.g. "20% · Mapa". */
  distribution: string;
  /** Distribution percentage applied (collaborator share). */
  percentage: number | null;
  /** Product type / category name, if available. */
  productType: string | null;
  amountUsd: number;
  amountMxn: number;
  /** Formatted sales period this row belongs to (used for grouping). */
  salesPeriod: string;
}

/** An extra concept (bonus / work / commission / deduction) added to a payment. */
export interface PaymentReceiptConceptRow {
  description: string;
  amountUsd: number;
  amountMxn: number;
  isDeduction: boolean;
}

/** Full data set required to render a payment receipt (PDF or Excel). */
export interface PaymentReceiptData {
  paymentId: string;
  partnerName: string;
  partnerLogoUrl: string | null;
  /** Pre-fetched logo image bytes (PNG/JPG). Optional. */
  partnerLogo?: Buffer | null;
  userName: string;
  userEmail: string | null;
  paidAt: string;
  /** Formatted sales periods covered by this payment, e.g. ["Marzo 2025"]. */
  salesPeriods: string[];
  exchangeRate: number;
  products: PaymentReceiptProductRow[];
  concepts: PaymentReceiptConceptRow[];
  productsSubtotalUsd: number;
  productsSubtotalMxn: number;
  conceptsSubtotalUsd: number;
  conceptsSubtotalMxn: number;
  totalUsd: number;
  totalMxn: number;
  paymentMethod: string | null;
  notes: string | null;
  createdByName: string | null;
}

// Palette
const INK = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const ZEBRA = "#F9FAFB";
const ACCENT = "#DC2626";

const PAGE_LEFT = 50;
const PAGE_RIGHT = 562; // letter width 612 - 50 margin
const CONTENT_W = PAGE_RIGHT - PAGE_LEFT; // 512

// Product table columns
const COL_PRODUCT_X = PAGE_LEFT;
const COL_PRODUCT_W = 268;
const COL_DIST_X = PAGE_LEFT + 270;
const COL_DIST_W = 130;
const COL_AMOUNT_X = PAGE_LEFT + 404;
const COL_AMOUNT_W = CONTENT_W - 404; // 108
const ROW_H = 22;
const PAGE_BOTTOM = 752; // letter height 792 - 40 margin

export async function generateReceiptPDF(
  data: PaymentReceiptData
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "letter",
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
    });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ---- Header: partner name (left) + "PAGO" (right) ----
    let headerY = 44;

    // Optional logo to the left of the name.
    let nameX = PAGE_LEFT;
    if (data.partnerLogo) {
      try {
        doc.image(data.partnerLogo, PAGE_LEFT, headerY - 2, {
          fit: [34, 34],
        });
        nameX = PAGE_LEFT + 44;
      } catch {
        // Ignore invalid image data and fall back to text-only header.
        nameX = PAGE_LEFT;
      }
    }

    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(26)
      .text((data.partnerName || "").toUpperCase(), nameX, headerY, {
        // Stop short of the right-aligned "PAGO" label so long names truncate
        // instead of overlapping it.
        width: PAGE_RIGHT - 170 - nameX,
        lineBreak: false,
        ellipsis: true,
      });

    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(26)
      .text("PAGO", PAGE_RIGHT - 160, headerY, {
        width: 160,
        align: "right",
      });

    headerY += 40;
    doc
      .moveTo(PAGE_LEFT, headerY)
      .lineTo(PAGE_RIGHT, headerY)
      .lineWidth(1)
      .strokeColor(INK)
      .stroke();

    // ---- DATA block ----
    let y = headerY + 16;

    const paidDate = formatDateDMY(data.paidAt);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(INK)
      .text("DATOS", PAGE_LEFT, y);
    drawRightLabelValue(doc, "FECHA:", paidDate, PAGE_RIGHT, y);

    y += 20;
    drawLeftLabelValue(doc, "NOMBRE:", data.userName, PAGE_LEFT, y);

    y += 16;
    const period =
      data.salesPeriods.length > 0 ? data.salesPeriods.join(" · ") : "—";
    drawLeftLabelValue(doc, "PERIODO DE VENTAS:", period, PAGE_LEFT, y);

    y += 28;

    // ---- Product distribution table ----
    if (data.products.length > 0) {
      y = drawTableHeader(doc, y);

      let lastPeriod: string | null = null;
      let zebra = false;

      for (const row of data.products) {
        // Page break.
        if (y + ROW_H > PAGE_BOTTOM) {
          doc.addPage();
          y = 50;
          y = drawTableHeader(doc, y);
          lastPeriod = null;
          zebra = false;
        }

        // Group separator when the sales period changes (multi-report payments).
        if (
          data.salesPeriods.length > 1 &&
          row.salesPeriod &&
          row.salesPeriod !== lastPeriod
        ) {
          if (lastPeriod !== null) y += 6;
          doc
            .font("Helvetica-Bold")
            .fontSize(8)
            .fillColor(MUTED)
            .text(row.salesPeriod.toUpperCase(), COL_PRODUCT_X + 4, y + 4, {
              width: COL_PRODUCT_W,
            });
          y += 16;
          lastPeriod = row.salesPeriod;
          zebra = false;
        }

        if (zebra) {
          doc.rect(PAGE_LEFT, y, CONTENT_W, ROW_H).fill(ZEBRA);
        }
        zebra = !zebra;

        doc.font("Helvetica").fontSize(9).fillColor(INK);
        doc.text(row.product, COL_PRODUCT_X + 4, y + 7, {
          width: COL_PRODUCT_W - 8,
          lineBreak: false,
          ellipsis: true,
        });
        doc
          .fillColor(MUTED)
          .text(row.distribution, COL_DIST_X, y + 7, {
            width: COL_DIST_W,
            align: "center",
            lineBreak: false,
            ellipsis: true,
          });
        doc
          .fillColor(INK)
          .text(formatUSD(row.amountUsd), COL_AMOUNT_X, y + 7, {
            width: COL_AMOUNT_W - 4,
            align: "right",
          });

        y += ROW_H;
      }

      // Bottom border of the table.
      doc
        .moveTo(PAGE_LEFT, y)
        .lineTo(PAGE_RIGHT, y)
        .lineWidth(0.5)
        .strokeColor(BORDER)
        .stroke();
      y += 4;
    }

    // ---- Totals stack (right-aligned) ----
    if (y + 120 > PAGE_BOTTOM) {
      doc.addPage();
      y = 50;
    }
    y += 18;

    const hasConcepts = data.concepts.length > 0;
    // Without concepts the products subtotal IS the payment total, so show the
    // authoritative stored totals. With concepts, the products subtotal is the
    // earnings line and the GRAN TOTAL below carries the full payment total.
    const earningsUsd = hasConcepts ? data.productsSubtotalUsd : data.totalUsd;
    const earningsMxn = hasConcepts ? data.productsSubtotalMxn : data.totalMxn;

    y = drawTotalRow(doc, "TOTAL USD", formatUSD(earningsUsd), y, {});
    y = drawTotalRow(
      doc,
      "TIPO DE CAMBIO",
      `$${data.exchangeRate.toFixed(2)}`,
      y,
      {}
    );
    y = drawTotalRow(doc, "TOTAL MXN", formatMXN(earningsMxn), y, {
      fill: INK,
      textColor: "#FFFFFF",
      bold: true,
    });

    if (hasConcepts) {
      y += 6;
      for (const c of data.concepts) {
        const label = c.isDeduction ? `${c.description}` : c.description;
        const value = `${c.isDeduction ? "-" : ""}${formatMXN(
          Math.abs(c.amountMxn)
        )}`;
        y = drawTotalRow(doc, label, value, y, {
          small: true,
          textColor: c.isDeduction ? ACCENT : MUTED,
        });
      }
      y += 4;
      y = drawTotalRow(doc, "GRAN TOTAL MXN", formatMXN(data.totalMxn), y, {
        fill: ACCENT,
        textColor: "#FFFFFF",
        bold: true,
      });
      y = drawTotalRow(doc, "GRAN TOTAL USD", formatUSD(data.totalUsd), y, {
        bold: true,
      });
    }

    // ---- Footer: payment meta + disclaimer ----
    let footerY = Math.max(y + 30, PAGE_BOTTOM - 70);
    if (footerY + 50 > PAGE_BOTTOM) {
      footerY = y + 24;
    }

    doc
      .moveTo(PAGE_LEFT, footerY)
      .lineTo(PAGE_RIGHT, footerY)
      .lineWidth(0.5)
      .strokeColor(BORDER)
      .stroke();
    footerY += 8;

    doc.font("Helvetica").fontSize(8).fillColor(MUTED);
    const metaParts: string[] = [
      `Referencia: ${data.paymentId.substring(0, 8).toUpperCase()}`,
    ];
    if (data.paymentMethod) metaParts.push(`Método: ${data.paymentMethod}`);
    if (data.createdByName) metaParts.push(`Registró: ${data.createdByName}`);
    doc.text(metaParts.join("   ·   "), PAGE_LEFT, footerY, {
      width: CONTENT_W,
    });
    if (data.notes) {
      doc.text(`Notas: ${data.notes}`, PAGE_LEFT, doc.y + 2, {
        width: CONTENT_W,
      });
    }

    doc.moveDown(0.6);
    doc
      .fontSize(7)
      .fillColor("#9CA3AF")
      .text(
        "Este comprobante es un registro interno de pago y no tiene validez fiscal.",
        PAGE_LEFT,
        doc.y,
        { width: CONTENT_W, align: "center" }
      );
    const timestamp = new Date().toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
    });
    doc.text(`Generado el ${timestamp}`, PAGE_LEFT, doc.y, {
      width: CONTENT_W,
      align: "center",
    });

    doc.end();
  });
}

// ---------- helpers ----------

function formatDateDMY(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function drawLeftLabelValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number
) {
  doc.font("Helvetica-Bold").fontSize(10).fillColor(INK);
  const labelW = doc.widthOfString(label + " ");
  doc.text(label, x, y, { lineBreak: false });
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(MUTED)
    .text(value, x + labelW, y, { width: CONTENT_W - labelW, lineBreak: false, ellipsis: true });
}

function drawRightLabelValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  rightX: number,
  y: number
) {
  doc.font("Helvetica-Bold").fontSize(10).fillColor(INK);
  const labelW = doc.widthOfString(label + " ");
  doc.font("Helvetica").fontSize(10).fillColor(MUTED);
  const valueW = doc.widthOfString(value);
  const totalW = labelW + valueW;
  const startX = rightX - totalW;
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(INK)
    .text(label, startX, y, { lineBreak: false });
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(MUTED)
    .text(value, startX + labelW, y, { lineBreak: false });
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number): number {
  doc.rect(PAGE_LEFT, y, CONTENT_W, ROW_H).fill(INK);
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#FFFFFF");
  doc.text("PRODUCTO", COL_PRODUCT_X + 4, y + 7, { width: COL_PRODUCT_W - 8 });
  doc.text("DISTRIBUCIÓN", COL_DIST_X, y + 7, {
    width: COL_DIST_W,
    align: "center",
  });
  doc.text("MONTO", COL_AMOUNT_X, y + 7, {
    width: COL_AMOUNT_W - 4,
    align: "right",
  });
  return y + ROW_H;
}

function drawTotalRow(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  y: number,
  opts: {
    fill?: string;
    textColor?: string;
    bold?: boolean;
    small?: boolean;
  }
): number {
  const rowH = opts.small ? 16 : 20;
  const labelColX = PAGE_LEFT + 232; // 282
  const labelColW = 130;
  const valueColX = labelColX + labelColW + 6; // 418
  const valueColW = PAGE_RIGHT - valueColX; // 138

  if (opts.fill) {
    doc.rect(valueColX - 4, y, valueColW + 4, rowH).fill(opts.fill);
  }

  doc
    .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(opts.small ? 8 : 10)
    .fillColor(opts.fill ? INK : opts.small ? (opts.textColor ?? MUTED) : INK)
    .text(label, labelColX, y + (opts.small ? 4 : 5), {
      width: labelColW,
      align: "right",
      lineBreak: false,
      ellipsis: true,
    });

  doc
    .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(opts.small ? 8 : 10)
    .fillColor(opts.textColor ?? INK)
    .text(value, valueColX, y + (opts.small ? 4 : 5), {
      width: valueColW - 4,
      align: "right",
    });

  return y + rowH;
}
