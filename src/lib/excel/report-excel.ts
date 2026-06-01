import ExcelJS from "exceljs";

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
}

// ── Brand palette ──────────────────────────────────────────────
const COLORS = {
  brand: "FF1E3A8A", // deep blue (banner)
  brandLight: "FF3B82F6", // blue (table headers)
  accent: "FF0EA5E9", // sky (section headers)
  totalRow: "FFDBEAFE", // light blue (subtotals)
  grandTotal: "FF1E3A8A", // deep blue (grand total)
  zebra: "FFF1F5F9", // slate-100 (alt rows)
  white: "FFFFFFFF",
  textDark: "FF1F2937",
  muted: "FF6B7280",
  border: "FFE5E7EB",
  positive: "FF059669", // green
  negative: "FFDC2626", // red
};

const currencyFormat = '"$"#,##0.00';
const pctFormat = "0.0%";

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: COLORS.border } },
  left: { style: "thin", color: { argb: COLORS.border } },
  bottom: { style: "thin", color: { argb: COLORS.border } },
  right: { style: "thin", color: { argb: COLORS.border } },
};

function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

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

/** Paint a branded banner across the given number of columns on `sheet`. */
function addBanner(
  sheet: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  colSpan: number
) {
  // Title row
  sheet.mergeCells(1, 1, 1, colSpan);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 18, color: { argb: COLORS.white } };
  titleCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  titleCell.fill = fill(COLORS.brand);
  sheet.getRow(1).height = 34;

  // Subtitle row
  sheet.mergeCells(2, 1, 2, colSpan);
  const subCell = sheet.getCell(2, 1);
  subCell.value = subtitle;
  subCell.font = { size: 11, color: { argb: COLORS.white }, italic: true };
  subCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  subCell.fill = fill(COLORS.brandLight);
  sheet.getRow(2).height = 20;
}

/** Style a header row (1-based index) with the brand table-header look. */
function styleHeaderRow(sheet: ExcelJS.Worksheet, rowIdx: number, colSpan: number) {
  const row = sheet.getRow(rowIdx);
  row.height = 22;
  for (let c = 1; c <= colSpan; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true, color: { argb: COLORS.white }, size: 11 };
    cell.fill = fill(COLORS.brandLight);
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  }
}

export async function generateReportExcel(data: ReportExcelData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BoxFi Partners";
  wb.created = new Date(0); // deterministic; avoids Date.now usage concerns
  const periodLabel = formatMonth(data.reportMonth);

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

  addBanner(
    summary,
    "Reporte de Ganancias",
    `${data.partnerName}  ·  ${periodLabel}`,
    4
  );

  let r = 4;
  const statusLabel = data.isLocked ? "Bloqueado" : "Borrador";
  const statusColor = data.isLocked ? COLORS.positive : COLORS.muted;

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
    head.fill = fill(COLORS.accent);
    head.alignment = { horizontal: "center", vertical: "middle" };
    summary.getRow(r).height = 18;

    summary.mergeCells(r + 1, 2, r + 1, 3);
    const body = summary.getCell(r + 1, 2);
    body.value = value;
    body.numFmt = fmt;
    body.font = { bold: true, size: 20, color: { argb: COLORS.brand } };
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

  addBanner(
    detail,
    "Detalle por Colaborador",
    `${data.partnerName}  ·  ${periodLabel}`,
    DETAIL_SPAN
  );

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
    // Collaborator section header
    detail.mergeCells(dr, 1, dr, DETAIL_SPAN);
    const sec = detail.getCell(dr, 1);
    sec.value = `  ${u.userName}`;
    sec.font = { bold: true, size: 12, color: { argb: COLORS.white } };
    sec.fill = fill(COLORS.accent);
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
      row.getCell(2).value = `  ↳ Ajuste: ${adj.description}`;
      row.getCell(6).value = adj.amountUsd;
      row.getCell(6).numFmt = currencyFormat;
      for (let c = 2; c <= DETAIL_SPAN; c++) {
        const cell = row.getCell(c);
        cell.fill = fill(COLORS.white);
        cell.border = thinBorder;
        cell.font = {
          italic: true,
          color: { argb: isDeduction ? COLORS.negative : COLORS.positive },
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
      cell.font = { bold: true, color: { argb: COLORS.brand } };
      cell.border = {
        top: { style: "thin", color: { argb: COLORS.brandLight } },
        bottom: { style: "thin", color: { argb: COLORS.brandLight } },
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
    cell.fill = fill(COLORS.grandTotal);
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

  addBanner(
    adjSheet,
    "Ajustes Aplicados",
    `${data.partnerName}  ·  ${periodLabel}`,
    ADJ_SPAN
  );

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

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
