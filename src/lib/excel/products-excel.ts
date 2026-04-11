import ExcelJS from "exceljs";

interface ProductExcelData {
  products: {
    name: string;
    productType: string;
    category: string | null;
    partner: string;
    isActive: boolean;
    lifecycleStatus: string | null;
    collaborators: string;
    createdAt: string;
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

const lifecycleLabels: Record<string, string> = {
  active: "Activo",
  development: "En desarrollo",
  maintenance: "Mantenimiento",
  deprecated: "Deprecado",
  archived: "Archivado",
};

export async function generateProductsExcel(
  data: ProductExcelData
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BoxFi Partners";

  const ws = wb.addWorksheet("Productos");

  ws.columns = [
    { header: "Producto", key: "name", width: 30 },
    { header: "Tipo", key: "productType", width: 18 },
    { header: "Categoria", key: "category", width: 18 },
    { header: "Partner", key: "partner", width: 22 },
    { header: "Estado", key: "status", width: 12 },
    { header: "Ciclo de vida", key: "lifecycle", width: 16 },
    { header: "Colaboradores", key: "collaborators", width: 35 },
    { header: "Fecha de creacion", key: "createdAt", width: 18 },
  ];

  // Style header row
  ws.getRow(1).eachCell((cell) => {
    Object.assign(cell, { style: headerStyle });
  });
  ws.getRow(1).height = 28;

  // Add data
  for (const p of data.products) {
    ws.addRow({
      name: p.name,
      productType: p.productType,
      category: p.category ?? "—",
      partner: p.partner,
      status: p.isActive ? "Activo" : "Inactivo",
      lifecycle: lifecycleLabels[p.lifecycleStatus ?? ""] ?? p.lifecycleStatus ?? "—",
      collaborators: p.collaborators || "Sin asignar",
      createdAt: new Date(p.createdAt).toLocaleDateString("es-MX"),
    });
  }

  // Alternate row colors
  ws.eachRow((row, i) => {
    if (i > 1 && i % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" },
        };
      });
    }
  });

  ws.autoFilter = { from: "A1", to: "H1" };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
