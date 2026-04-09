import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PartnersClient } from "./partners-client";

export default async function PartnersPage() {
  const supabase = createServerSupabaseClient();

  const { data: partners } = await supabase
    .from("partners")
    .select("*")
    .order("name", { ascending: true });

  return <PartnersClient initialPartners={partners ?? []} />;
}
