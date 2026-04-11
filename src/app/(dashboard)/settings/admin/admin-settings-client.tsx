"use client";

import { useState } from "react";
import { Building2, ClipboardList } from "lucide-react";
import { PartnersClient } from "../partners/partners-client";
import { AuditLogClient } from "../audit-log/audit-log-client";
import { cn } from "@/lib/utils";

interface Props {
  isSuperAdmin: boolean;
  initialPartners: any[];
  initialAuditData: any;
}

export function AdminSettingsClient({
  isSuperAdmin,
  initialPartners,
  initialAuditData,
}: Props) {
  const tabs = [
    ...(isSuperAdmin
      ? [{ key: "partners", label: "Partners", icon: Building2 }]
      : []),
    { key: "activity", label: "Registro de Actividad", icon: ClipboardList },
  ];

  const [activeTab, setActiveTab] = useState(tabs[0]?.key ?? "activity");

  // If only one tab (admin role), no tab bar needed
  if (tabs.length === 1) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administracion</h1>
          <p className="text-sm text-muted-foreground">
            Registro de cambios y actividad del sistema.
          </p>
        </div>
        {initialAuditData && <AuditLogClient initialData={initialAuditData} />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administracion</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona partners y revisa la actividad del sistema.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "partners" && isSuperAdmin && (
        <PartnersClient initialPartners={initialPartners} />
      )}
      {activeTab === "activity" && initialAuditData && (
        <AuditLogClient initialData={initialAuditData} />
      )}
    </div>
  );
}
