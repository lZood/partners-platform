import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActivePartnerContext } from "@/lib/active-partner";
import { UploadClient } from "./upload-client";

export default async function UploadPage() {
  const ctx = await getActivePartnerContext();
  if (!ctx) redirect("/login");
  if (ctx.role === "collaborator") redirect("/");

  const supabase = createServerSupabaseClient();
  const { data: typesRes } = await supabase
    .from("product_types")
    .select("id, name")
    .order("name");

  return (
    <UploadClient
      partners={ctx.accessiblePartners}
      productTypes={typesRes ?? []}
      defaultPartnerId={ctx.activePartnerId ?? undefined}
    />
  );
}
