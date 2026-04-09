import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TaxesClient } from "./taxes-client";

export default async function TaxesPage() {
  const supabase = createServerSupabaseClient();

  const { data: taxes } = await supabase
    .from("taxes")
    .select("*")
    .order("priority_order", { ascending: true });

  const { data: partners } = await supabase
    .from("partners")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  return <TaxesClient initialTaxes={taxes ?? []} partners={partners ?? []} />;
}
