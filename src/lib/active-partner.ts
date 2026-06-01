import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ACTIVE_PARTNER_COOKIE } from "@/lib/partner-constants";

export type AccessiblePartner = {
  id: string;
  name: string;
  logoUrl?: string | null;
};

export type ActivePartnerContext = {
  appUserId: string | null;
  authUserId: string;
  /** Partner the user is currently acting as. May be null if the user has no
   *  accessible partners at all. */
  activePartnerId: string | null;
  activePartnerName: string | null;
  activePartnerLogoUrl: string | null;
  /** All partner IDs the user can switch to. */
  accessiblePartnerIds: string[];
  /** All partners (id+name+logoUrl) the user can switch to. */
  accessiblePartners: AccessiblePartner[];
  /** Effective role on the active partner. */
  role: "super_admin" | "admin" | "collaborator";
  isSuperAdmin: boolean;
};

/**
 * Resolves the current user's active-partner context from the auth session and
 * the `active_partner_id` cookie. Use this in server components / actions that
 * need to scope queries by partner.
 *
 * Returns `null` when there is no authenticated user.
 */
export async function getActivePartnerContext(): Promise<ActivePartnerContext | null> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: appUser } = await supabase
    .from("users")
    .select(
      `
      id,
      user_partner_roles (
        role,
        partner_id,
        partners ( id, name, logo_url )
      )
    `
    )
    .eq("auth_user_id", user.id)
    .single();

  type Row = {
    role: string;
    partner_id: string;
    partners: { id: string; name: string; logo_url: string | null } | null;
  };
  const roles = (((appUser as any)?.user_partner_roles ?? []) as Row[]).filter(
    (r) => !!r.partners
  );
  const isSuperAdmin = roles.some((r) => r.role === "super_admin");

  let accessiblePartners: AccessiblePartner[];
  if (isSuperAdmin) {
    const { data: all } = await supabase
      .from("partners")
      .select("id, name, logo_url")
      .order("name", { ascending: true });
    accessiblePartners = (((all as any) ?? []) as Array<{
      id: string;
      name: string;
      logo_url: string | null;
    }>).map((p) => ({ id: p.id, name: p.name, logoUrl: p.logo_url }));
  } else {
    accessiblePartners = roles.map((r) => ({
      id: r.partners!.id,
      name: r.partners!.name,
      logoUrl: r.partners!.logo_url,
    }));
  }

  const accessibleIds = accessiblePartners.map((p) => p.id);
  const cookiePartnerId = cookies().get(ACTIVE_PARTNER_COOKIE)?.value ?? null;

  const activePartnerId =
    cookiePartnerId && accessibleIds.includes(cookiePartnerId)
      ? cookiePartnerId
      : accessibleIds[0] ?? null;

  const activePartner =
    accessiblePartners.find((p) => p.id === activePartnerId) ?? null;

  const explicitRole = roles.find(
    (r) => r.partner_id === activePartnerId
  )?.role;
  const role: ActivePartnerContext["role"] = isSuperAdmin
    ? "super_admin"
    : (explicitRole as ActivePartnerContext["role"]) ?? "collaborator";

  return {
    appUserId: (appUser as any)?.id ?? null,
    authUserId: user.id,
    activePartnerId,
    activePartnerName: activePartner?.name ?? null,
    activePartnerLogoUrl: activePartner?.logoUrl ?? null,
    accessiblePartnerIds: accessibleIds,
    accessiblePartners,
    role,
    isSuperAdmin,
  };
}
