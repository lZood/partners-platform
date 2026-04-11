"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import {
  Users,
  Plus,
  Search,
  User,
  Ghost,
  AlertCircle,
  ChevronRight,
  Download,
  Clock,
  CheckSquare,
  UserCheck,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createCollaborator,
  assignUserToPartner,
  toggleCollaboratorActive,
} from "@/actions/users";
import { useToast } from "@/components/shared/toast-provider";
import { displayName } from "@/lib/utils";

interface UserPartnerRole {
  id: string;
  role: string;
  partner_id: string;
  partners: { id: string; name: string } | null;
}

interface AppUser {
  id: string;
  name: string;
  email: string | null;
  user_type: string;
  is_active: boolean;
  created_at: string;
  auth_user_id: string | null;
  avatar_url: string | null;
  lastActivity: string | null;
  user_partner_roles: UserPartnerRole[];
}

interface UnassignedUser {
  id: string;
  name: string;
  email: string | null;
  created_at: string;
}

interface Props {
  initialUsers: AppUser[];
  partners: { id: string; name: string }[];
  unassignedUsers: UnassignedUser[];
  isSuperAdmin: boolean;
}

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  collaborator: "Colaborador",
};

export function CollaboratorsClient({
  initialUsers,
  partners,
  unassignedUsers,
  isSuperAdmin,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [userType, setUserType] = useState("virtual_profile");
  const [createPartnerId, setCreatePartnerId] = useState(partners[0]?.id ?? "");
  const [createRole, setCreateRole] = useState("collaborator");

  const [assignUserId, setAssignUserId] = useState("");
  const [assignPartnerId, setAssignPartnerId] = useState(partners[0]?.id ?? "");
  const [assignRole, setAssignRole] = useState("collaborator");

  const [search, setSearch] = useState("");
  const [filterPartner, setFilterPartner] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Bulk selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll("[data-animate-card]");
    gsap.fromTo(cards, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.04, ease: "power2.out" });
  }, []);

  const filtered = useMemo(() => {
    let list = [...initialUsers];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((u) => u.name.toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q));
    }
    if (filterPartner) list = list.filter((u) => u.user_partner_roles.some((r) => r.partner_id === filterPartner));
    if (filterRole) list = list.filter((u) => u.user_partner_roles.some((r) => r.role === filterRole));
    if (filterType) list = list.filter((u) => u.user_type === filterType);
    if (filterStatus === "active") list = list.filter((u) => u.is_active);
    if (filterStatus === "inactive") list = list.filter((u) => !u.is_active && u.user_type !== "system_user");
    if (filterStatus === "pending") list = list.filter((u) => !u.is_active && u.user_type === "system_user");
    return list;
  }, [initialUsers, search, filterPartner, filterRole, filterType, filterStatus]);

  const activeCount = initialUsers.filter((u) => u.is_active).length;
  const systemCount = initialUsers.filter((u) => u.user_type === "system_user").length;

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set("userType", userType);
    formData.set("partnerId", createPartnerId);
    formData.set("role", createRole);
    const result = await createCollaborator(formData);
    setLoading(false);
    if (result.success) {
      showToast("Colaborador creado", "success");
      setCreateOpen(false);
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleAssign = async () => {
    if (!assignUserId || !assignPartnerId) return;
    setLoading(true);
    const result = await assignUserToPartner(assignUserId, assignPartnerId, assignRole as any);
    setLoading(false);
    if (result.success) {
      showToast("Usuario asignado", "success");
      setAssignOpen(false);
      setAssignUserId("");
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const timeAgo = (d: string | null) => {
    if (!d) return null;
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d`;
    return `${Math.floor(days / 30)}mes`;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((u) => u.id)));
    }
  };

  const handleBulkToggle = async (activate: boolean) => {
    setBulkLoading(true);
    const promises = Array.from(selectedIds).map((id) =>
      toggleCollaboratorActive(id, activate)
    );
    await Promise.allSettled(promises);
    setBulkLoading(false);
    setSelectedIds(new Set());
    setSelectionMode(false);
    showToast(
      `${selectedIds.size} colaborador(es) ${activate ? "activados" : "desactivados"}`,
      "success"
    );
    router.refresh();
  };

  const handleExport = () => {
    window.open("/api/collaborators/export", "_blank");
  };

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Colaboradores</h1>
          <p className="text-muted-foreground">Gestiona colaboradores y perfiles virtuales.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1.5 h-4 w-4" /> Exportar
          </Button>
          {isSuperAdmin && (
            <Button
              variant={selectionMode ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                setSelectionMode(!selectionMode);
                setSelectedIds(new Set());
              }}
            >
              <CheckSquare className="mr-1.5 h-4 w-4" />
              {selectionMode ? "Cancelar" : "Seleccionar"}
            </Button>
          )}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo
          </Button>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Nuevo Colaborador</DialogTitle>
                <DialogDescription>Perfiles virtuales son para contabilidad. Usuarios del sistema pueden iniciar sesion.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={userType} onValueChange={setUserType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="virtual_profile">Perfil Virtual</SelectItem>
                      <SelectItem value="system_user">Usuario del Sistema</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input id="name" name="name" placeholder="Nombre completo" required />
                </div>
                {userType === "system_user" && (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" placeholder="email@ejemplo.com" required />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Partner</Label>
                    <Select value={createPartnerId} onValueChange={setCreatePartnerId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {partners.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Rol</Label>
                    <Select value={createRole} onValueChange={setCreateRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="collaborator">Colaborador</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={loading}>{loading ? "Creando..." : "Crear"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectionMode && selectedIds.size > 0 && (
        <Card data-animate-card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-3 p-3">
            <button onClick={selectAll} className="text-xs text-primary hover:underline">
              {selectedIds.size === filtered.length ? "Deseleccionar todos" : "Seleccionar todos"}
            </button>
            <span className="text-xs text-muted-foreground">{selectedIds.size} seleccionado(s)</span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkToggle(true)}
                disabled={bulkLoading}
              >
                <UserCheck className="mr-1.5 h-3.5 w-3.5 text-green-600" />
                Activar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkToggle(false)}
                disabled={bulkLoading}
              >
                <UserX className="mr-1.5 h-3.5 w-3.5 text-destructive" />
                Desactivar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unassigned alert */}
      {unassignedUsers.length > 0 && (
        <Card data-animate-card className="border-0 shadow-sm bg-amber-50 dark:bg-amber-950/20 cursor-pointer" onClick={() => setAssignOpen(true)}>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{unassignedUsers.length} usuario(s) sin asignar</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">Click para asignarlos a un partner</p>
            </div>
            <ChevronRight className="h-4 w-4 text-amber-600" />
          </CardContent>
        </Card>
      )}

      {/* Assign dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Usuarios</DialogTitle>
            <DialogDescription>Selecciona un usuario y asignalo a un partner.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Usuario</Label>
              <Select value={assignUserId || undefined} onValueChange={setAssignUserId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {unassignedUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name} {u.email ? `(${u.email})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Partner</Label>
                <Select value={assignPartnerId} onValueChange={setAssignPartnerId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {partners.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={assignRole} onValueChange={setAssignRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="collaborator">Colaborador</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={loading || !assignUserId}>{loading ? "Asignando..." : "Asignar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total", value: initialUsers.length },
          { label: "Activos", value: activeCount, color: "text-green-600" },
          { label: "Sistema", value: systemCount },
          { label: "Virtuales", value: initialUsers.length - systemCount },
        ].map((s) => (
          <Card key={s.label} data-animate-card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color ?? ""}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 w-48 h-9 bg-card border-0 shadow-sm" />
        </div>
        {partners.length > 1 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Partner:</span>
            <Select value={filterPartner || "all"} onValueChange={(v) => setFilterPartner(v === "all" ? "" : v)}>
              <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {partners.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Rol:</span>
          <Select value={filterRole || "all"} onValueChange={(v) => setFilterRole(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="collaborator">Colaborador</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Tipo:</span>
          <Select value={filterType || "all"} onValueChange={(v) => setFilterType(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="system_user">Sistema</SelectItem>
              <SelectItem value="virtual_profile">Virtual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Estado:</span>
          <Select value={filterStatus || "all"} onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="inactive">Inactivo</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} de {initialUsers.length}</span>
      </div>

      {/* Collaborator cards */}
      {filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex h-[200px] items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Users className="mx-auto h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">{search ? "Sin resultados" : "Sin colaboradores"}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((user) => {
            const statusColor = user.is_active ? "bg-green-500" : user.user_type === "system_user" ? "bg-amber-500" : "bg-gray-300";
            const lastAct = timeAgo(user.lastActivity);

            return (
              <Card
                key={user.id}
                data-animate-card
                className="border-0 shadow-sm transition-card hover-lift cursor-pointer group"
                onClick={() => {
                  if (selectionMode) {
                    toggleSelect(user.id);
                  } else {
                    router.push(`/collaborators/${user.id}`);
                  }
                }}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  {selectionMode && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(user.id)}
                      onChange={() => toggleSelect(user.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-border accent-primary shrink-0"
                    />
                  )}
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold overflow-hidden">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
                    ) : user.user_type === "system_user" ? (
                      <User className="h-5 w-5" />
                    ) : (
                      <Ghost className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{displayName(user.name)}</p>
                      <span className={`h-2 w-2 rounded-full ${statusColor}`} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email ?? "Sin email"}
                      {lastAct && (
                        <span className="ml-2 inline-flex items-center gap-0.5">
                          <Clock className="h-3 w-3" /> {lastAct}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    {user.user_partner_roles.map((upr) => (
                      <Badge key={upr.id} variant="outline" className="text-[10px]">
                        {upr.partners?.name} · {roleLabels[upr.role] ?? upr.role}
                      </Badge>
                    ))}
                  </div>
                  <Badge
                    variant={user.user_type === "system_user" ? "secondary" : "outline"}
                    className="text-[10px] shrink-0 hidden md:inline-flex"
                  >
                    {user.user_type === "system_user" ? "Sistema" : "Virtual"}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
