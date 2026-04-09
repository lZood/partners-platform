"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  FileText,
  Package,
  Users,
  Settings,
  Receipt,
  Building2,
  ClipboardList,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
];

const settingsNav = [
  {
    title: "Impuestos",
    href: "/settings/taxes",
    icon: Receipt,
    roles: ["super_admin", "admin"],
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
}

export function Sidebar({ userRole = "admin" }: SidebarProps) {
  const pathname = usePathname();

  const filteredNav = navigation.filter((item) =>
    item.roles.includes(userRole)
  );
  const filteredSettings = settingsNav.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-background">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              P
            </div>
            <span className="text-lg font-semibold">Partners</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          <p className="mb-2 px-3 text-xs font-medium uppercase text-muted-foreground">
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
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            );
          })}

          {filteredSettings.length > 0 && (
            <>
              <div className="my-4" />
              <p className="mb-2 px-3 text-xs font-medium uppercase text-muted-foreground">
                Configuracion
              </p>
              {filteredSettings.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t px-3 py-4">
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Settings className="h-4 w-4" />
            Configuracion
          </Link>
        </div>
      </div>
    </aside>
  );
}
