import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateCollaboratorsExcel } from "@/lib/excel/collaborators-excel";

export async function GET() {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: users } = await supabase
    .from("users")
    .select(`
      id, name, email, user_type, is_active, created_at,
      user_partner_roles (
        role,
        partners (name)
      )
    `)
    .order("name", { ascending: true });

  // Get last activity from login_logs
  const { data: lastLogins } = await supabase
    .from("login_logs")
    .select("user_id, created_at")
    .eq("status", "success")
    .order("created_at", { ascending: false });

  const lastLoginMap = new Map<string, string>();
  for (const log of (lastLogins ?? []) as any[]) {
    if (log.user_id && !lastLoginMap.has(log.user_id)) {
      lastLoginMap.set(log.user_id, log.created_at);
    }
  }

  const collaborators = (users ?? []).map((u: any) => {
    const roles = u.user_partner_roles ?? [];
    return {
      name: u.name,
      email: u.email,
      userType: u.user_type,
      isActive: u.is_active ?? false,
      partners: roles.map((r: any) => r.partners?.name).filter(Boolean).join(", "),
      roles: roles.map((r: any) => {
        const labels: Record<string, string> = {
          super_admin: "Super Admin",
          admin: "Admin",
          collaborator: "Colaborador",
        };
        return labels[r.role] ?? r.role;
      }).join(", "),
      createdAt: u.created_at,
      lastActivity: lastLoginMap.get(u.id) ?? null,
    };
  });

  const buffer = await generateCollaboratorsExcel({ collaborators });

  const date = new Date().toISOString().split("T")[0];
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="colaboradores-${date}.xlsx"`,
    },
  });
}
