import ExcelJS from "exceljs";
import { XLS, NUM_FMT } from "@/lib/brand/theme";
import {
  addBrandBanner,
  styleHeaderRow,
  fill,
  thinBorder,
  bodyFont,
  titleFont,
  addBrandFooter,
  applyBodyFontDefault,
} from "@/lib/brand/excel-brand";

interface FiscalUserData {
  userName: string;
  userEmail: string | null;
  totalGrossUsd: number;
  totalTaxesUsd: number;
  totalNetUsd: number;
  totalNetMxn: number;
  totalPaymentsReceived: number;
  months: {
    month: string;
    label: string;
    grossUsd: number;
    taxesUsd: number;
    netUsd: number;
    exchangeRate: number;
    netMxn: number;
  }[];
  adjustments: {
    type: string;
    description: string;
    amountUsd: number;
    month: string;
  }[];
}

interface FiscalExcelData {
  year: number;
  partnerName: string | null;
  users: FiscalUserData[];
}

const currencyFormat = NUM_FMT.usd;

export async function generateFiscalExcel(data: FiscalExcelData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BoxBuild";

  const generatedAt = new Date().toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const partnerLabel = data.partnerName ?? "Todos los partners";

  // ── Summary sheet ─────────────────────────────────────────────
  const summary = wb.addWorksheet("Resumen Fiscal", {
    views: [{ showGridLines: false, state: "frozen", ySplit: 4 }],
  });
  summary.columns = [
    { key: "user", width: 24 },
    { key: "email", width: 30 },
    { key: "gross", width: 15 },
    { key: "taxes", width: 16 },
    { key: "net", width: 15 },
    { key: "mxn", width: 16 },
    { key: "payments", width: 16 },
  ];
  const SPAN = 7;

  addBrandBanner({
    wb,
    sheet: summary,
    title: `Reporte Fiscal ${data.year}`,
    subtitle: partnerLabel,
    colSpan: SPAN,
  });
  summary.addRow([]); // spacer

  const sumHeader = summary.addRow([
    "Colaborador",
    "Email",
    "Bruto USD",
    "Impuestos USD",
    "Neto USD",
    "Neto MXN",
    "Pagos Recibidos",
  ]);
  styleHeaderRow(summary, sumHeader.number, SPAN);

  let totGross = 0;
  let totTaxes = 0;
  let totNet = 0;
  let totMxn = 0;
  let zebra = false;

  for (const u of data.users) {
    const row = summary.addRow([
      u.userName,
      u.userEmail ?? "—",
      u.totalGrossUsd,
      u.totalTaxesUsd,
      u.totalNetUsd,
      u.totalNetMxn,
      u.totalPaymentsReceived,
    ]);
    [3, 4, 5, 6, 7].forEach((c) => (row.getCell(c).numFmt = currencyFormat));
    const bg = zebra ? XLS.paper : XLS.white;
    for (let c = 1; c <= SPAN; c++) {
      const cell = row.getCell(c);
      cell.fill = fill(bg);
      cell.border = thinBorder;
      cell.alignment = { vertical: "middle", horizontal: c >= 3 ? "right" : "left" };
    }
    zebra = !zebra;
    totGross += u.totalGrossUsd;
    totTaxes += u.totalTaxesUsd;
    totNet += u.totalNetUsd;
    totMxn += u.totalNetMxn;
  }

  const totalRow = summary.addRow([
    "TOTAL",
    "",
    totGross,
    totTaxes,
    totNet,
    totMxn,
    "",
  ]);
  [3, 4, 5, 6].forEach((c) => (totalRow.getCell(c).numFmt = currencyFormat));
  for (let c = 1; c <= SPAN; c++) {
    const cell = totalRow.getCell(c);
    cell.fill = fill(XLS.ink);
    cell.font = bodyFont({ bold: true, size: 11, color: { argb: XLS.white } });
    cell.alignment = { vertical: "middle", horizontal: c >= 3 ? "right" : "left" };
  }
  totalRow.height = 22;

  summary.autoFilter = `A${sumHeader.number}:G${sumHeader.number}`;
  summary.addRow([]);
  addBrandFooter(summary, `BoxBuild · Generado el ${generatedAt}`, SPAN);
  applyBodyFontDefault(summary);

  // ── One sheet per user with monthly breakdown ─────────────────
  const USER_SPAN = 6;
  for (const u of data.users) {
    const sheetName = u.userName.substring(0, 28); // Excel max 31 chars
    const sheet = wb.addWorksheet(sheetName, {
      // Freeze banner + spacer + header (rows 1-4) so the monthly header stays
      // visible while scrolling — consistent with the summary sheet.
      views: [{ showGridLines: false, state: "frozen", ySplit: 4 }],
    });
    sheet.columns = [
      { width: 16 },
      { width: 15 },
      { width: 16 },
      { width: 15 },
      { width: 10 },
      { width: 16 },
    ];

    addBrandBanner({
      wb,
      sheet,
      title: u.userName,
      subtitle: `Reporte Fiscal ${data.year}  ·  ${u.userEmail ?? "—"}  ·  ${partnerLabel}`,
      colSpan: USER_SPAN,
    });
    sheet.addRow([]); // spacer

    // Monthly breakdown
    const monthHeader = sheet.addRow([
      "Mes",
      "Bruto USD",
      "Impuestos USD",
      "Neto USD",
      "T/C",
      "Neto MXN",
    ]);
    styleHeaderRow(sheet, monthHeader.number, USER_SPAN);

    let mZebra = false;
    for (const m of u.months) {
      const row = sheet.addRow([
        m.label,
        m.grossUsd,
        m.taxesUsd,
        m.netUsd,
        m.exchangeRate,
        m.netMxn,
      ]);
      [2, 3, 4, 6].forEach((i) => (row.getCell(i).numFmt = currencyFormat));
      const bg = mZebra ? XLS.paper : XLS.white;
      for (let c = 1; c <= USER_SPAN; c++) {
        const cell = row.getCell(c);
        cell.fill = fill(bg);
        cell.border = thinBorder;
        cell.alignment = { vertical: "middle", horizontal: c === 1 ? "left" : "right" };
      }
      mZebra = !mZebra;
    }

    // User totals
    const utRow = sheet.addRow([
      "TOTAL",
      u.totalGrossUsd,
      u.totalTaxesUsd,
      u.totalNetUsd,
      "",
      u.totalNetMxn,
    ]);
    [2, 3, 4, 6].forEach((i) => (utRow.getCell(i).numFmt = currencyFormat));
    for (let c = 1; c <= USER_SPAN; c++) {
      const cell = utRow.getCell(c);
      cell.fill = fill(XLS.ink);
      cell.font = bodyFont({ bold: true, color: { argb: XLS.white } });
      cell.alignment = { vertical: "middle", horizontal: c === 1 ? "left" : "right" };
    }
    utRow.height = 20;

    // Adjustments
    if (u.adjustments.length > 0) {
      sheet.addRow([]);
      const secRow = sheet.addRow(["Ajustes del Periodo"]);
      sheet.mergeCells(secRow.number, 1, secRow.number, USER_SPAN);
      secRow.getCell(1).value = "Ajustes del Periodo";
      secRow.getCell(1).font = titleFont({ bold: true, size: 12, color: { argb: XLS.white } });
      secRow.getCell(1).fill = fill(XLS.ink);
      secRow.getCell(1).alignment = { vertical: "middle", indent: 1 };
      secRow.height = 20;

      const adjHeader = sheet.addRow(["Tipo", "Descripción", "Monto USD", "Mes"]);
      styleHeaderRow(sheet, adjHeader.number, 4);

      let aZebra = false;
      for (const adj of u.adjustments) {
        const isDeduction = adj.amountUsd < 0;
        const row = sheet.addRow([
          adj.type,
          adj.description,
          adj.amountUsd,
          adj.month,
        ]);
        row.getCell(3).numFmt = currencyFormat;
        const bg = aZebra ? XLS.paper : XLS.white;
        for (let c = 1; c <= 4; c++) {
          const cell = row.getCell(c);
          cell.fill = fill(bg);
          cell.border = thinBorder;
          cell.alignment = { vertical: "middle", horizontal: c === 3 ? "right" : "left" };
        }
        row.getCell(3).font = bodyFont({
          bold: true,
          color: { argb: isDeduction ? XLS.negative : XLS.ink },
        });
        aZebra = !aZebra;
      }
    }

    sheet.addRow([]);
    addBrandFooter(sheet, `BoxBuild · Generado el ${generatedAt}`, USER_SPAN);
    applyBodyFontDefault(sheet);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
