import ExcelJS from "exceljs";

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

const headerStyle: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: "FFFFFFFF" }, size: 11 },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF22C55E" } },
  alignment: { horizontal: "center", vertical: "middle" },
};

const currencyFormat = '"$"#,##0.00';

export async function generatePaymentsExcel(data: PaymentExcelData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BoxFi Partners";

  // Sheet 1: Summary
  const sheet = wb.addWorksheet("Pagos");
  sheet.columns = [
    { header: "Fecha", key: "date", width: 14 },
    { header: "Colaborador", key: "user", width: 22 },
    { header: "Total USD", key: "usd", width: 14 },
    { header: "Total MXN", key: "mxn", width: 14 },
    { header: "Tipo Cambio", key: "rate", width: 12 },
    { header: "Metodo", key: "method", width: 18 },
  ];
  sheet.getRow(1).eachCell((c) => Object.assign(c, { style: headerStyle }));

  let grandTotalUsd = 0;
  let grandTotalMxn = 0;

  for (const p of data.payments) {
    const row = sheet.addRow({
      date: new Date(p.paidAt).toLocaleDateString("es-MX"),
      user: p.userName,
      usd: p.totalUsd,
      mxn: p.totalMxn,
      rate: p.exchangeRate,
      method: p.paymentMethod ?? "—",
    });
    row.getCell("usd").numFmt = currencyFormat;
    row.getCell("mxn").numFmt = currencyFormat;
    grandTotalUsd += p.totalUsd;
    grandTotalMxn += p.totalMxn;
  }

  // Totals row
  const totalRow = sheet.addRow({
    date: "",
    user: "TOTAL",
    usd: grandTotalUsd,
    mxn: grandTotalMxn,
    rate: "",
    method: "",
  });
  totalRow.font = { bold: true, size: 12 };
  totalRow.getCell("usd").numFmt = currencyFormat;
  totalRow.getCell("mxn").numFmt = currencyFormat;

  // Sheet 2: Detail
  const detail = wb.addWorksheet("Detalle");
  detail.columns = [
    { header: "Fecha", key: "date", width: 14 },
    { header: "Colaborador", key: "user", width: 22 },
    { header: "Concepto", key: "desc", width: 40 },
    { header: "Monto USD", key: "usd", width: 14 },
    { header: "Monto MXN", key: "mxn", width: 14 },
  ];
  detail.getRow(1).eachCell((c) => Object.assign(c, { style: headerStyle }));

  for (const p of data.payments) {
    for (const item of p.items) {
      const row = detail.addRow({
        date: new Date(p.paidAt).toLocaleDateString("es-MX"),
        user: p.userName,
        desc: item.description,
        usd: item.amountUsd,
        mxn: item.amountMxn,
      });
      row.getCell("usd").numFmt = currencyFormat;
      row.getCell("mxn").numFmt = currencyFormat;
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
