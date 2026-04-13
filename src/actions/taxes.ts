"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { taxSchema } from "@/lib/validations/schemas";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

export async function getTaxes(partnerId?: string): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  let query = supabase
    .from("taxes")
    .select("*")
    .order("priority_order", { ascending: true });

  if (partnerId) {
    query = query.eq("partner_id", partnerId);
  }

  const { data, error } = await query;

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function createTax(formData: FormData): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const partnerId = formData.get("partnerId") as string;
  const taxGroup = parseInt(formData.get("taxGroup") as string) || 0;

  // Get next priority order
  const { data: existing } = await supabase
    .from("taxes")
    .select("priority_order")
    .eq("partner_id", partnerId)
    .order("priority_order", { ascending: false })
    .limit(1);

  const nextOrder =
    existing && existing.length > 0 ? existing[0].priority_order + 1 : 1;

  const raw = {
    name: formData.get("name") as string,
    partnerId,
    percentageRate: parseFloat(formData.get("percentageRate") as string),
    priorityOrder: nextOrder,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = taxSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(", "),
    };
  }

  // If taxGroup specified, use it; otherwise assign to its own group (= nextOrder for cascade)
  const finalGroup = taxGroup > 0 ? taxGroup : nextOrder;

  const { data, error } = await supabase
    .from("taxes")
    .insert({
      name: parsed.data.name,
      partner_id: parsed.data.partnerId,
      percentage_rate: parsed.data.percentageRate,
      priority_order: parsed.data.priorityOrder,
      description: parsed.data.description ?? null,
      tax_group: finalGroup,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings");
  return { success: true, data };
}

export async function updateTax(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const name = formData.get("name") as string;
  const percentageRate = parseFloat(formData.get("percentageRate") as string);
  const description = (formData.get("description") as string) || null;
  const taxGroupRaw = formData.get("taxGroup");
  const taxGroup = taxGroupRaw ? parseInt(taxGroupRaw as string) : undefined;

  if (!name) return { success: false, error: "El nombre es requerido" };
  if (isNaN(percentageRate) || percentageRate < 0 || percentageRate > 100) {
    return { success: false, error: "La tasa debe estar entre 0 y 100" };
  }

  const updateData: any = { name, percentage_rate: percentageRate, description };
  if (taxGroup !== undefined) updateData.tax_group = taxGroup;

  const { data, error } = await supabase
    .from("taxes")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings");
  return { success: true, data };
}

export async function deleteTax(id: string): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase.from("taxes").delete().eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings");
  return { success: true };
}

export async function toggleTaxActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("taxes")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings");
  return { success: true };
}

/**
 * Reorder taxes by updating their priority_order.
 * Receives an array of tax IDs in the new desired order.
 */
export async function reorderTaxes(
  partnerId: string,
  orderedIds: string[]
): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  // Update all at once — no unique constraint anymore
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("taxes")
      .update({ priority_order: i + 1 })
      .eq("id", orderedIds[i])
      .eq("partner_id", partnerId);

    if (error) return { success: false, error: error.message };
  }

  revalidatePath("/settings");
  return { success: true };
}

/**
 * Set a tax's group. Taxes in the same group are applied in parallel (on the same base amount).
 * Different groups are applied in cascade (sequentially).
 */
export async function setTaxGroup(
  id: string,
  taxGroup: number
): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("taxes")
    .update({ tax_group: taxGroup })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings");
  return { success: true };
}
