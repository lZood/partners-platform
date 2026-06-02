import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { formatUSD, formatMXN } from "@/lib/utils";
import { PDF as C } from "@/lib/brand/theme";
import { registerBrandFonts, type BrandFonts } from "@/lib/brand/pdf-fonts";

const BRAND_LOGO_DARK_PATH = path.join(
  process.cwd(),
  "public",
  "brand",
  "LogoCompleto_DarkTheme.png" // white wordmark — for the dark banner
);

function getBrandLogoBuffer(): Buffer | null {
  try {
    return fs.readFileSync(BRAND_LOGO_DARK_PATH);
  } catch {
    return null;
  }
}

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

    // Brand typefaces (Anek Latin / Sora) — falls back to Helvetica if absent.
    const F = registerBrandFonts(doc);

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ════════════════════════════════════════════════════════════
    // Dark brand banner
    // ════════════════════════════════════════════════════════════
    const bannerH = 70;
    doc.save();
    doc.rect(0, 0, 612, bannerH).fill(C.ink);
    doc.restore();

    // Optional partner logo on a white chip (reads on any background).
    let titleX = PAGE_LEFT;
    if (data.partnerLogo) {
      try {
        const chip = 40;
        const chipY = (bannerH - chip) / 2;
        doc.save();
        doc.roundedRect(PAGE_LEFT, chipY, chip, chip, 6).fill(C.white);
        doc.restore();
        doc.image(data.partnerLogo, PAGE_LEFT + 5, chipY + 5, {
          fit: [chip - 10, chip - 10],
        });
        titleX = PAGE_LEFT + chip + 12;
      } catch {
        titleX = PAGE_LEFT;
      }
    }

    doc
      .font(F.display)
      .fontSize(20)
      .fillColor(C.white)
      .text("Comprobante de Pago", titleX, 18, { lineBreak: false });
    doc
      .font(F.body)
      .fontSize(10)
      .fillColor(C.onDarkMuted)
      .text((data.partnerName || "").toUpperCase(), titleX, 44, {
        width: 320,
        lineBreak: false,
        ellipsis: true,
      });

    // BoxBuild wordmark on the right of the banner.
    const brandLogo = getBrandLogoBuffer();
    if (brandLogo) {
      try {
        const logoW = 78;
        const logoH = 22;
        doc.image(brandLogo, PAGE_RIGHT - logoW, (bannerH - logoH) / 2, {
          fit: [logoW, logoH],
        });
      } catch {
        // Ignore image errors; the receipt remains valid without it.
      }
    }

    // ---- DATOS block ----
    let y = bannerH + 22;

    const paidDate = formatDateDMY(data.paidAt);
    doc
      .font(F.bodyBold)
      .fontSize(10)
      .fillColor(C.ink)
      .text("DATOS", PAGE_LEFT, y);
    drawRightLabelValue(doc, F, "FECHA:", paidDate, PAGE_RIGHT, y);

    y += 20;
    drawLeftLabelValue(doc, F, "NOMBRE:", data.userName, PAGE_LEFT, y);

    y += 16;
    const period =
      data.salesPeriods.length > 0 ? data.salesPeriods.join(" · ") : "—";
    drawLeftLabelValue(doc, F, "PERIODO DE VENTAS:", period, PAGE_LEFT, y);

    y += 28;

    // ---- Product distribution table ----
    if (data.products.length > 0) {
      y = drawTableHeader(doc, F, y);

      let lastPeriod: string | null = null;
      let zebra = false;

      for (const row of data.products) {
        // Page break.
        if (y + ROW_H > PAGE_BOTTOM) {
          doc.addPage();
          y = 50;
          y = drawTableHeader(doc, F, y);
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
            .font(F.bodyBold)
            .fontSize(8)
            .fillColor(C.muted)
            .text(row.salesPeriod.toUpperCase(), COL_PRODUCT_X + 4, y + 4, {
              width: COL_PRODUCT_W,
            });
          y += 16;
          lastPeriod = row.salesPeriod;
          zebra = false;
        }

        if (zebra) {
          doc.rect(PAGE_LEFT, y, CONTENT_W, ROW_H).fill(C.paper);
        }
        zebra = !zebra;

        doc.font(F.body).fontSize(9).fillColor(C.ink);
        doc.text(row.product, COL_PRODUCT_X + 4, y + 7, {
          width: COL_PRODUCT_W - 8,
          lineBreak: false,
          ellipsis: true,
        });
        doc
          .fillColor(C.muted)
          .text(row.distribution, COL_DIST_X, y + 7, {
            width: COL_DIST_W,
            align: "center",
            lineBreak: false,
            ellipsis: true,
          });
        doc
          .fillColor(C.ink)
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
        .strokeColor(C.line)
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

    y = drawTotalRow(doc, F, "TOTAL USD", formatUSD(earningsUsd), y, {});
    y = drawTotalRow(
      doc,
      F,
      "TIPO DE CAMBIO",
      `$${data.exchangeRate.toFixed(2)}`,
      y,
      {}
    );
    y = drawTotalRow(doc, F, "TOTAL MXN", formatMXN(earningsMxn), y, {
      fill: C.ink,
      textColor: C.white,
      bold: true,
    });

    if (hasConcepts) {
      y += 6;
      for (const c of data.concepts) {
        const label = c.description;
        const value = `${c.isDeduction ? "-" : ""}${formatMXN(
          Math.abs(c.amountMxn)
        )}`;
        y = drawTotalRow(doc, F, label, value, y, {
          small: true,
          textColor: c.isDeduction ? C.negative : C.muted,
        });
      }
      y += 4;
      y = drawTotalRow(doc, F, "GRAN TOTAL MXN", formatMXN(data.totalMxn), y, {
        fill: C.ink,
        textColor: C.white,
        bold: true,
        accent: true,
      });
      y = drawTotalRow(doc, F, "GRAN TOTAL USD", formatUSD(data.totalUsd), y, {
        bold: true,
      });
    }

    // ---- Footer: payment meta + disclaimer ----
    let footerY = Math.max(y + 30, PAGE_BOTTOM - 60);
    if (footerY + 50 > PAGE_BOTTOM) {
      footerY = y + 24;
    }

    doc
      .moveTo(PAGE_LEFT, footerY)
      .lineTo(PAGE_RIGHT, footerY)
      .lineWidth(0.5)
      .strokeColor(C.line)
      .stroke();
    footerY += 8;

    doc.font(F.body).fontSize(8).fillColor(C.muted);
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
      .fillColor(C.faint)
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
  f: BrandFonts,
  label: string,
  value: string,
  x: number,
  y: number
) {
  doc.font(f.bodyBold).fontSize(10).fillColor(C.ink);
  const labelW = doc.widthOfString(label + " ");
  doc.text(label, x, y, { lineBreak: false });
  doc
    .font(f.body)
    .fontSize(10)
    .fillColor(C.muted)
    .text(value, x + labelW, y, { width: CONTENT_W - labelW, lineBreak: false, ellipsis: true });
}

function drawRightLabelValue(
  doc: PDFKit.PDFDocument,
  f: BrandFonts,
  label: string,
  value: string,
  rightX: number,
  y: number
) {
  doc.font(f.bodyBold).fontSize(10).fillColor(C.ink);
  const labelW = doc.widthOfString(label + " ");
  doc.font(f.body).fontSize(10).fillColor(C.muted);
  const valueW = doc.widthOfString(value);
  const totalW = labelW + valueW;
  const startX = rightX - totalW;
  doc
    .font(f.bodyBold)
    .fontSize(10)
    .fillColor(C.ink)
    .text(label, startX, y, { lineBreak: false });
  doc
    .font(f.body)
    .fontSize(10)
    .fillColor(C.muted)
    .text(value, startX + labelW, y, { lineBreak: false });
}

function drawTableHeader(
  doc: PDFKit.PDFDocument,
  f: BrandFonts,
  y: number
): number {
  doc.rect(PAGE_LEFT, y, CONTENT_W, ROW_H).fill(C.graphite);
  doc.font(f.bodyBold).fontSize(9).fillColor(C.white);
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
  f: BrandFonts,
  label: string,
  value: string,
  y: number,
  opts: {
    fill?: string;
    textColor?: string;
    bold?: boolean;
    small?: boolean;
    /** Draw the blue accent strip on a filled total row (marks the key figure). */
    accent?: boolean;
  }
): number {
  const rowH = opts.small ? 16 : 20;
  const labelColX = PAGE_LEFT + 232; // 282
  const labelColW = 130;
  const valueColX = labelColX + labelColW + 6; // 418
  const valueColW = PAGE_RIGHT - valueColX; // 138

  if (opts.fill) {
    doc.rect(valueColX - 4, y, valueColW + 4, rowH).fill(opts.fill);
    if (opts.accent) {
      doc.rect(valueColX - 4, y, 3, rowH).fill(C.accent);
    }
  }

  doc
    .font(opts.bold ? f.bodyBold : f.body)
    .fontSize(opts.small ? 8 : 10)
    .fillColor(opts.fill ? C.ink : opts.small ? (opts.textColor ?? C.muted) : C.ink)
    .text(label, labelColX, y + (opts.small ? 4 : 5), {
      width: labelColW,
      align: "right",
      lineBreak: false,
      ellipsis: true,
    });

  doc
    .font(opts.bold ? f.bodyBold : f.body)
    .fontSize(opts.small ? 8 : 10)
    .fillColor(opts.textColor ?? C.ink)
    .text(value, valueColX, y + (opts.small ? 4 : 5), {
      width: valueColW - 4,
      align: "right",
    });

  return y + rowH;
}
