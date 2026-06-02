import ExcelJS from "exceljs";
import type { PaymentReceiptData } from "@/lib/pdf/receipt-pdf";
import { XLS, NUM_FMT } from "@/lib/brand/theme";
import {
  addBrandBanner,
  fill,
  bodyFont,
  addBrandFooter,
  applyBodyFontDefault,
} from "@/lib/brand/excel-brand";

const USD_FMT = NUM_FMT.usd;
const MXN_FMT = NUM_FMT.mxn;

const INK = XLS.ink;
const GRAPHITE = XLS.graphite;
const WHITE = XLS.white;
const ZEBRA = XLS.paper;
const ACCENT = XLS.accent;
const NEGATIVE = XLS.negative;
const MUTED = XLS.muted;

/**
 * Build a single-payment receipt as an .xlsx workbook, mirroring the redesigned
 * PDF: dark brand banner, datos, per-product distribution table, extra concepts
 * and totals — all in the BoxBuild visual language.
 */
export async function generatePaymentReceiptExcel(
  data: PaymentReceiptData
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BoxBuild";

  const ws = wb.addWorksheet("Pago", {
    properties: { defaultColWidth: 18 },
    views: [{ showGridLines: false }],
  });

  ws.columns = [
    { key: "a", width: 38 },
    { key: "b", width: 24 },
    { key: "c", width: 18 },
    { key: "d", width: 20 },
  ];

  // ---- Dark brand banner ----
  addBrandBanner({
    wb,
    sheet: ws,
    title: "Comprobante de Pago",
    subtitle: (data.partnerName || "").toUpperCase(),
    colSpan: 4,
  });
  ws.addRow([]); // spacer

  // ---- DATOS ----
  const datos: [string, string][] = [
    ["FECHA", formatDateDMY(data.paidAt)],
    ["NOMBRE", data.userName],
  ];
  if (data.userEmail) datos.push(["EMAIL", data.userEmail]);
  datos.push([
    "PERIODO DE VENTAS",
    data.salesPeriods.length > 0 ? data.salesPeriods.join(" · ") : "—",
  ]);

  for (const [label, value] of datos) {
    const r = ws.addRow([label, value]);
    r.getCell(1).font = bodyFont({ bold: true, color: { argb: INK } });
    r.getCell(2).font = bodyFont({ color: { argb: MUTED } });
    ws.mergeCells(r.number, 2, r.number, 4);
  }

  ws.addRow([]);

  // ---- Product distribution table ----
  if (data.products.length > 0) {
    const head = ws.addRow(["PRODUCTO", "DISTRIBUCIÓN", "MONTO USD", "MONTO MXN"]);
    head.height = 20;
    head.eachCell((cell, col) => {
      cell.font = bodyFont({ bold: true, color: { argb: WHITE }, size: 10 });
      cell.fill = fill(GRAPHITE);
      cell.alignment = {
        vertical: "middle",
        horizontal: col === 1 ? "left" : col === 2 ? "center" : "right",
      };
    });

    let lastPeriod: string | null = null;
    let zebra = false;

    for (const row of data.products) {
      // Period group separator for multi-report payments.
      if (
        data.salesPeriods.length > 1 &&
        row.salesPeriod &&
        row.salesPeriod !== lastPeriod
      ) {
        const sep = ws.addRow([row.salesPeriod.toUpperCase()]);
        sep.getCell(1).font = bodyFont({ bold: true, size: 9, color: { argb: MUTED } });
        ws.mergeCells(sep.number, 1, sep.number, 4);
        lastPeriod = row.salesPeriod;
        zebra = false;
      }

      const r = ws.addRow([
        row.product,
        row.distribution,
        row.amountUsd,
        row.amountMxn,
      ]);
      r.getCell(2).alignment = { horizontal: "center" };
      r.getCell(2).font = bodyFont({ color: { argb: MUTED } });
      r.getCell(3).numFmt = USD_FMT;
      r.getCell(4).numFmt = MXN_FMT;
      if (zebra) {
        for (let c = 1; c <= 4; c++) {
          r.getCell(c).fill = fill(ZEBRA);
        }
      }
      zebra = !zebra;
    }
  }

  ws.addRow([]);

  // ---- Concepts ----
  if (data.concepts.length > 0) {
    const ch = ws.addRow(["CONCEPTOS ADICIONALES", "", "MONTO USD", "MONTO MXN"]);
    ch.getCell(1).font = bodyFont({ bold: true, color: { argb: INK }, size: 10 });
    ch.getCell(3).font = bodyFont({ bold: true, color: { argb: INK }, size: 10 });
    ch.getCell(3).alignment = { horizontal: "right" };
    ch.getCell(4).font = bodyFont({ bold: true, color: { argb: INK }, size: 10 });
    ch.getCell(4).alignment = { horizontal: "right" };
    ws.mergeCells(ch.number, 1, ch.number, 2);

    for (const c of data.concepts) {
      const sign = c.isDeduction ? -1 : 1;
      const r = ws.addRow([
        c.description,
        "",
        sign * Math.abs(c.amountUsd),
        sign * Math.abs(c.amountMxn),
      ]);
      ws.mergeCells(r.number, 1, r.number, 2);
      r.getCell(3).numFmt = USD_FMT;
      r.getCell(4).numFmt = MXN_FMT;
      if (c.isDeduction) {
        r.getCell(3).font = bodyFont({ color: { argb: NEGATIVE } });
        r.getCell(4).font = bodyFont({ color: { argb: NEGATIVE } });
      }
    }
    ws.addRow([]);
  }

  // ---- Totals ----
  const hasConcepts = data.concepts.length > 0;
  const earningsUsd = hasConcepts ? data.productsSubtotalUsd : data.totalUsd;
  const earningsMxn = hasConcepts ? data.productsSubtotalMxn : data.totalMxn;

  addTotalRow(ws, "TOTAL USD", earningsUsd, USD_FMT, {});
  addTotalRow(ws, "TIPO DE CAMBIO", data.exchangeRate, USD_FMT, {});
  addTotalRow(ws, "TOTAL MXN", earningsMxn, MXN_FMT, {
    fill: INK,
    color: WHITE,
    bold: true,
  });

  if (hasConcepts) {
    addTotalRow(ws, "GRAN TOTAL USD", data.totalUsd, USD_FMT, { bold: true });
    addTotalRow(ws, "GRAN TOTAL MXN", data.totalMxn, MXN_FMT, {
      fill: INK,
      color: WHITE,
      bold: true,
      accent: true,
    });
  }

  ws.addRow([]);

  // ---- Footer meta ----
  const meta = ws.addRow([
    `Referencia: ${data.paymentId.substring(0, 8).toUpperCase()}`,
  ]);
  meta.getCell(1).font = bodyFont({ size: 8, color: { argb: MUTED } });
  ws.mergeCells(meta.number, 1, meta.number, 4);
  if (data.paymentMethod) {
    const m = ws.addRow([`Método de pago: ${data.paymentMethod}`]);
    m.getCell(1).font = bodyFont({ size: 8, color: { argb: MUTED } });
    ws.mergeCells(m.number, 1, m.number, 4);
  }
  if (data.notes) {
    const n = ws.addRow([`Notas: ${data.notes}`]);
    n.getCell(1).font = bodyFont({ size: 8, color: { argb: MUTED } });
    ws.mergeCells(n.number, 1, n.number, 4);
  }

  ws.addRow([]);
  const generatedAt = new Date().toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  addBrandFooter(ws, `BoxBuild · Generado el ${generatedAt}`, 4);

  applyBodyFontDefault(ws);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function addTotalRow(
  ws: ExcelJS.Worksheet,
  label: string,
  value: number,
  fmt: string,
  opts: { fill?: string; color?: string; bold?: boolean; accent?: boolean }
) {
  const r = ws.addRow(["", "", label, value]);
  const labelCell = r.getCell(3);
  const valueCell = r.getCell(4);
  labelCell.alignment = { horizontal: "right" };
  labelCell.font = bodyFont({ bold: opts.bold ?? false, color: { argb: opts.color ?? INK } });
  valueCell.numFmt = fmt;
  valueCell.alignment = { horizontal: "right" };
  valueCell.font = bodyFont({ bold: opts.bold ?? false, color: { argb: opts.color ?? INK } });
  if (opts.fill) {
    labelCell.fill = fill(opts.fill);
    valueCell.fill = fill(opts.fill);
    // Blue accent on the left edge marks the key figure.
    if (opts.accent) {
      labelCell.border = { left: { style: "medium", color: { argb: ACCENT } } };
    }
  }
}

function formatDateDMY(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}
