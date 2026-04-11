import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateProductsExcel } from "@/lib/excel/products-excel";

export async function GET() {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: products } = await supabase
    .from("products")
    .select(`
      id, name, is_active, lifecycle_status, created_at,
      partners (name),
      product_types (name),
      product_categories (name),
      product_distributions (
        percentage_share,
        users (name)
      )
    `)
    .order("name", { ascending: true });

  const items = (products ?? []).map((p: any) => ({
    name: p.name,
    productType: p.product_types?.name ?? "—",
    category: p.product_categories?.name ?? null,
    partner: p.partners?.name ?? "—",
    isActive: p.is_active ?? false,
    lifecycleStatus: p.lifecycle_status,
    collaborators: (p.product_distributions ?? [])
      .map((d: any) => `${d.users?.name ?? "?"} (${d.percentage_share}%)`)
      .join(", "),
    createdAt: p.created_at,
  }));

  const buffer = await generateProductsExcel({ products: items });

  const date = new Date().toISOString().split("T")[0];
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="productos-${date}.xlsx"`,
    },
  });
}
