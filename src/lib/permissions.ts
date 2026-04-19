export const ALL_PERMISSIONS = [
  { key: "view_reports", label: "Ver reportes", description: "Acceder a la seccion de reportes" },
  { key: "create_reports", label: "Crear reportes", description: "Subir CSV y generar reportes" },
  { key: "manage_products", label: "Gestionar productos", description: "Crear, editar y eliminar productos" },
  { key: "manage_collaborators", label: "Gestionar colaboradores", description: "Crear, editar y eliminar colaboradores" },
  { key: "manage_payments", label: "Gestionar pagos", description: "Registrar pagos y conceptos extras" },
  { key: "view_payments", label: "Ver pagos", description: "Ver pagos pendientes y realizados" },
  { key: "manage_taxes", label: "Gestionar impuestos", description: "Configurar impuestos del partner" },
  { key: "manage_partners", label: "Gestionar partners", description: "CRUD de partners (solo super_admin)" },
  { key: "view_audit_log", label: "Ver audit log", description: "Acceder al registro de auditoria" },
] as const;

export type PermissionKey = typeof ALL_PERMISSIONS[number]["key"];

const DEFAULT_PERMISSIONS: Record<string, PermissionKey[]> = {
  super_admin: ALL_PERMISSIONS.map((p) => p.key),
  admin: [
    "view_reports",
    "create_reports",
    "manage_products",
    "manage_collaborators",
    "manage_payments",
    "view_payments",
    "manage_taxes",
    "view_audit_log",
  ],
  collaborator: ["view_reports", "view_payments"],
};

export function getDefaultPermissions(role: string): PermissionKey[] {
  return DEFAULT_PERMISSIONS[role] ?? DEFAULT_PERMISSIONS.collaborator;
}
