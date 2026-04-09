import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getProductAnalytics, getProductChangelog, getProductAffectedReports } from "@/actions/product-analytics";
import { ProductDetailClient } from "./product-detail-client";

interface Props {
  params: { productId: string };
}

export default async function ProductDetailPage({ params }: Props) {
  const supabase = createServerSupabaseClient();

  const { data: product, error } = await supabase
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
      product_types (id, name),
      partners (id, name),
      product_distributions (
        id,
        user_id,
        percentage_share,
        users (id, name, email, user_type)
      )
    `
    )
    .eq("id", params.productId)
    .single();

  if (error || !product) {
    redirect("/products");
  }

  // Get available users from this partner for the distribution editor
  const { data: partnerUsers } = await supabase
    .from("user_partner_roles")
    .select(
      `
      users (id, name, email, user_type, is_active)
    `
    )
    .eq("partner_id", product.partner_id);

  const availableUsers = (partnerUsers ?? [])
    .map((row: any) => row.users)
    .filter((u: any) => u && u.is_active);

  // Get product types for the settings tab
  const { data: productTypes } = await supabase
    .from("product_types")
    .select("id, name")
    .order("name");

  // Get analytics data
  const analyticsResult = await getProductAnalytics(params.productId);
  const analytics = analyticsResult.success ? analyticsResult.data : null;

  // Get changelog
  const changelogResult = await getProductChangelog(params.productId);
  const changelog = changelogResult.success ? changelogResult.data : [];

  // Get affected reports for distribution warning
  const affectedResult = await getProductAffectedReports(params.productId);
  const affectedReports = affectedResult.success
    ? affectedResult.data
    : { lockedReports: [], unlockedReports: [] };

  return (
    <ProductDetailClient
      product={product as any}
      availableUsers={availableUsers}
      productTypes={productTypes ?? []}
      analytics={analytics}
      changelog={changelog}
      affectedReports={affectedReports}
    />
  );
}
