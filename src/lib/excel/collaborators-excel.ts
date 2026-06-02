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

interface CollaboratorExcelData {
  collaborators: {
    name: string;
    email: string | null;
    userType: string;
    isActive: boolean;
    partners: string;
    roles: string;
    createdAt: string;
    lastActivity: string | null;
  }[];
}

export async function generateCollaboratorsExcel(
  data: CollaboratorExcelData
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BoxBuild";

  const generatedAt = new Date().toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const ws = wb.addWorksheet("Colaboradores", {
    views: [{ showGridLines: false, state: "frozen", ySplit: 4 }],
  });

  ws.columns = [
    { key: "name", width: 28 },
    { key: "email", width: 30 },
    { key: "userType", width: 16 },
    { key: "status", width: 12 },
    { key: "partners", width: 30 },
    { key: "roles", width: 20 },
    { key: "createdAt", width: 18 },
    { key: "lastActivity", width: 18 },
  ];
  const SPAN = 8;

  addBrandBanner({
    wb,
    sheet: ws,
    title: "Colaboradores",
    subtitle: `${data.collaborators.length} colaborador(es)`,
    colSpan: SPAN,
  });
  ws.addRow([]); // spacer

  const headerRow = ws.addRow([
    "Nombre",
    "Email",
    "Tipo",
    "Estado",
    "Partners",
    "Roles",
    "Fecha de registro",
    "Última actividad",
  ]);
  styleHeaderRow(ws, headerRow.number, SPAN);

  let zebra = false;
  for (const c of data.collaborators) {
    const row = ws.addRow([
      c.name,
      c.email ?? "—",
      c.userType === "system_user" ? "Sistema" : "Virtual",
      c.isActive ? "Activo" : "Inactivo",
      c.partners || "Sin asignar",
      c.roles || "—",
      new Date(c.createdAt).toLocaleDateString("es-MX"),
      c.lastActivity
        ? new Date(c.lastActivity).toLocaleDateString("es-MX")
        : "—",
    ]);
    const bg = zebra ? XLS.paper : XLS.white;
    for (let col = 1; col <= SPAN; col++) {
      const cell = row.getCell(col);
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
