"use client";

import { useState } from "react";
import { Building2, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Partner {
  id: string;
  name: string;
}

interface PartnerSelectorProps {
  partners: Partner[];
  currentPartnerId: string;
  onPartnerChange: (partnerId: string) => void;
}

export function PartnerSelector({
  partners,
  currentPartnerId,
  onPartnerChange,
}: PartnerSelectorProps) {
  const [open, setOpen] = useState(false);
  const current = partners.find((p) => p.id === currentPartnerId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent transition-colors"
      >
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span>{current?.name ?? "Seleccionar Partner"}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full left-0 z-50 mt-1 w-56 rounded-md border bg-background shadow-lg">
            <div className="p-1">
              {partners.map((partner) => (
                <button
                  key={partner.id}
                  onClick={() => {
                    onPartnerChange(partner.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors",
                    partner.id === currentPartnerId
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-accent"
                  )}
                >
                  {partner.id === currentPartnerId && (
                    <Check className="h-3 w-3" />
                  )}
                  <span
                    className={
                      partner.id !== currentPartnerId ? "ml-5" : ""
                    }
                  >
                    {partner.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
