"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Result = { success: boolean; error?: string; data?: any };

export async function getCategories(
  productTypeId?: string
): Promise<Result> {
  const supabase = createServerSupabaseClient();

  let query = supabase
    .from("product_categories")
    .select("*, product_types (name)")
    .order("name");

  if (productTypeId) {
    query = query.eq("product_type_id", productTypeId);
  }

  const { data, error } = await query;

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function createCategory(
  productTypeId: string,
  name: string,
  description?: string
): Promise<Result> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("product_categories")
    .insert({
      product_type_id: productTypeId,
      name,
      description: description ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: `La categoria "${name}" ya existe para este tipo` };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/products");
  return { success: true, data };
}

export async function deleteCategory(id: string): Promise<Result> {
  const supabase = createServerSupabaseClient();

  // Check if any products use this category
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if ((count ?? 0) > 0) {
    return {
      success: false,
      error: `Esta categoria tiene ${count} producto(s) asignado(s). Reasignalos primero.`,
    };
  }

  const { error } = await supabase
    .from("product_categories")
    .delete()
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/products");
  return { success: true };
}
