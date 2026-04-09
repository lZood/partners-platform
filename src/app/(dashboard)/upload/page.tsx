import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UploadClient } from "./upload-client";

export default async function UploadPage() {
  const supabase = createServerSupabaseClient();

  const [partnersRes, typesRes] = await Promise.all([
    supabase
      .from("partners")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase.from("product_types").select("id, name").order("name"),
  ]);

  return (
    <UploadClient
      partners={partnersRes.data ?? []}
      productTypes={typesRes.data ?? []}
    />
  );
}
