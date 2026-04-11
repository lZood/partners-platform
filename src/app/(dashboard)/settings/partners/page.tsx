import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPartnersWithMetrics } from "@/actions/partners";
import { PartnersClient } from "./partners-client";

export default async function PartnersPage() {
  const result = await getPartnersWithMetrics();

  return <PartnersClient initialPartners={result.data ?? []} />;
}
