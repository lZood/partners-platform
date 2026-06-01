"use client";

import type { ReactNode } from "react";
import { useSidebar } from "@/components/layout/sidebar-shell";

export function MainContent({ children }: { children: ReactNode }) {
  const { isSwitchingPartner } = useSidebar();
  return (
    <main
      data-switching={isSwitchingPartner}
      className="partner-switch-fade px-4 pb-8 pt-2 lg:px-6"
    >
      {children}
    </main>
  );
}
