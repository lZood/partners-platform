import ExcelJS from "exceljs";
import { XLS, NUM_FMT } from "@/lib/brand/theme";
import {
  addBrandBanner,
  styleHeaderRow,
  fill,
  thinBorder,
  bodyFont,
  addBrandFooter,
  applyBodyFontDefault,
} from "@/lib/brand/excel-brand";

interface PaymentExcelData {
  fromDate: string;
  toDate: string;
  partnerName: string | null;
  payments: {
    paidAt: string;
    userName: string;
    totalUsd: number;
    totalMxn: number;
    exchangeRate: number;
    paymentMethod: string | null;
    items: { description: string; amountUsd: number; amountMxn: number }[];
  }[];
}

const currencyFormat = NUM_FMT.usd;

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-MX");
  } catch {
    return iso;
  }
}

export async function generatePaymentsExcel(data: PaymentExcelData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BoxBuild";

  const subtitle = `${data.partnerName ?? "Todos los partners"}  ·  ${fmtDate(
    data.fromDate
  )} – ${fmtDate(data.toDate)}`;
  const generatedAt = new Date().toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // ── Sheet 1 · Pagos ───────────────────────────────────────────
  const sheet = wb.addWorksheet("Pagos", {
    views: [{ showGridLines: false, state: "frozen", ySplit: 4 }],
  });
  sheet.columns = [
    { key: "date", width: 14 },
    { key: "user", width: 24 },
    { key: "usd", width: 15 },
    { key: "mxn", width: 15 },
    { key: "rate", width: 13 },
    { key: "method", width: 18 },
  ];
  const SPAN = 6;

  addBrandBanner({ wb, sheet, title: "Pagos", subtitle, colSpan: SPAN });
  sheet.addRow([]); // spacer (row 3)

  const headerRow = sheet.addRow([
    "Fecha",
    "Colaborador",
    "Total USD",
    "Total MXN",
    "Tipo de cambio",
    "Método",
  ]);
  styleHeaderRow(sheet, headerRow.number, SPAN);

  let grandTotalUsd = 0;
  let grandTotalMxn = 0;
  let zebra = false;

  for (const p of data.payments) {
    const row = sheet.addRow([
      fmtDate(p.paidAt),
      p.userName,
      p.totalUsd,
      p.totalMxn,
      p.exchangeRate,
      p.paymentMethod ?? "—",
    ]);
    row.getCell(3).numFmt = currencyFormat;
    row.getCell(4).numFmt = currencyFormat;
    row.getCell(5).numFmt = currencyFormat;
    const bg = zebra ? XLS.paper : XLS.white;
    for (let c = 1; c <= SPAN; c++) {
      const cell = row.getCell(c);
      cell.fill = fill(bg);
      cell.border = thinBorder;
      cell.alignment = {
        vertical: "middle",
        horizontal: c >= 3 && c <= 5 ? "right" : "left",
      };
    }
    zebra = !zebra;
    grandTotalUsd += p.totalUsd;
    grandTotalMxn += p.totalMxn;
  }

  const totalRow = sheet.addRow(["", "TOTAL", grandTotalUsd, grandTotalMxn, "", ""]);
  totalRow.getCell(3).numFmt = currencyFormat;
  totalRow.getCell(4).numFmt = currencyFormat;
  for (let c = 1; c <= SPAN; c++) {
    const cell = totalRow.getCell(c);
    cell.fill = fill(XLS.ink);
    cell.font = bodyFont({ bold: true, size: 11, color: { argb: XLS.white } });
    cell.alignment = {
      vertical: "middle",
      horizontal: c >= 3 && c <= 4 ? "right" : "left",
    };
  }
  totalRow.height = 22;

  sheet.autoFilter = `A${headerRow.number}:F${headerRow.number}`;

  sheet.addRow([]);
  addBrandFooter(sheet, `BoxBuild · Generado el ${generatedAt}`, SPAN);

  // ── Sheet 2 · Detalle ─────────────────────────────────────────
  const detail = wb.addWorksheet("Detalle", {
    views: [{ showGridLines: false, state: "frozen", ySplit: 4 }],
  });
  detail.columns = [
    { key: "date", width: 14 },
    { key: "user", width: 24 },
    { key: "desc", width: 42 },
    { key: "usd", width: 15 },
    { key: "mxn", width: 15 },
  ];
  const DSPAN = 5;

  addBrandBanner({
    wb,
    sheet: detail,
    title: "Detalle de Conceptos",
    subtitle,
    colSpan: DSPAN,
  });
  detail.addRow([]); // spacer

  const dHeader = detail.addRow([
    "Fecha",
    "Colaborador",
    "Concepto",
    "Monto USD",
    "Monto MXN",
  ]);
  styleHeaderRow(detail, dHeader.number, DSPAN);

  let dZebra = false;
  for (const p of data.payments) {
    for (const item of p.items) {
      const row = detail.addRow([
        fmtDate(p.paidAt),
        p.userName,
        item.description,
        item.amountUsd,
        item.amountMxn,
      ]);
      row.getCell(4).numFmt = currencyFormat;
      row.getCell(5).numFmt = currencyFormat;
      const bg = dZebra ? XLS.paper : XLS.white;
      for (let c = 1; c <= DSPAN; c++) {
        const cell = row.getCell(c);
        cell.fill = fill(bg);
        cell.border = thinBorder;
        cell.alignment = {
          vertical: "middle",
          horizontal: c >= 4 ? "right" : "left",
        };
      }
      dZebra = !dZebra;
    }
  }

  detail.autoFilter = `A${dHeader.number}:E${dHeader.number}`;
  detail.addRow([]);
  addBrandFooter(detail, `BoxBuild · Generado el ${generatedAt}`, DSPAN);

  applyBodyFontDefault(sheet);
  applyBodyFontDefault(detail);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
