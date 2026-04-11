"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { partnerSchema } from "@/lib/validations/schemas";

export type PartnerActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

export async function getPartners(): Promise<PartnerActionResult> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("partners")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function getPartnerById(
  id: string
): Promise<PartnerActionResult> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("partners")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function createPartner(
  formData: FormData
): Promise<PartnerActionResult> {
  const supabase = createServerSupabaseClient();

  // Validate auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "No autenticado" };
  }

  // Parse and validate input
  const raw = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = partnerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(", "),
    };
  }

  const { data, error } = await supabase
    .from("partners")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: `Ya existe un partner con el nombre "${parsed.data.name}"` };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/settings/partners");
  return { success: true, data };
}

export async function updatePartner(
  id: string,
  formData: FormData
): Promise<PartnerActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "No autenticado" };
  }

  const raw = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = partnerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(", "),
    };
  }

  const { data, error } = await supabase
    .from("partners")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: `Ya existe un partner con el nombre "${parsed.data.name}"` };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/settings/partners");
  return { success: true, data };
}

export async function togglePartnerActive(
  id: string,
  isActive: boolean
): Promise<PartnerActionResult> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("partners")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings/partners");
  return { success: true };
}

/**
 * Update a partner's logo URL.
 */
export async function updatePartnerLogo(
  partnerId: string,
  logoUrl: string
): Promise<PartnerActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("partners")
    .update({ logo_url: logoUrl })
    .eq("id", partnerId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings/partners");
  revalidatePath(`/settings/partners/${partnerId}`);
  return { success: true };
}

/**
 * Get partners with aggregated metrics (member count, product count, etc.)
 */
export async function getPartnersWithMetrics(): Promise<PartnerActionResult> {
  const supabase = createServerSupabaseClient();

  const { data: partners, error } = await supabase
    .from("partners")
    .select("*")
    .order("name", { ascending: true });

  if (error) return { success: false, error: error.message };

  // Fetch counts in parallel
  const enriched = await Promise.all(
    (partners ?? []).map(async (partner) => {
      const [members, products, taxes, reports] = await Promise.all([
        supabase
          .from("user_partner_roles")
          .select("id", { count: "exact", head: true })
          .eq("partner_id", partner.id),
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("partner_id", partner.id)
          .eq("is_active", true),
        supabase
          .from("taxes")
          .select("id", { count: "exact", head: true })
          .eq("partner_id", partner.id)
          .eq("is_active", true),
        supabase
          .from("monthly_reports")
          .select("id", { count: "exact", head: true })
          .eq("partner_id", partner.id),
      ]);

      return {
        ...partner,
        memberCount: members.count ?? 0,
        productCount: products.count ?? 0,
        taxCount: taxes.count ?? 0,
        reportCount: reports.count ?? 0,
      };
    })
  );

  return { success: true, data: enriched };
}

/**
 * Get full partner details including members, products, taxes, and recent reports.
 */
export async function getPartnerDetails(
  id: string
): Promise<PartnerActionResult> {
  const supabase = createServerSupabaseClient();

  // Partner base info
  const { data: partner, error } = await supabase
    .from("partners")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !partner) {
    return { success: false, error: error?.message ?? "Partner no encontrado" };
  }

  // Fetch all related data in parallel
  const [membersRes, productsRes, taxesRes, reportsRes] = await Promise.all([
    supabase
      .from("user_partner_roles")
      .select(`
        id,
        role,
        users (
          id, name, email, user_type, is_active, created_at, avatar_url
        )
      `)
      .eq("partner_id", id)
      .order("role", { ascending: true }),
    supabase
      .from("products")
      .select(`
        id, name, description, is_active, created_at,
        product_types (name),
        product_distributions (
          id,
          percentage_share,
          users (name)
        )
      `)
      .eq("partner_id", id)
      .order("name", { ascending: true }),
    supabase
      .from("taxes")
      .select("*")
      .eq("partner_id", id)
      .order("priority_order", { ascending: true }),
    supabase
      .from("monthly_reports")
      .select("id, report_month, total_usd, total_mxn, is_locked, created_at")
      .eq("partner_id", id)
      .order("report_month", { ascending: false })
      .limit(10),
  ]);

  // Calculate totals from reports
  const allReports = reportsRes.data ?? [];
  const totalUsd = allReports.reduce(
    (sum, r) => sum + Number(r.total_usd ?? 0),
    0
  );
  const totalMxn = allReports.reduce(
    (sum, r) => sum + Number(r.total_mxn ?? 0),
    0
  );

  return {
    success: true,
    data: {
      partner,
      members: membersRes.data ?? [],
      products: productsRes.data ?? [],
      taxes: taxesRes.data ?? [],
      recentReports: allReports,
      totals: { totalUsd, totalMxn },
    },
  };
}

/**
 * Add an existing user to a partner with a role.
 */
export async function addMemberToPartner(
  userId: string,
  partnerId: string,
  role: string
): Promise<PartnerActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  // Check if already assigned
  const { data: existing } = await supabase
    .from("user_partner_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("partner_id", partnerId)
    .single();

  if (existing) {
    return { success: false, error: "Este usuario ya es miembro de este partner" };
  }

  const { error } = await supabase
    .from("user_partner_roles")
    .insert({ user_id: userId, partner_id: partnerId, role });

  if (error) return { success: false, error: error.message };

  revalidatePath(`/settings/partners/${partnerId}`);
  return { success: true };
}

/**
 * Update a member's role within a partner.
 */
export async function updateMemberRole(
  roleId: string,
  partnerId: string,
  newRole: string
): Promise<PartnerActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("user_partner_roles")
    .update({ role: newRole })
    .eq("id", roleId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/settings/partners/${partnerId}`);
  return { success: true };
}

/**
 * Remove a member from a partner.
 */
export async function removeMemberFromPartner(
  roleId: string,
  partnerId: string
): Promise<PartnerActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("user_partner_roles")
    .delete()
    .eq("id", roleId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/settings/partners/${partnerId}`);
  return { success: true };
}
