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
  const { data: existingTypes } = await supabase
    .from("product_types")
    .select("id, name")
    .order("name");

  // Build type lookup (case-insensitive)
  const typeMap = new Map<string, string>(
    (existingTypes ?? []).map((pt: any) => [pt.name.toLowerCase().trim(), pt.id])
  );

  // Determine which types the CSV needs that don't exist yet, so we can create
  // them on the fly instead of forcing the user to configure types manually.
  const DEFAULT_TYPE_NAME = "General";
  const missingNames = new Set<string>();
  let needsDefault = false;
  for (const p of products) {
    const t = p.productType?.trim();
    if (t) {
      if (!typeMap.has(t.toLowerCase())) missingNames.add(t);
    } else {
      needsDefault = true;
    }
  }
  // Guarantee a fallback type exists for products without a type in the CSV
  // (and for the edge case where no types exist at all).
  if (
    (needsDefault || typeMap.size === 0) &&
    !typeMap.has(DEFAULT_TYPE_NAME.toLowerCase())
  ) {
    missingNames.add(DEFAULT_TYPE_NAME);
  }

  // Create any missing types (idempotent against the UNIQUE(name) constraint).
  if (missingNames.size > 0) {
    const { error: typeErr } = await supabase
      .from("product_types")
      .upsert(
        Array.from(missingNames, (name) => ({ name })),
        { onConflict: "name", ignoreDuplicates: true }
      );

    if (typeErr) {
      return {
        success: false,
        error: `Error creando tipos de producto: ${typeErr.message}`,
      };
    }

    // Re-fetch so we have ids for the freshly created (and pre-existing) types.
    const { data: allTypes, error: refetchErr } = await supabase
      .from("product_types")
      .select("id, name");
    if (refetchErr) {
      return { success: false, error: refetchErr.message };
    }
    typeMap.clear();
    for (const pt of (allTypes ?? []) as any[]) {
      typeMap.set(pt.name.toLowerCase().trim(), pt.id);
    }
  }

  const defaultTypeId =
    typeMap.get(DEFAULT_TYPE_NAME.toLowerCase()) ??
    typeMap.values().next().value;

  if (!defaultTypeId) {
    return {
      success: false,
      error: "No se pudo determinar un tipo de producto.",
    };
  }

  const toInsert = products.map((p) => {
    const t = p.productType?.trim().toLowerCase();
    const typeId = (t && typeMap.get(t)) || defaultTypeId;
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
  revalidatePath("/upload");

  return {
    success: true,
    data: {
      created: data?.length ?? 0,
      products: data,
    },
  };
}
