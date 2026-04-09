"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";

interface RoleInfo {
  role: UserRole | null;
  partnerId: string | null;
  partnerName: string | null;
  loading: boolean;
}

export function useRole(): RoleInfo {
  const [roleInfo, setRoleInfo] = useState<RoleInfo>({
    role: null,
    partnerId: null,
    partnerName: null,
    loading: true,
  });
  const supabase = createClient();

  useEffect(() => {
    const fetchRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setRoleInfo({ role: null, partnerId: null, partnerName: null, loading: false });
        return;
      }

      const { data } = await supabase
        .from("users")
        .select(
          `
          user_partner_roles (
            role,
            partner_id,
            partners (name)
          )
        `
        )
        .eq("auth_user_id", user.id)
        .single();

      const upr = (data?.user_partner_roles as any)?.[0];

      setRoleInfo({
        role: upr?.role ?? null,
        partnerId: upr?.partner_id ?? null,
        partnerName: upr?.partners?.name ?? null,
        loading: false,
      });
    };

    fetchRole();
  }, []);

  return roleInfo;
}
