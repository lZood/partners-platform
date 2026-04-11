"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  const supabase = createServerSupabaseClient();
  const q = query.trim();

  // Search all in parallel
  const [usersRes, productsRes, partnersRes, reportsRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, email, avatar_url, user_type")
      .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(5),
    supabase
      .from("products")
      .select("id, name, is_active, product_types (name)")
      .ilike("name", `%${q}%`)
      .limit(5),
    supabase
      .from("partners")
      .select("id, name, logo_url, is_active")
      .ilike("name", `%${q}%`)
      .limit(5),
    supabase
      .from("monthly_reports")
      .select("id, report_month, total_usd, partners (name)")
      .or(`partners.name.ilike.%${q}%`)
      .order("report_month", { ascending: false })
      .limit(5),
  ]);

  const collaborators: SearchResult[] = (usersRes.data ?? []).map((u: any) => ({
    id: u.id,
    category: "collaborator",
    title: u.name,
    subtitle: u.email ?? (u.user_type === "virtual_profile" ? "Perfil virtual" : "Sin email"),
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

  // For reports, also try matching month names
  let reportResults = (reportsRes.data ?? []) as any[];
  if (reportResults.length === 0) {
    // Try matching month name in Spanish
    const monthIdx = MONTH_LABELS.findIndex((m) =>
      m.toLowerCase().startsWith(q.toLowerCase())
    );
    if (monthIdx >= 0) {
      const monthNum = String(monthIdx + 1).padStart(2, "0");
      const { data } = await supabase
        .from("monthly_reports")
        .select("id, report_month, total_usd, partners (name)")
        .like("report_month", `%-${monthNum}-%`)
        .order("report_month", { ascending: false })
        .limit(5);
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
