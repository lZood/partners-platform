"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (next: boolean) => void;
  /** True while a partner switch is in flight (action + RSC refresh). */
  isSwitchingPartner: boolean;
  setSwitchingPartner: (next: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    return {
      collapsed: false,
      toggle: () => {},
      setCollapsed: () => {},
      isSwitchingPartner: false,
      setSwitchingPartner: () => {},
    };
  }
  return ctx;
}

const COLLAPSED_COOKIE = "sidebar_collapsed";

function persistCollapsed(next: boolean) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${COLLAPSED_COOKIE}=${
    next ? "1" : "0"
  }; path=/; max-age=${maxAge}; samesite=lax`;
}

export function SidebarShell({
  collapsed: initialCollapsed = false,
  children,
}: {
  collapsed?: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsedState] = useState(initialCollapsed);
  const [isSwitchingPartner, setSwitchingPartner] = useState(false);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    persistCollapsed(next);
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      persistCollapsed(next);
      return next;
    });
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        toggle,
        setCollapsed,
        isSwitchingPartner,
        setSwitchingPartner,
      }}
    >
      <div
        className={cn(
          "min-h-screen bg-background",
          collapsed ? "lg:[--sidebar-w:4.5rem]" : "lg:[--sidebar-w:16rem]"
        )}
      >
        <div className="lg:pl-[var(--sidebar-w)] transition-[padding] duration-300 ease-in-out">
          {/* Top progress bar — visible while a partner switch is in flight */}
          <div
            className={cn(
              "fixed left-0 right-0 top-0 z-[60] h-0.5 overflow-hidden pointer-events-none transition-opacity duration-200 lg:left-[var(--sidebar-w)]",
              isSwitchingPartner ? "opacity-100" : "opacity-0"
            )}
          >
            <div className="h-full w-1/3 bg-primary animate-sidebar-progress" />
          </div>
          {children}
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
