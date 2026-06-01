import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getProductsRevenueSummary } from "@/actions/product-analytics";
import { getActivePartnerContext } from "@/lib/active-partner";
import { ProductsClient } from "./products-client";

export default async function ProductsPage() {
  const ctx = await getActivePartnerContext();
  if (!ctx) redirect("/login");

  const supabase = createServerSupabaseClient();

  // Fetch products scoped to:
  //   - collaborators: products where they have a distribution (filtered later)
  //   - admin / super_admin: products of the currently active partner
  let productsQuery = supabase
    .from("products")
    .select(
      `
      id,
      name,
      description,
      image_url,
      lifecycle_status,
      is_active,
      created_at,
      partner_id,
      product_type_id,
      category_id,
      partners (id, name),
      product_types (id, name),
      product_categories (id, name),
      product_distributions (
        id,
        user_id,
        percentage_share,
        users (id, name)
      )
    `
    )
    .order("name", { ascending: true });

  if (ctx.role !== "collaborator" && ctx.activePartnerId) {
    productsQuery = productsQuery.eq("partner_id", ctx.activePartnerId);
  } else if (
    ctx.role !== "collaborator" &&
    ctx.accessiblePartnerIds.length > 0
  ) {
    productsQuery = productsQuery.in("partner_id", ctx.accessiblePartnerIds);
  }

  const { data: products } = await productsQuery;

  const { data: productTypes } = await supabase
    .from("product_types")
    .select("id, name")
    .order("name");

  const partners = ctx.accessiblePartners;

  // Enrich products with distribution validation
  let enriched = (products ?? []).map((p: any) => {
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

  // Collaborators: only products where they hold a distribution
  if (ctx.role === "collaborator") {
    enriched = enriched.filter((p: any) =>
      (p.product_distributions ?? []).some(
        (d: any) => d.user_id === ctx.appUserId
      )
    );
  }

  const productIds = enriched.map((p: any) => p.id);
  const revenueResult = await getProductsRevenueSummary(productIds);

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
      partners={partners}
      revenueSummaries={revenueSummaries}
      userRole={ctx.role}
      userId={ctx.appUserId ?? ""}
    />
  );
}
