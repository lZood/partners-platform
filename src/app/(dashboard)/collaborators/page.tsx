import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CollaboratorsClient } from "./collaborators-client";

export default async function CollaboratorsPage() {
  const supabase = createServerSupabaseClient();

  // Fetch collaborators with their roles and partners
  const { data: users } = await supabase
    .from("users")
    .select(
      `
      id,
      name,
      email,
      user_type,
      is_active,
      created_at,
      user_partner_roles (
        id,
        role,
        partner_id,
        partners (id, name)
      )
    `
    )
    .order("name", { ascending: true });

  // Fetch partners for the create form
  const { data: partners } = await supabase
    .from("partners")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  return (
    <CollaboratorsClient
      initialUsers={users ?? []}
      partners={partners ?? []}
    />
  );
}
