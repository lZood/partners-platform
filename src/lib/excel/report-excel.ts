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

const headerStyle: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: "FFFFFFFF" }, size: 11 },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } },
  alignment: { horizontal: "center", vertical: "middle" },
  border: {
    bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
  },
};

const currencyFormat = '"$"#,##0.00';

export async function generateReportExcel(data: ReportExcelData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BoxFi Partners";

  // Sheet 1: Summary
  const summary = wb.addWorksheet("Resumen");
  summary.columns = [
    { header: "Campo", key: "field", width: 25 },
    { header: "Valor", key: "value", width: 30 },
  ];
  summary.getRow(1).eachCell((c) => Object.assign(c, { style: headerStyle }));
  summary.addRow({ field: "Partner", value: data.partnerName });
  summary.addRow({ field: "Periodo", value: data.reportMonth });
  summary.addRow({ field: "Tipo de Cambio", value: data.exchangeRate });
  summary.addRow({ field: "Estado", value: data.isLocked ? "Bloqueado" : "Borrador" });
  summary.addRow({ field: "Total USD", value: data.grandTotalUsd });
  summary.addRow({ field: "Total MXN", value: data.grandTotalMxn });
  summary.addRow({ field: "Colaboradores", value: data.users.length });
  summary.getCell("B5").numFmt = currencyFormat;
  summary.getCell("B6").numFmt = currencyFormat;

  // Sheet 2: Detail
  const detail = wb.addWorksheet("Detalle");
  detail.columns = [
    { header: "Colaborador", key: "user", width: 22 },
    { header: "Producto", key: "product", width: 28 },
    { header: "%", key: "pct", width: 8 },
    { header: "Bruto USD", key: "gross", width: 14 },
    { header: "Post-Tax USD", key: "afterTax", width: 14 },
    { header: "Neto USD", key: "finalUsd", width: 14 },
    { header: "Neto MXN", key: "finalMxn", width: 14 },
  ];
  detail.getRow(1).eachCell((c) => Object.assign(c, { style: headerStyle }));

  for (const u of data.users) {
    for (const item of u.items) {
      const row = detail.addRow({
        user: u.userName,
        product: item.productName,
        pct: item.percentageApplied,
        gross: item.grossUsd,
        afterTax: item.afterTaxesUsd,
        finalUsd: item.finalUsd,
        finalMxn: item.finalMxn,
      });
      row.getCell("gross").numFmt = currencyFormat;
      row.getCell("afterTax").numFmt = currencyFormat;
      row.getCell("finalUsd").numFmt = currencyFormat;
      row.getCell("finalMxn").numFmt = currencyFormat;
    }
    // User total row
    const totalRow = detail.addRow({
      user: "",
      product: `TOTAL ${u.userName}`,
      pct: "",
      gross: u.totalGrossUsd,
      afterTax: u.totalAfterTaxesUsd,
      finalUsd: u.totalFinalUsd,
      finalMxn: u.totalFinalMxn,
    });
    totalRow.font = { bold: true };
    totalRow.getCell("gross").numFmt = currencyFormat;
    totalRow.getCell("afterTax").numFmt = currencyFormat;
    totalRow.getCell("finalUsd").numFmt = currencyFormat;
    totalRow.getCell("finalMxn").numFmt = currencyFormat;
  }

  // Sheet 3: Adjustments
  const adjSheet = wb.addWorksheet("Ajustes");
  adjSheet.columns = [
    { header: "Colaborador", key: "user", width: 22 },
    { header: "Tipo", key: "type", width: 15 },
    { header: "Descripcion", key: "desc", width: 35 },
    { header: "Monto USD", key: "amount", width: 14 },
  ];
  adjSheet.getRow(1).eachCell((c) => Object.assign(c, { style: headerStyle }));

  for (const u of data.users) {
    for (const adj of u.adjustments) {
      const row = adjSheet.addRow({
        user: u.userName,
        type: adj.type,
        desc: adj.description,
        amount: adj.amountUsd,
      });
      row.getCell("amount").numFmt = currencyFormat;
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
