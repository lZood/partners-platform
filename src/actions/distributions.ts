"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

interface DistributionEntry {
  userId: string;
  percentageShare: number;
}

/**
 * Save the full distribution for a product.
 * Replaces all existing distributions with the new set.
 * Validates that percentages sum to exactly 100%.
 */
export async function saveDistributions(
  productId: string,
  distributions: DistributionEntry[]
): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  // Validate sum = 100
  const total = distributions.reduce((sum, d) => sum + d.percentageShare, 0);
  const rounded = Math.round(total * 100) / 100;

  if (Math.abs(rounded - 100) > 0.01) {
    return {
      success: false,
      error: `Los porcentajes suman ${rounded}%. Deben sumar exactamente 100%.`,
    };
  }

  // Validate no zeros or negatives
  for (const d of distributions) {
    if (d.percentageShare <= 0) {
      return {
        success: false,
        error: "Todos los porcentajes deben ser mayores a 0%",
      };
    }
    if (d.percentageShare > 100) {
      return {
        success: false,
        error: "Ningun porcentaje puede exceder 100%",
      };
    }
  }

  // Check for duplicate users
  const userIds = distributions.map((d) => d.userId);
  if (new Set(userIds).size !== userIds.length) {
    return {
      success: false,
      error: "No puedes asignar el mismo usuario mas de una vez",
    };
  }

  // Delete existing distributions for this product
  const { error: deleteError } = await supabase
    .from("product_distributions")
    .delete()
    .eq("product_id", productId);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  // Insert new distributions
  if (distributions.length > 0) {
    const rows = distributions.map((d) => ({
      product_id: productId,
      user_id: d.userId,
      percentage_share: d.percentageShare,
    }));

    const { error: insertError } = await supabase
      .from("product_distributions")
      .insert(rows);

    if (insertError) {
      return { success: false, error: insertError.message };
    }
  }

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

/**
 * Get all users available for distribution assignment within a partner.
 */
export async function getAvailableUsers(
  partnerId: string
): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("user_partner_roles")
    .select(
      `
      users (id, name, email, user_type, is_active)
    `
    )
    .eq("partner_id", partnerId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Flatten and filter active users
  const users = (data ?? [])
    .map((row: any) => row.users)
    .filter((u: any) => u && u.is_active);

  return { success: true, data: users };
}
