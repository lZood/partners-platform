import ExcelJS from "exceljs";

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

const headerStyle: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: "FFFFFFFF" }, size: 11 },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } },
  alignment: { horizontal: "center", vertical: "middle" },
  border: {
    bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
  },
};

export async function generateCollaboratorsExcel(
  data: CollaboratorExcelData
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BoxFi Partners";

  const ws = wb.addWorksheet("Colaboradores");

  ws.columns = [
    { header: "Nombre", key: "name", width: 28 },
    { header: "Email", key: "email", width: 30 },
    { header: "Tipo", key: "userType", width: 16 },
    { header: "Estado", key: "status", width: 12 },
    { header: "Partners", key: "partners", width: 30 },
    { header: "Roles", key: "roles", width: 20 },
    { header: "Fecha de registro", key: "createdAt", width: 18 },
    { header: "Ultima actividad", key: "lastActivity", width: 18 },
  ];

  // Style header row
  ws.getRow(1).eachCell((cell) => {
    Object.assign(cell, { style: headerStyle });
  });
  ws.getRow(1).height = 28;

  // Add data
  for (const c of data.collaborators) {
    ws.addRow({
      name: c.name,
      email: c.email ?? "—",
      userType: c.userType === "system_user" ? "Sistema" : "Virtual",
      status: c.isActive ? "Activo" : "Inactivo",
      partners: c.partners || "Sin asignar",
      roles: c.roles || "—",
      createdAt: new Date(c.createdAt).toLocaleDateString("es-MX"),
      lastActivity: c.lastActivity
        ? new Date(c.lastActivity).toLocaleDateString("es-MX")
        : "—",
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

  // Auto-filter
  ws.autoFilter = { from: "A1", to: "H1" };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
