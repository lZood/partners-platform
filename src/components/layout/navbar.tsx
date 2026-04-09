"use client";

import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface NavbarProps {
  userName?: string;
  userRole?: string;
  partnerName?: string;
}

export function Navbar({
  userName = "Admin",
  userRole = "admin",
  partnerName = "Partner",
}: NavbarProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const roleLabel = {
    super_admin: "Super Admin",
    admin: "Admin",
    collaborator: "Colaborador",
  }[userRole] ?? userRole;

  const roleVariant = {
    super_admin: "default" as const,
    admin: "secondary" as const,
    collaborator: "outline" as const,
  }[userRole] ?? ("outline" as const);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {partnerName}
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <Badge variant={roleVariant}>{roleLabel}</Badge>
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span>{userName}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
