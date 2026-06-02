import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { HelpClient } from "./help-client";

export default async function HelpPage() {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: appUser } = await supabase
    .from("users")
    .select("name, email, user_partner_roles (role)")
    .eq("auth_user_id", user.id)
    .single();

  const userRole =
    (appUser?.user_partner_roles as any)?.[0]?.role ?? "collaborator";
  const userName =
    (appUser as any)?.name ?? (appUser as any)?.email ?? "Usuario";

  return (
    <HelpClient userRole={userRole} userId={user.id} userName={userName} />
  );
}
