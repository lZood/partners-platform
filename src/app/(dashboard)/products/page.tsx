import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getProductsRevenueSummary } from "@/actions/product-analytics";
import { ProductsClient } from "./products-client";

export default async function ProductsPage() {
  const supabase = createServerSupabaseClient();

  // Fetch products with distributions and types
  const { data: products } = await supabase
    .from("products")
    .select(
      `
      id,
      name,
      description,
      is_active,
      created_at,
      partner_id,
      product_type_id,
      partners (id, name),
      product_types (id, name),
      product_distributions (
        id,
        user_id,
        percentage_share,
        users (id, name)
      )
    `
    )
    .order("name", { ascending: true });

  // Fetch product types and partners for the form
  const { data: productTypes } = await supabase
    .from("product_types")
    .select("id, name")
    .order("name");

  const { data: partners } = await supabase
    .from("partners")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  // Enrich products with distribution validation
  const enriched = (products ?? []).map((p: any) => {
    const total = (p.product_distributions ?? []).reduce(
      (sum: number, d: any) => sum + Number(d.percentage_share),
      0
    );
    return {
      ...p,
      totalPercentage: Math.round(total * 100) / 100,
      isDistributionValid: Math.abs(total - 100) < 0.01,
    };
  });

  // Get revenue summaries for all products
  const productIds = enriched.map((p: any) => p.id);
  const revenueResult = await getProductsRevenueSummary(productIds);

  // Convert Map to plain object for serialization
  let revenueSummaries: Record<string, any> = {};
  if (revenueResult.success) {
    Array.from(revenueResult.data.entries()).forEach(([key, value]) => {
      revenueSummaries[key] = value;
    });
  }

  return (
    <ProductsClient
      initialProducts={enriched}
      productTypes={productTypes ?? []}
      partners={partners ?? []}
      revenueSummaries={revenueSummaries}
    />
  );
}
