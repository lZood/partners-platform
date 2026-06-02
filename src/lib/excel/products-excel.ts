import ExcelJS from "exceljs";
import { XLS } from "@/lib/brand/theme";
import {
  addBrandBanner,
  styleHeaderRow,
  fill,
  thinBorder,
  addBrandFooter,
  applyBodyFontDefault,
} from "@/lib/brand/excel-brand";

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
  wb.creator = "BoxBuild";

  const generatedAt = new Date().toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const ws = wb.addWorksheet("Productos", {
    views: [{ showGridLines: false, state: "frozen", ySplit: 4 }],
  });

  ws.columns = [
    { key: "name", width: 30 },
    { key: "productType", width: 18 },
    { key: "category", width: 18 },
    { key: "partner", width: 22 },
    { key: "status", width: 12 },
    { key: "lifecycle", width: 16 },
    { key: "collaborators", width: 35 },
    { key: "createdAt", width: 18 },
  ];
  const SPAN = 8;

  addBrandBanner({
    wb,
    sheet: ws,
    title: "Productos",
    subtitle: `${data.products.length} producto(s)`,
    colSpan: SPAN,
  });
  ws.addRow([]); // spacer

  const headerRow = ws.addRow([
    "Producto",
    "Tipo",
    "Categoría",
    "Partner",
    "Estado",
    "Ciclo de vida",
    "Colaboradores",
    "Fecha de creación",
  ]);
  styleHeaderRow(ws, headerRow.number, SPAN);

  let zebra = false;
  for (const p of data.products) {
    const row = ws.addRow([
      p.name,
      p.productType,
      p.category ?? "—",
      p.partner,
      p.isActive ? "Activo" : "Inactivo",
      lifecycleLabels[p.lifecycleStatus ?? ""] ?? p.lifecycleStatus ?? "—",
      p.collaborators || "Sin asignar",
      new Date(p.createdAt).toLocaleDateString("es-MX"),
    ]);
    const bg = zebra ? XLS.paper : XLS.white;
    for (let c = 1; c <= SPAN; c++) {
      const cell = row.getCell(c);
      cell.fill = fill(bg);
      cell.border = thinBorder;
      cell.alignment = { vertical: "middle", horizontal: "left" };
    }
    zebra = !zebra;
  }

  ws.autoFilter = `A${headerRow.number}:H${headerRow.number}`;
  ws.addRow([]);
  addBrandFooter(ws, `BoxBuild · Generado el ${generatedAt}`, SPAN);

  applyBodyFontDefault(ws);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
