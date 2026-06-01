"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import {
  SquaresFour,
  FileText,
  Package,
  Users,
  Gear,
  CreditCard,
  UserGear,
  SignOut,
  Question,
  Moon,
  Sun,
  Monitor,
  List,
  X,
  Wallet,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/components/shared/theme-provider";
import { cn, displayName, getInitials } from "@/lib/utils";
import { useSidebar } from "@/components/layout/sidebar-shell";

type NavItem = {
  title: string;
  href: string;
  icon: typeof SquaresFour;
  roles: string[];
};

type NavSection = {
  id: string;
  title: string;
  items: NavItem[];
};

const sections: NavSection[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    items: [
      {
        title: "Inicio",
        href: "/",
        icon: SquaresFour,
        roles: ["super_admin", "admin", "collaborator"],
      },
      {
        title: "Reportes",
        href: "/reports",
        icon: FileText,
        roles: ["super_admin", "admin", "collaborator"],
      },
      {
        title: "Productos",
        href: "/products",
        icon: Package,
        roles: ["super_admin", "admin", "collaborator"],
      },
    ],
  },
  {
    id: "operations",
    title: "Operaciones",
    items: [
      {
        title: "Mis Ingresos",
        href: "/my-income",
        icon: Wallet,
        roles: ["super_admin", "admin", "collaborator"],
      },
      {
        title: "Colaboradores",
        href: "/collaborators",
        icon: Users,
        roles: ["super_admin", "admin"],
      },
      {
        title: "Pagos",
        href: "/payments",
        icon: CreditCard,
        roles: ["super_admin", "admin"],
      },
    ],
  },
  {
    id: "settings",
    title: "Configuración",
    items: [
      {
        title: "Perfil",
        href: "/settings",
        icon: UserGear,
        roles: ["super_admin", "admin", "collaborator"],
      },
      {
        title: "Administración",
        href: "/settings/admin",
        icon: Gear,
        roles: ["super_admin", "admin"],
      },
    ],
  },
];

interface SidebarProps {
  userRole?: string;
  userName?: string;
  avatarUrl?: string | null;
}

function isItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/settings") return pathname === "/settings";
  if (href === "/reports") {
    return pathname.startsWith("/reports") || pathname.startsWith("/upload");
  }
  return pathname.startsWith(href);
}

export function Sidebar({
  userRole = "admin",
  userName = "Usuario",
  avatarUrl = null,
}: SidebarProps) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const supabase = createClient();
  const { theme, setTheme } = useTheme();
  const { collapsed, toggle } = useSidebar();

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: "global" });
    window.location.href = "/login";
  };

  const filteredSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(userRole)),
    }))
    .filter((section) => section.items.length > 0);

  useEffect(() => {
    if (!navRef.current) return;
    const items = navRef.current.querySelectorAll("[data-nav-item]");
    gsap.fromTo(
      items,
      { opacity: 0, x: -8 },
      { opacity: 1, x: 0, duration: 0.3, stagger: 0.03, ease: "power2.out" }
    );
  }, []);

  const shortName = displayName(userName);
  const initials = getInitials(userName);

  const themeOptions = [
    { value: "light" as const, icon: Sun, label: "Claro" },
    { value: "dark" as const, icon: Moon, label: "Oscuro" },
    { value: "system" as const, icon: Monitor, label: "Auto" },
  ];

  // Collapsed mode is only meaningful on desktop. On mobile we always show the
  // expanded layout inside the slide-in drawer.
  const isCollapsed = collapsed && !mobileOpen;

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* BOXFI brand */}
      <div
        className={cn(
          "flex h-16 items-center px-3 transition-all",
          isCollapsed ? "justify-center" : "gap-1"
        )}
      >
        <Link
          href="/"
          className={cn(
            "flex items-center rounded-lg transition-colors hover:bg-muted/60",
            isCollapsed
              ? "h-9 w-9 justify-center"
              : "h-9 flex-1 gap-2 px-2"
          )}
          title={isCollapsed ? "BOXFI" : undefined}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background text-[13px] font-bold tracking-tight">
            B
          </div>
          {!isCollapsed && (
            <span className="text-[15px] font-bold tracking-[0.02em]">
              BOXFI
            </span>
          )}
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          aria-label="Cerrar menú"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation sections */}
      <nav
        ref={navRef}
        className={cn(
          "flex-1 overflow-y-auto pb-3 pt-1 scrollbar-none",
          isCollapsed ? "px-2" : "px-3"
        )}
      >
        {filteredSections.map((section, idx) => (
          <div key={section.id} className={cn(idx === 0 ? "mt-1" : "mt-5")}>
            {!isCollapsed ? (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.title}
              </p>
            ) : (
              idx > 0 && <div className="mx-2 my-2 h-px bg-border" />
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isItemActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-nav-item
                    onClick={() => setMobileOpen(false)}
                    title={isCollapsed ? item.title : undefined}
                    className={cn(
                      "flex items-center rounded-lg text-[13.5px] font-medium transition-colors duration-150",
                      isCollapsed
                        ? "h-10 w-10 justify-center"
                        : "gap-3 px-3 py-2",
                      active
                        ? "bg-muted text-foreground"
                        : "text-foreground/65 hover:bg-muted/70 hover:text-foreground"
                    )}
                  >
                    <item.icon
                      weight={active ? "fill" : "regular"}
                      className={cn(
                        "h-[18px] w-[18px] shrink-0",
                        active ? "text-primary" : "text-foreground/55"
                      )}
                    />
                    {!isCollapsed && (
                      <span className="truncate">{item.title}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div
        className={cn(
          "border-t py-3 space-y-3",
          isCollapsed ? "px-2" : "px-3"
        )}
      >
        {/* User row */}
        <div
          className={cn(
            "flex items-center",
            isCollapsed ? "justify-center" : "gap-3 px-1"
          )}
        >
          <div
            title={isCollapsed ? `${shortName} · ${userRole}` : undefined}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold overflow-hidden"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={userName}
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          {!isCollapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{shortName}</p>
                <p className="truncate text-xs text-muted-foreground capitalize">
                  {userRole.replace("_", " ")}
                </p>
              </div>
              <div className="flex shrink-0 rounded-md border bg-muted/50 p-0.5">
                {themeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    title={opt.label}
                    className={cn(
                      "flex items-center justify-center rounded p-1.5 transition-colors",
                      theme === opt.value
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <opt.icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Help + Logout + collapse toggle */}
        {!isCollapsed ? (
          <div className="flex items-center justify-between px-1">
            <Link
              href="/help"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Question className="h-3.5 w-3.5" />
              Ayuda
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 transition-colors"
            >
              <SignOut className="h-3.5 w-3.5" />
              Cerrar sesión
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Link
              href="/help"
              title="Ayuda"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Question className="h-4 w-4" />
            </Link>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="flex h-8 w-8 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 transition-colors"
            >
              <SignOut className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={toggle}
          title={collapsed ? "Expandir" : "Colapsar"}
          className={cn(
            "hidden lg:flex h-7 w-full items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
            isCollapsed ? "" : "text-xs gap-1.5"
          )}
        >
          {collapsed ? (
            <CaretRight className="h-3.5 w-3.5" />
          ) : (
            <>
              <CaretLeft className="h-3.5 w-3.5" />
              <span>Colapsar</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-card shadow-md border lg:hidden"
        aria-label="Abrir menú"
      >
        <List className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen border-r bg-[hsl(var(--sidebar-bg))] transition-all duration-300 ease-in-out",
          "lg:translate-x-0 lg:z-40",
          isCollapsed ? "lg:w-[4.5rem]" : "lg:w-64",
          "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
