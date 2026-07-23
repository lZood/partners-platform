import ExcelJS from "exceljs";
import { XLS, NUM_FMT } from "@/lib/brand/theme";
import {
  addBrandBanner,
  styleHeaderRow,
  fill,
  thinBorder,
  titleFont,
  addBrandFooter,
  applyBodyFontDefault,
} from "@/lib/brand/excel-brand";

interface ReportExcelData {
  reportMonth: string;
  partnerName: string;
  exchangeRate: number;
  isLocked: boolean;
  grandTotalUsd: number;
  grandTotalMxn: number;
  users: {
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
  taxBreakdown?: {
    name: string;
    rate: number | null;
    totalUsd: number;
  }[];
}

// ── Brand palette (BoxBuild) ───────────────────────────────────
// Dark ink dominates; the blue accent marks important figures only.
const COLORS = {
  ink: XLS.ink, // banner, grand total, body emphasis
  graphite: XLS.graphite, // table / column headers
  accent: XLS.accent, // the single accent — important rules only
  totalRow: XLS.accentTint, // subtotal highlight
  zebra: XLS.paper, // alternating rows
  white: XLS.white,
  textDark: XLS.ink,
  muted: XLS.muted,
  border: XLS.line,
  positive: XLS.ink, // no green — positives in plain ink
  negative: XLS.negative, // semantic only
};

const currencyFormat = NUM_FMT.usd;
const pctFormat = NUM_FMT.pct;

function formatMonth(month: string): string {
  // expects "YYYY-MM"
  const [y, m] = month.split("-");
  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const idx = Number(m) - 1;
  if (!y || isNaN(idx) || idx < 0 || idx > 11) return month;
  return `${months[idx]} ${y}`;
}

export async function generateReportExcel(data: ReportExcelData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BoxBuild";
  wb.created = new Date(0); // deterministic; avoids Date.now usage concerns
  const periodLabel = formatMonth(data.reportMonth);
  const generatedAt = new Date().toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // ════════════════════════════════════════════════════════════
  // Sheet 1 · Resumen
  // ════════════════════════════════════════════════════════════
  const summary = wb.addWorksheet("Resumen", {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  });
  summary.columns = [
    { width: 4 },
    { width: 28 },
    { width: 28 },
    { width: 4 },
  ];

  addBrandBanner({
    wb,
    sheet: summary,
    title: "Reporte de Ganancias",
    subtitle: `${data.partnerName}  ·  ${periodLabel}`,
    colSpan: 4,
  });

  let r = 4;
  const statusLabel = data.isLocked ? "Bloqueado" : "Borrador";
  const statusColor = data.isLocked ? COLORS.accent : COLORS.muted;

  const metaRows: [string, string | number][] = [
    ["Partner", data.partnerName],
    ["Periodo", periodLabel],
    ["Tipo de Cambio (USD→MXN)", data.exchangeRate],
    ["Estado", statusLabel],
    ["Colaboradores", data.users.length],
  ];

  for (const [label, value] of metaRows) {
    const labelCell = summary.getCell(r, 2);
    labelCell.value = label;
    labelCell.font = { bold: true, color: { argb: COLORS.textDark } };
    labelCell.fill = fill(COLORS.zebra);
    labelCell.alignment = { vertical: "middle", indent: 1 };
    labelCell.border = thinBorder;

    const valueCell = summary.getCell(r, 3);
    valueCell.value = value;
    valueCell.alignment = { vertical: "middle", indent: 1 };
    valueCell.border = thinBorder;
    if (label === "Tipo de Cambio (USD→MXN)") valueCell.numFmt = currencyFormat;
    if (label === "Estado") {
      valueCell.font = { bold: true, color: { argb: statusColor } };
    }
    summary.getRow(r).height = 20;
    r++;
  }

  // KPI cards: Total USD / Total MXN
  r += 1;
  const kpis: [string, number, string][] = [
    ["TOTAL USD", data.grandTotalUsd, currencyFormat],
    ["TOTAL MXN", data.grandTotalMxn, currencyFormat],
  ];
  for (const [label, value, fmt] of kpis) {
    summary.mergeCells(r, 2, r, 3);
    const head = summary.getCell(r, 2);
    head.value = label;
    head.font = { bold: true, size: 11, color: { argb: COLORS.white } };
    head.fill = fill(COLORS.ink);
    head.alignment = { horizontal: "center", vertical: "middle" };
    summary.getRow(r).height = 18;

    summary.mergeCells(r + 1, 2, r + 1, 3);
    const body = summary.getCell(r + 1, 2);
    body.value = value;
    body.numFmt = fmt;
    body.font = { bold: true, size: 20, color: { argb: COLORS.ink } };
    body.alignment = { horizontal: "center", vertical: "middle" };
    body.fill = fill(COLORS.white);
    body.border = {
      bottom: { style: "medium", color: { argb: COLORS.accent } },
      left: { style: "thin", color: { argb: COLORS.border } },
      right: { style: "thin", color: { argb: COLORS.border } },
    };
    summary.getRow(r + 1).height = 34;
    r += 3;
  }

  // ════════════════════════════════════════════════════════════
  // Sheet 2 · Detalle (grouped by collaborator)
  // ════════════════════════════════════════════════════════════
  const detail = wb.addWorksheet("Detalle", {
    views: [{ showGridLines: false, state: "frozen", ySplit: 4 }],
  });
  const detailCols = [
    { width: 4 }, // spacer
    { width: 32 }, // product
    { width: 9 }, // %
    { width: 16 }, // gross
    { width: 16 }, // after tax
    { width: 16 }, // final usd
    { width: 16 }, // final mxn
  ];
  detail.columns = detailCols;
  const DETAIL_SPAN = 7;

  addBrandBanner({
    wb,
    sheet: detail,
    title: "Detalle por Colaborador",
    subtitle: `${data.partnerName}  ·  ${periodLabel}`,
    colSpan: DETAIL_SPAN,
  });

  // Header row (row 4)
  const detHeaders = ["Producto", "%", "Bruto USD", "Post-Tax USD", "Neto USD", "Neto MXN"];
  const detHeaderRow = detail.getRow(4);
  detHeaders.forEach((h, i) => {
    detHeaderRow.getCell(i + 2).value = h;
  });
  styleHeaderRow(detail, 4, DETAIL_SPAN);
  // left spacer column on header transparent
  detail.getCell(4, 1).fill = fill(COLORS.white);
  detail.getCell(4, 1).border = {};

  let dr = 5;
  for (const u of data.users) {
    // Collaborator section header (Anek Latin, ink band)
    detail.mergeCells(dr, 1, dr, DETAIL_SPAN);
    const sec = detail.getCell(dr, 1);
    sec.value = `  ${u.userName}`;
    sec.font = titleFont({ bold: true, size: 12, color: { argb: COLORS.white } });
    sec.fill = fill(COLORS.ink);
    sec.alignment = { vertical: "middle" };
    detail.getRow(dr).height = 22;
    dr++;

    let zebra = false;
    for (const item of u.items) {
      const row = detail.getRow(dr);
      row.getCell(2).value = item.productName;
      row.getCell(3).value = item.percentageApplied / 100;
      row.getCell(4).value = item.grossUsd;
      row.getCell(5).value = item.afterTaxesUsd;
      row.getCell(6).value = item.finalUsd;
      row.getCell(7).value = item.finalMxn;

      row.getCell(3).numFmt = pctFormat;
      [4, 5, 6, 7].forEach((c) => (row.getCell(c).numFmt = currencyFormat));

      const bg = zebra ? COLORS.zebra : COLORS.white;
      for (let c = 2; c <= DETAIL_SPAN; c++) {
        const cell = row.getCell(c);
        cell.fill = fill(bg);
        cell.border = thinBorder;
        cell.alignment = {
          vertical: "middle",
          horizontal: c === 2 ? "left" : c === 3 ? "center" : "right",
          indent: c === 2 ? 1 : 0,
        };
      }
      zebra = !zebra;
      dr++;
    }

    // Adjustments (if any) shown inline under the collaborator
    for (const adj of u.adjustments) {
      const row = detail.getRow(dr);
      const isDeduction = adj.amountUsd < 0;
      row.getCell(2).value = `  • Ajuste: ${adj.description}`;
      row.getCell(6).value = adj.amountUsd;
      row.getCell(6).numFmt = currencyFormat;
      for (let c = 2; c <= DETAIL_SPAN; c++) {
        const cell = row.getCell(c);
        cell.fill = fill(COLORS.white);
        cell.border = thinBorder;
        cell.font = {
          color: { argb: isDeduction ? COLORS.negative : COLORS.muted },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: c === 2 ? "left" : "right",
          indent: c === 2 ? 1 : 0,
        };
      }
      dr++;
    }

    // Subtotal row
    const tr = detail.getRow(dr);
    tr.getCell(2).value = `Total · ${u.userName}`;
    tr.getCell(4).value = u.totalGrossUsd;
    tr.getCell(5).value = u.totalAfterTaxesUsd;
    tr.getCell(6).value = u.totalFinalUsd;
    tr.getCell(7).value = u.totalFinalMxn;
    [4, 5, 6, 7].forEach((c) => (tr.getCell(c).numFmt = currencyFormat));
    for (let c = 1; c <= DETAIL_SPAN; c++) {
      const cell = tr.getCell(c);
      cell.fill = fill(COLORS.totalRow);
      cell.font = { bold: true, color: { argb: COLORS.ink } };
      cell.border = {
        top: { style: "thin", color: { argb: COLORS.accent } },
        bottom: { style: "thin", color: { argb: COLORS.accent } },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: c <= 3 ? "left" : "right",
        indent: c === 2 ? 1 : 0,
      };
    }
    tr.height = 20;
    dr += 2; // gap between collaborators
  }

  // Grand total
  const gr = detail.getRow(dr);
  gr.getCell(2).value = "GRAN TOTAL";
  gr.getCell(6).value = data.grandTotalUsd;
  gr.getCell(7).value = data.grandTotalMxn;
  gr.getCell(6).numFmt = currencyFormat;
  gr.getCell(7).numFmt = currencyFormat;
  for (let c = 1; c <= DETAIL_SPAN; c++) {
    const cell = gr.getCell(c);
    cell.fill = fill(COLORS.ink);
    cell.font = { bold: true, size: 12, color: { argb: COLORS.white } };
    cell.alignment = {
      vertical: "middle",
      horizontal: c <= 5 ? "left" : "right",
      indent: c === 2 ? 1 : 0,
    };
  }
  gr.height = 26;

  // ════════════════════════════════════════════════════════════
  // Sheet 3 · Ajustes
  // ════════════════════════════════════════════════════════════
  const adjSheet = wb.addWorksheet("Ajustes", {
    views: [{ showGridLines: false, state: "frozen", ySplit: 4 }],
  });
  adjSheet.columns = [
    { width: 4 },
    { width: 26 }, // user
    { width: 16 }, // type
    { width: 44 }, // desc
    { width: 16 }, // amount
  ];
  const ADJ_SPAN = 5;

  addBrandBanner({
    wb,
    sheet: adjSheet,
    title: "Ajustes Aplicados",
    subtitle: `${data.partnerName}  ·  ${periodLabel}`,
    colSpan: ADJ_SPAN,
  });

  const adjHeaders = ["Colaborador", "Tipo", "Descripción", "Monto USD"];
  const adjHeaderRow = adjSheet.getRow(4);
  adjHeaders.forEach((h, i) => (adjHeaderRow.getCell(i + 2).value = h));
  styleHeaderRow(adjSheet, 4, ADJ_SPAN);
  adjSheet.getCell(4, 1).fill = fill(COLORS.white);
  adjSheet.getCell(4, 1).border = {};

  let ar = 5;
  let anyAdj = false;
  let zebra = false;
  for (const u of data.users) {
    for (const adj of u.adjustments) {
      anyAdj = true;
      const isDeduction = adj.amountUsd < 0;
      const row = adjSheet.getRow(ar);
      row.getCell(2).value = u.userName;
      row.getCell(3).value = isDeduction ? "Deducción" : "Bono";
      row.getCell(4).value = adj.description;
      row.getCell(5).value = adj.amountUsd;
      row.getCell(5).numFmt = currencyFormat;

      const bg = zebra ? COLORS.zebra : COLORS.white;
      for (let c = 2; c <= ADJ_SPAN; c++) {
        const cell = row.getCell(c);
        cell.fill = fill(bg);
        cell.border = thinBorder;
        cell.alignment = {
          vertical: "middle",
          horizontal: c === 5 ? "right" : "left",
          indent: c === 5 ? 0 : 1,
        };
      }
      // Type badge color
      row.getCell(3).font = {
        bold: true,
        color: { argb: isDeduction ? COLORS.negative : COLORS.positive },
      };
      row.getCell(5).font = {
        bold: true,
        color: { argb: isDeduction ? COLORS.negative : COLORS.positive },
      };
      zebra = !zebra;
      ar++;
    }
  }

  if (!anyAdj) {
    adjSheet.mergeCells(5, 2, 5, ADJ_SPAN);
    const empty = adjSheet.getCell(5, 2);
    empty.value = "No se registraron ajustes en este periodo.";
    empty.font = { italic: true, color: { argb: COLORS.muted } };
    empty.alignment = { horizontal: "center", vertical: "middle" };
    empty.fill = fill(COLORS.zebra);
    adjSheet.getRow(5).height = 24;
  }

  // ════════════════════════════════════════════════════════════
  // Sheet 4 · Impuestos (amount withheld per individual tax)
  // ════════════════════════════════════════════════════════════
  const taxSheet = wb.addWorksheet("Impuestos", {
    views: [{ showGridLines: false, state: "frozen", ySplit: 4 }],
  });
  taxSheet.columns = [
    { width: 4 },
    { width: 32 }, // impuesto
    { width: 12 }, // tasa
    { width: 18 }, // monto usd
    { width: 18 }, // monto mxn
  ];
  const TAX_SPAN = 5;

  addBrandBanner({
    wb,
    sheet: taxSheet,
    title: "Desglose de Impuestos",
    subtitle: `${data.partnerName}  ·  ${periodLabel}`,
    colSpan: TAX_SPAN,
  });

  const taxHeaders = ["Impuesto", "Tasa", "Monto USD", "Monto MXN"];
  const taxHeaderRow = taxSheet.getRow(4);
  taxHeaders.forEach((h, i) => (taxHeaderRow.getCell(i + 2).value = h));
  styleHeaderRow(taxSheet, 4, TAX_SPAN);
  taxSheet.getCell(4, 1).fill = fill(COLORS.white);
  taxSheet.getCell(4, 1).border = {};

  const taxRows = data.taxBreakdown ?? [];
  let txr = 5;
  let taxZebra = false;
  let totalTaxUsd = 0;
  for (const tax of taxRows) {
    totalTaxUsd += tax.totalUsd;
    const row = taxSheet.getRow(txr);
    row.getCell(2).value = tax.name;
    row.getCell(3).value = tax.rate !== null ? tax.rate / 100 : null;
    row.getCell(4).value = tax.totalUsd;
    row.getCell(5).value = tax.totalUsd * data.exchangeRate;
    row.getCell(3).numFmt = pctFormat;
    row.getCell(4).numFmt = currencyFormat;
    row.getCell(5).numFmt = currencyFormat;

    const bg = taxZebra ? COLORS.zebra : COLORS.white;
    for (let c = 2; c <= TAX_SPAN; c++) {
      const cell = row.getCell(c);
      cell.fill = fill(bg);
      cell.border = thinBorder;
      cell.alignment = {
        vertical: "middle",
        horizontal: c === 2 ? "left" : "right",
        indent: c === 2 ? 1 : 0,
      };
    }
    taxZebra = !taxZebra;
    txr++;
  }

  if (taxRows.length === 0) {
    taxSheet.mergeCells(5, 2, 5, TAX_SPAN);
    const empty = taxSheet.getCell(5, 2);
    empty.value = "No se aplicaron impuestos en este periodo.";
    empty.font = { italic: true, color: { argb: COLORS.muted } };
    empty.alignment = { horizontal: "center", vertical: "middle" };
    empty.fill = fill(COLORS.zebra);
    taxSheet.getRow(5).height = 24;
  } else {
    // Total row
    const tr = taxSheet.getRow(txr);
    tr.getCell(2).value = "Total Impuestos";
    tr.getCell(4).value = totalTaxUsd;
    tr.getCell(5).value = totalTaxUsd * data.exchangeRate;
    tr.getCell(4).numFmt = currencyFormat;
    tr.getCell(5).numFmt = currencyFormat;
    for (let c = 1; c <= TAX_SPAN; c++) {
      const cell = tr.getCell(c);
      cell.fill = fill(COLORS.totalRow);
      cell.font = { bold: true, color: { argb: COLORS.ink } };
      cell.border = {
        top: { style: "thin", color: { argb: COLORS.accent } },
        bottom: { style: "thin", color: { argb: COLORS.accent } },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: c === 2 ? "left" : "right",
        indent: c === 2 ? 1 : 0,
      };
    }
    tr.height = 20;
  }

  // Brand footer on every sheet (consistent with the other exports).
  const footer = `BoxBuild · Generado el ${generatedAt}`;
  summary.addRow([]);
  addBrandFooter(summary, footer, 4);
  detail.addRow([]);
  addBrandFooter(detail, footer, DETAIL_SPAN);
  adjSheet.addRow([]);
  addBrandFooter(adjSheet, footer, ADJ_SPAN);
  taxSheet.addRow([]);
  addBrandFooter(taxSheet, footer, TAX_SPAN);

  // Apply Sora to any data cell that didn't get an explicit brand font.
  applyBodyFontDefault(summary);
  applyBodyFontDefault(detail);
  applyBodyFontDefault(adjSheet);
  applyBodyFontDefault(taxSheet);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
