import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAnalyticsData } from "@/actions/analytics";
import { AnalyticsClient } from "./analytics-client";

interface PageProps {
  searchParams: Promise<{ year?: string; partner?: string }>;
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const supabase = createServerSupabaseClient();
  const params = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const year = parseInt(params.year ?? new Date().getFullYear().toString());
  const partnerId = params.partner;

  const { data: partners } = await supabase
    .from("partners")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const result = await getAnalyticsData(year, partnerId);

  return (
    <AnalyticsClient
      data={result.success ? result.data : null}
      year={year}
      partnerId={partnerId}
      partners={partners ?? []}
    />
  );
}
