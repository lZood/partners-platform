"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CaretUpDown, Check } from "@phosphor-icons/react";
import { setActivePartner } from "@/actions/partners";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/layout/sidebar-shell";

export interface Partner {
  id: string;
  name: string;
  logoUrl?: string | null;
}

interface PartnerSelectorProps {
  partners: Partner[];
  currentPartnerId: string;
  /** When false the trigger renders as a static workspace badge (no dropdown). */
  canSwitch?: boolean;
  /** Compact mode shows only the workspace logo/initial — for tight spaces. */
  collapsed?: boolean;
}

function workspaceInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function PartnerAvatar({
  partner,
  size = "md",
}: {
  partner: Partner;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const text = size === "sm" ? "text-xs" : "text-sm";
  if (partner.logoUrl) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md bg-muted overflow-hidden",
          dim
        )}
      >
        <img
          src={partner.logoUrl}
          alt={partner.name}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-foreground text-background font-semibold",
        dim,
        text
      )}
    >
      {workspaceInitial(partner.name)}
    </div>
  );
}

export function PartnerSelector({
  partners,
  currentPartnerId,
  canSwitch = true,
  collapsed = false,
}: PartnerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { setSwitchingPartner } = useSidebar();

  // Keep the global "switching" flag in sync with this transition. When the
  // RSC refresh finishes the transition flips back to !pending and we clear it.
  useEffect(() => {
    setSwitchingPartner(isPending);
    return () => {
      if (isPending) setSwitchingPartner(false);
    };
  }, [isPending, setSwitchingPartner]);

  const current =
    partners.find((p) => p.id === currentPartnerId) ?? partners[0] ?? null;

  const handleSelect = (partnerId: string) => {
    if (partnerId === currentPartnerId) {
      setOpen(false);
      return;
    }
    setOpen(false);
    startTransition(async () => {
      const result = await setActivePartner(partnerId);
      if (result.success) {
        router.refresh();
      }
    });
  };

  if (!current) {
    return null;
  }

  const trigger = (
    <button
      type="button"
      onClick={() => canSwitch && setOpen((v) => !v)}
      disabled={!canSwitch || isPending}
      title={collapsed ? current.name : undefined}
      className={cn(
        "group flex items-center rounded-lg border bg-card transition-colors",
        collapsed
          ? "h-9 w-9 justify-center"
          : "h-9 gap-2 px-2 pr-2.5 text-left",
        canSwitch
          ? "hover:bg-muted/60"
          : "cursor-default"
      )}
    >
      <PartnerAvatar partner={current} size="sm" />
      {!collapsed && (
        <>
          <span className="min-w-0 max-w-[160px] truncate text-sm font-medium">
            {current.name}
          </span>
          {canSwitch && (
            <CaretUpDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-opacity",
                isPending ? "opacity-40" : "opacity-70 group-hover:opacity-100"
              )}
            />
          )}
        </>
      )}
    </button>
  );

  return (
    <div className="relative">
      {trigger}
      {open && canSwitch && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-lg border bg-card shadow-lg">
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Cambiar partner
            </div>
            <div className="max-h-72 overflow-y-auto p-1">
              {partners.map((partner) => {
                const active = partner.id === currentPartnerId;
                return (
                  <button
                    key={partner.id}
                    onClick={() => handleSelect(partner.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      active
                        ? "bg-muted text-foreground"
                        : "text-foreground/85 hover:bg-muted/70 hover:text-foreground"
                    )}
                  >
                    <PartnerAvatar partner={partner} size="sm" />
                    <span className="min-w-0 flex-1 truncate">
                      {partner.name}
                    </span>
                    {active && (
                      <Check
                        weight="bold"
                        className="h-4 w-4 shrink-0 text-primary"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
