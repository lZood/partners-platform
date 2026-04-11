"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { productSchema } from "@/lib/validations/schemas";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

export async function getProducts(partnerId?: string): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  let query = supabase
    .from("products")
    .select(
      `
      id,
      name,
      description,
      is_active,
      created_at,
      updated_at,
      partner_id,
      partners (id, name),
      product_type_id,
      product_types (id, name),
      product_distributions (
        id,
        user_id,
        percentage_share,
        users (id, name, email)
      )
    `
    )
    .order("name", { ascending: true });

  if (partnerId) {
    query = query.eq("partner_id", partnerId);
  }

  const { data, error } = await query;

  if (error) {
    return { success: false, error: error.message };
  }

  // Enrich with distribution validation
  const enriched = (data ?? []).map((product: any) => {
    const totalPercentage = (product.product_distributions ?? []).reduce(
      (sum: number, d: any) => sum + Number(d.percentage_share),
      0
    );
    return {
      ...product,
      totalPercentage: Math.round(totalPercentage * 100) / 100,
      isDistributionValid: Math.abs(totalPercentage - 100) < 0.01,
    };
  });

  return { success: true, data: enriched };
}

export async function getProductById(id: string): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id,
      name,
      description,
      is_active,
      partner_id,
      product_type_id,
      product_types (id, name),
      partners (id, name),
      product_distributions (
        id,
        user_id,
        percentage_share,
        users (id, name, email)
      )
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function getProductTypes(): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("product_types")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function createProduct(
  formData: FormData
): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const raw = {
    name: formData.get("name") as string,
    partnerId: formData.get("partnerId") as string,
    productTypeId: formData.get("productTypeId") as string,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(", "),
    };
  }

  const { data, error } = await supabase
    .from("products")
    .insert({
      name: parsed.data.name,
      partner_id: parsed.data.partnerId,
      product_type_id: parsed.data.productTypeId,
      description: parsed.data.description ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: `Ya existe un producto "${parsed.data.name}" para este partner`,
      };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/products");
  return { success: true, data };
}

export async function updateProduct(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const name = formData.get("name") as string;
  const productTypeId = formData.get("productTypeId") as string;
  const description = (formData.get("description") as string) || null;

  if (!name) return { success: false, error: "El nombre es requerido" };

  const { data, error } = await supabase
    .from("products")
    .update({ name, product_type_id: productTypeId, description })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: `Ya existe un producto "${name}" para este partner` };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { success: true, data };
}

export async function toggleProductActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/products");
  return { success: true };
}

export async function updateProductImage(
  productId: string,
  imageUrl: string
): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("products")
    .update({ image_url: imageUrl })
    .eq("id", productId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

export async function updateProductLifecycle(
  productId: string,
  status: "draft" | "active" | "discontinued"
): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("products")
    .update({ lifecycle_status: status })
    .eq("id", productId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

export async function updateProductCategory(
  productId: string,
  categoryId: string | null
): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("products")
    .update({ category_id: categoryId })
    .eq("id", productId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

// ── CSV product matching ────────────────────────────────────────────

export interface ProductMatchResult {
  productName: string;
  productType: string;
  status: "matched" | "unmatched";
  dbProductId?: string;
  dbProductName?: string;
}

/**
 * Check which CSV product names already exist in the DB for a given partner.
 * Returns a match result for each product.
 */
export async function matchCsvProducts(
  partnerId: string,
  csvProducts: { productName: string; productType: string }[]
): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  // Get all active products for this partner
  const { data: dbProducts, error } = await supabase
    .from("products")
    .select("id, name")
    .eq("partner_id", partnerId)
    .eq("is_active", true);

  if (error) return { success: false, error: error.message };

  // Build lookup map (case-insensitive)
  const dbMap = new Map(
    (dbProducts ?? []).map((p: any) => [p.name.toLowerCase().trim(), p])
  );

  const results: ProductMatchResult[] = csvProducts.map((csv) => {
    const match = dbMap.get(csv.productName.toLowerCase().trim());
    if (match) {
      return {
        productName: csv.productName,
        productType: csv.productType,
        status: "matched" as const,
        dbProductId: match.id,
        dbProductName: match.name,
      };
    }
    return {
      productName: csv.productName,
      productType: csv.productType,
      status: "unmatched" as const,
    };
  });

  return { success: true, data: results };
}

/**
 * Auto-register multiple products from CSV data.
 * Assigns the correct product_type based on the CSV productType field,
 * or defaults to the first available type.
 */
export async function autoRegisterProducts(
  partnerId: string,
  products: { productName: string; productType: string }[]
): Promise<ActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  // Get available product types
  const { data: productTypes } = await supabase
    .from("product_types")
    .select("id, name")
    .order("name");

  if (!productTypes || productTypes.length === 0) {
    return {
      success: false,
      error: "No hay tipos de producto configurados. Crea al menos uno primero.",
    };
  }

  // Build type lookup (case-insensitive)
  const typeMap = new Map(
    productTypes.map((pt: any) => [pt.name.toLowerCase().trim(), pt.id])
  );
  const defaultTypeId = productTypes[0].id;

  const toInsert = products.map((p) => {
    const typeId =
      typeMap.get(p.productType.toLowerCase().trim()) || defaultTypeId;
    return {
      name: p.productName,
      partner_id: partnerId,
      product_type_id: typeId,
      is_active: true,
    };
  });

  const { data, error } = await supabase
    .from("products")
    .insert(toInsert)
    .select("id, name");

  if (error) {
    return { success: false, error: `Error registrando productos: ${error.message}` };
  }

  revalidatePath("/products");

  return {
    success: true,
    data: {
      created: data?.length ?? 0,
      products: data,
    },
  };
}
