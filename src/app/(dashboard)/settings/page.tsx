import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SettingsClient } from "./settings-client";
import { SecuritySection } from "./security-section";
import { getLoginLogs, getActiveSessions } from "@/actions/security";

export default async function SettingsPage() {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: appUser } = await supabase
    .from("users")
    .select(
      `
      id,
      name,
      email,
      avatar_url,
      totp_enabled,
      user_partner_roles (
        role,
        partner_id,
        partners (id, name, description)
      )
    `
    )
    .eq("auth_user_id", user.id)
    .single();

  const partnerRole = (appUser?.user_partner_roles as any)?.[0];
  const userRole = partnerRole?.role ?? "collaborator";
  const partner = partnerRole?.partners ?? null;
  const appUserId = appUser?.id ?? "";

  // Fetch security data
  const [loginLogs, sessions] = await Promise.all([
    getLoginLogs(appUserId),
    getActiveSessions(appUserId),
  ]);

  // Get current session token for identifying "this session"
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const currentSessionToken = session?.access_token?.substring(0, 32) ?? "";

  return (
    <div className="space-y-8">
      <SettingsClient
        user={{
          id: appUserId,
          name: appUser?.name ?? "",
          email: appUser?.email ?? user.email ?? "",
          avatarUrl: (appUser as any)?.avatar_url ?? null,
        }}
        userRole={userRole}
        partner={partner}
      />

      <SecuritySection
        totpEnabled={(appUser as any)?.totp_enabled ?? false}
        loginLogs={loginLogs}
        sessions={sessions}
        currentSessionToken={currentSessionToken}
        userId={appUserId}
      />
    </div>
  );
}
