import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCollaboratorDetail } from "@/actions/users";
import { CollaboratorDetailClient } from "./collaborator-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CollaboratorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Check if super_admin
  const { data: currentUser } = await supabase
    .from("users")
    .select("id, user_partner_roles (role)")
    .eq("auth_user_id", user.id)
    .single();

  const isSuperAdmin = ((currentUser?.user_partner_roles as any[]) ?? []).some(
    (r: any) => r.role === "super_admin"
  );

  const result = await getCollaboratorDetail(id);
  if (!result.success) redirect("/collaborators");

  // Get partners for add partner dialog
  const { data: partners } = await supabase
    .from("partners")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  return (
    <CollaboratorDetailClient
      data={result.data}
      partners={partners ?? []}
      isSuperAdmin={isSuperAdmin}
    />
  );
}
