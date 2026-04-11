"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import gsap from "gsap";
import {
  LayoutDashboard,
  Upload,
  FileText,
  Package,
  Users,
  Building2,
  ClipboardList,
  Wallet,
  CreditCard,
  UserCog,
  MoreHorizontal,
  LogOut,
  HelpCircle,
  Moon,
  Sun,
  Monitor,
  Menu,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/components/shared/theme-provider";
import { cn, displayName, getInitials } from "@/lib/utils";

const navigation = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    roles: ["super_admin", "admin", "collaborator"],
  },
  {
    title: "Mis Ganancias",
    href: "/my-earnings",
    icon: Wallet,
    roles: ["collaborator"],
  },
  {
    title: "Subir CSV",
    href: "/upload",
    icon: Upload,
    roles: ["super_admin", "admin"],
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
    roles: ["super_admin", "admin"],
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
];

const settingsNav = [
  {
    title: "Perfil",
    href: "/settings",
    icon: UserCog,
    roles: ["super_admin", "admin", "collaborator"],
  },
  {
    title: "Partners",
    href: "/settings/partners",
    icon: Building2,
    roles: ["super_admin"],
  },
  {
    title: "Audit Log",
    href: "/settings/audit-log",
    icon: ClipboardList,
    roles: ["super_admin", "admin"],
  },
];

interface SidebarProps {
  userRole?: string;
  userName?: string;
  partnerName?: string;
  avatarUrl?: string | null;
}

export function Sidebar({
  userRole = "admin",
  userName = "Usuario",
  partnerName = "Partner",
  avatarUrl = null,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const supabase = createClient();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: "global" });
    // Force a hard navigation to clear Next.js router cache completely
    window.location.href = "/login";
  };

  const filteredNav = navigation.filter((item) =>
    item.roles.includes(userRole)
  );
  const filteredSettings = settingsNav.filter((item) =>
    item.roles.includes(userRole)
  );

  useEffect(() => {
    if (!navRef.current) return;
    const items = navRef.current.querySelectorAll("[data-nav-item]");
    gsap.fromTo(
      items,
      { opacity: 0, x: -8 },
      { opacity: 1, x: 0, duration: 0.3, stagger: 0.04, ease: "power2.out" }
    );
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const shortName = displayName(userName);
  const initials = getInitials(userName);

  const themeOptions = [
    { value: "light" as const, icon: Sun, label: "Claro" },
    { value: "dark" as const, icon: Moon, label: "Oscuro" },
    { value: "system" as const, icon: Monitor, label: "Sistema" },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            B
          </div>
          <span className="text-lg font-semibold tracking-tight">BoxFi</span>
        </Link>
        {/* Close button - mobile only */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav ref={navRef} className="flex-1 overflow-y-auto px-3 py-2">
        <p className="mb-1.5 mt-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Principal
        </p>
        {filteredNav.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              data-nav-item
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-all duration-150",
                isActive
                  ? "bg-primary/8 text-primary"
                  : "text-foreground/65 hover:bg-muted hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
              )}
              <item.icon className="h-[18px] w-[18px]" />
              {item.title}
            </Link>
          );
        })}

        {filteredSettings.length > 0 && (
          <>
            <p className="mb-1.5 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Configuracion
            </p>
            {filteredSettings.map((item) => {
              const isActive =
                item.href === "/settings"
                  ? pathname === "/settings"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-nav-item
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-all duration-150",
                    isActive
                      ? "bg-primary/8 text-primary"
                      : "text-foreground/65 hover:bg-muted hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
                  )}
                  <item.icon className="h-[18px] w-[18px]" />
                  {item.title}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="relative border-t px-3 py-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{shortName}</p>
            <p className="truncate text-xs text-muted-foreground">{partnerName}</p>
          </div>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Dropdown menu */}
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute bottom-full left-3 right-3 z-50 mb-1 rounded-lg border bg-card shadow-lg">
              <div className="p-1">
                {/* Theme selector */}
                <div className="px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Tema
                  </p>
                  <div className="flex gap-1">
                    {themeOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setTheme(opt.value)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                          theme === opt.value
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground/65 hover:bg-muted"
                        )}
                      >
                        <opt.icon className="h-3.5 w-3.5" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mx-2 my-1 h-px bg-border" />
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    window.open("https://help.boxfi.com", "_blank");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground/75 hover:bg-muted transition-colors"
                >
                  <HelpCircle className="h-4 w-4" />
                  Ayuda
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar Sesion
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-card shadow-md border lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - desktop: fixed, mobile: overlay */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-64 border-r bg-[hsl(var(--sidebar-bg))] transition-transform duration-300 ease-in-out",
          "lg:translate-x-0 lg:z-40",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
