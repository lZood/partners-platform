"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActivePartnerContext } from "@/lib/active-partner";

export interface SearchResult {
  id: string;
  category: "collaborator" | "product" | "partner" | "report";
  title: string;
  subtitle: string;
  link: string;
  avatarUrl?: string | null;
}

export interface SearchResults {
  collaborators: SearchResult[];
  products: SearchResult[];
  partners: SearchResult[];
  reports: SearchResult[];
}

const MONTH_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export async function globalSearch(
  query: string
): Promise<SearchResults> {
  if (!query || query.trim().length < 2) {
    return { collaborators: [], products: [], partners: [], reports: [] };
  }

  const ctx = await getActivePartnerContext();
  if (!ctx) {
    return { collaborators: [], products: [], partners: [], reports: [] };
  }

  const supabase = createServerSupabaseClient();
  const q = query.trim();
  const { activePartnerId, accessiblePartnerIds, isSuperAdmin } = ctx;

  // Build product query, scoped to the active partner.
  const productsBase = supabase
    .from("products")
    .select(
      "id, name, is_active, partner_id, product_types (name)"
    )
    .ilike("name", `%${q}%`)
    .limit(5);

  const productsQuery = activePartnerId
    ? productsBase.eq("partner_id", activePartnerId)
    : accessiblePartnerIds.length > 0
      ? productsBase.in("partner_id", accessiblePartnerIds)
      : productsBase;

  // Reports scoped to active partner.
  const reportsBase = supabase
    .from("monthly_reports")
    .select("id, report_month, total_usd, partner_id, partners (name)")
    .order("report_month", { ascending: false })
    .limit(5);

  const reportsQuery = activePartnerId
    ? reportsBase.eq("partner_id", activePartnerId)
    : accessiblePartnerIds.length > 0
      ? reportsBase.in("partner_id", accessiblePartnerIds)
      : reportsBase;

  const [usersRes, productsRes, partnersRes, reportsRes] = await Promise.all([
    // Collaborators: only those with a role in the active partner. Super
    // admin can find anyone in the system.
    isSuperAdmin
      ? supabase
          .from("users")
          .select("id, name, email, avatar_url, user_type")
          .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
          .limit(5)
      : supabase
          .from("users")
          .select(
            "id, name, email, avatar_url, user_type, user_partner_roles!inner(partner_id)"
          )
          .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
          .eq("user_partner_roles.partner_id", activePartnerId ?? "")
          .limit(5),
    productsQuery,
    // Partners: only ones the user can access.
    isSuperAdmin
      ? supabase
          .from("partners")
          .select("id, name, logo_url, is_active")
          .ilike("name", `%${q}%`)
          .limit(5)
      : accessiblePartnerIds.length > 0
        ? supabase
            .from("partners")
            .select("id, name, logo_url, is_active")
            .ilike("name", `%${q}%`)
            .in("id", accessiblePartnerIds)
            .limit(5)
        : Promise.resolve({ data: [] as any[] } as any),
    reportsQuery,
  ]);

  const collaborators: SearchResult[] = (usersRes.data ?? []).map((u: any) => ({
    id: u.id,
    category: "collaborator",
    title: u.name,
    subtitle:
      u.email ??
      (u.user_type === "virtual_profile" ? "Perfil virtual" : "Sin email"),
    link: `/collaborators`,
    avatarUrl: u.avatar_url,
  }));

  const products: SearchResult[] = (productsRes.data ?? []).map((p: any) => ({
    id: p.id,
    category: "product",
    title: p.name,
    subtitle: `${p.product_types?.name ?? "Sin tipo"} · ${p.is_active ? "Activo" : "Inactivo"}`,
    link: `/products`,
  }));

  const partners: SearchResult[] = (partnersRes.data ?? []).map((p: any) => ({
    id: p.id,
    category: "partner",
    title: p.name,
    subtitle: p.is_active ? "Activo" : "Inactivo",
    link: `/settings/partners/${p.id}`,
    avatarUrl: p.logo_url,
  }));

  // Month-name fallback for reports.
  let reportResults = (reportsRes.data ?? []) as any[];
  if (reportResults.length === 0) {
    const monthIdx = MONTH_LABELS.findIndex((m) =>
      m.toLowerCase().startsWith(q.toLowerCase())
    );
    if (monthIdx >= 0) {
      const monthNum = String(monthIdx + 1).padStart(2, "0");
      let monthQuery = supabase
        .from("monthly_reports")
        .select("id, report_month, total_usd, partner_id, partners (name)")
        .like("report_month", `%-${monthNum}-%`)
        .order("report_month", { ascending: false })
        .limit(5);
      if (activePartnerId) {
        monthQuery = monthQuery.eq("partner_id", activePartnerId);
      } else if (accessiblePartnerIds.length > 0) {
        monthQuery = monthQuery.in("partner_id", accessiblePartnerIds);
      }
      const { data } = await monthQuery;
      reportResults = data ?? [];
    }
  }

  const reports: SearchResult[] = reportResults.map((r: any) => {
    const [y, m] = (r.report_month ?? "").split("-");
    const monthLabel = MONTH_LABELS[parseInt(m) - 1] ?? m;
    return {
      id: r.id,
      category: "report",
      title: `${monthLabel} ${y}`,
      subtitle: `${r.partners?.name ?? "Partner"} · $${Number(r.total_usd ?? 0).toFixed(2)} USD`,
      link: `/reports/${r.id}`,
    };
  });

  return { collaborators, products, partners, reports };
}
