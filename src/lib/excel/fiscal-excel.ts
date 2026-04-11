import ExcelJS from "exceljs";

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

const headerStyle: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: "FFFFFFFF" }, size: 11 },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } },
  alignment: { horizontal: "center", vertical: "middle" },
};

const currencyFormat = '"$"#,##0.00';

export async function generateFiscalExcel(data: FiscalExcelData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BoxFi Partners";

  // Summary sheet
  const summary = wb.addWorksheet("Resumen Fiscal");
  summary.columns = [
    { header: "Colaborador", key: "user", width: 22 },
    { header: "Email", key: "email", width: 28 },
    { header: "Bruto USD", key: "gross", width: 14 },
    { header: "Impuestos USD", key: "taxes", width: 14 },
    { header: "Neto USD", key: "net", width: 14 },
    { header: "Neto MXN", key: "mxn", width: 14 },
    { header: "Pagos Recibidos", key: "payments", width: 14 },
  ];
  summary.getRow(1).eachCell((c) => Object.assign(c, { style: headerStyle }));

  let totGross = 0;
  let totTaxes = 0;
  let totNet = 0;
  let totMxn = 0;

  for (const u of data.users) {
    const row = summary.addRow({
      user: u.userName,
      email: u.userEmail ?? "—",
      gross: u.totalGrossUsd,
      taxes: u.totalTaxesUsd,
      net: u.totalNetUsd,
      mxn: u.totalNetMxn,
      payments: u.totalPaymentsReceived,
    });
    ["gross", "taxes", "net", "mxn", "payments"].forEach((k) => {
      row.getCell(k).numFmt = currencyFormat;
    });
    totGross += u.totalGrossUsd;
    totTaxes += u.totalTaxesUsd;
    totNet += u.totalNetUsd;
    totMxn += u.totalNetMxn;
  }

  const totalRow = summary.addRow({
    user: "TOTAL",
    email: "",
    gross: totGross,
    taxes: totTaxes,
    net: totNet,
    mxn: totMxn,
    payments: "",
  });
  totalRow.font = { bold: true, size: 12 };
  ["gross", "taxes", "net", "mxn"].forEach((k) => {
    totalRow.getCell(k).numFmt = currencyFormat;
  });

  // One sheet per user with monthly breakdown
  for (const u of data.users) {
    const sheetName = u.userName.substring(0, 28); // Excel max 31 chars
    const sheet = wb.addWorksheet(sheetName);

    // Header info
    sheet.addRow([`Reporte Fiscal ${data.year}`]);
    sheet.getRow(1).font = { bold: true, size: 14 };
    sheet.addRow([`Colaborador: ${u.userName}`]);
    sheet.addRow([`Email: ${u.userEmail ?? "—"}`]);
    if (data.partnerName) sheet.addRow([`Partner: ${data.partnerName}`]);
    sheet.addRow([]);

    // Monthly breakdown
    sheet.addRow(["Mes", "Bruto USD", "Impuestos USD", "Neto USD", "T/C", "Neto MXN"]);
    const headerRow = sheet.lastRow!;
    headerRow.eachCell((c) => Object.assign(c, { style: headerStyle }));
    sheet.getColumn(1).width = 16;
    sheet.getColumn(2).width = 14;
    sheet.getColumn(3).width = 14;
    sheet.getColumn(4).width = 14;
    sheet.getColumn(5).width = 10;
    sheet.getColumn(6).width = 14;

    for (const m of u.months) {
      const row = sheet.addRow([
        m.label,
        m.grossUsd,
        m.taxesUsd,
        m.netUsd,
        m.exchangeRate,
        m.netMxn,
      ]);
      [2, 3, 4, 6].forEach((i) => {
        row.getCell(i).numFmt = currencyFormat;
      });
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
    utRow.font = { bold: true };
    [2, 3, 4, 6].forEach((i) => {
      utRow.getCell(i).numFmt = currencyFormat;
    });

    // Adjustments
    if (u.adjustments.length > 0) {
      sheet.addRow([]);
      sheet.addRow(["Ajustes del Periodo"]);
      sheet.lastRow!.font = { bold: true, size: 12 };
      sheet.addRow(["Tipo", "Descripcion", "Monto USD", "Mes"]);
      sheet.lastRow!.eachCell((c) => Object.assign(c, { style: headerStyle }));
      for (const adj of u.adjustments) {
        const row = sheet.addRow([adj.type, adj.description, adj.amountUsd, adj.month]);
        row.getCell(3).numFmt = currencyFormat;
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
