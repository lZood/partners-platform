import { redirect } from "next/navigation";
import { getPartnerDetails } from "@/actions/partners";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PartnerDetailClient } from "./partner-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PartnerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getPartnerDetails(id);

  if (!result.success) {
    redirect("/settings/partners");
  }

  // Get all users for "add member" dropdown
  const supabase = createServerSupabaseClient();
  const { data: allUsers } = await supabase
    .from("users")
    .select("id, name, email, user_type, is_active")
    .order("name", { ascending: true });

  return (
    <PartnerDetailClient
      data={result.data}
      allUsers={allUsers ?? []}
    />
  );
}
