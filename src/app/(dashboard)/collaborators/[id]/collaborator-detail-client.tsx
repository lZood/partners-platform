"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { AreaChart } from "@tremor/react";
import {
  ArrowLeft,
  User,
  Ghost,
  Building2,
  Package,
  DollarSign,
  Clock,
  Save,
  Camera,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Plus,
  Shield,
  CreditCard,
  Download,
  CheckCircle2,
  FileText,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  updateCollaborator,
  toggleCollaboratorActive,
  deleteUser,
  updateUserRole,
  updateUserAvatar,
  resendInvitation,
} from "@/actions/users";
import { assignUserToPartner, removeMemberFromPartner } from "@/actions/partners";
import { uploadFile, getFileExtension } from "@/lib/supabase/storage";
import { useToast } from "@/components/shared/toast-provider";
import {
  formatUSD,
  formatPercentage,
  displayName,
  getInitials,
} from "@/lib/utils";

interface Props {
  data: {
    user: any;
    roles: any[];
    products: { id: string; name: string; isActive: boolean; imageUrl: string | null; productType: string; percentageShare: number }[];
    earnings: {
      totalUsd: number;
      totalPaymentsUsd: number;
      pendingUsd: number;
      monthly: { month: string; label: string; totalUsd: number }[];
    };
    payments: { id: string; totalUsd: number; paidAt: string; paymentMethod: string | null }[];
    lastLogin: { createdAt: string; ipAddress: string | null } | null;
  };
  partners: { id: string; name: string }[];
  isSuperAdmin: boolean;
}

const tabs = [
  { id: "general", label: "General", icon: User },
  { id: "partners", label: "Partners", icon: Building2 },
  { id: "products", label: "Productos", icon: Package },
  { id: "earnings", label: "Ganancias", icon: DollarSign },
];

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  collaborator: "Colaborador",
};

export function CollaboratorDetailClient({ data, partners, isSuperAdmin }: Props) {
  const { user, roles, products, earnings, payments, lastLogin } = data;

  const router = useRouter();
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState("general");
  const [saving, setSaving] = useState(false);
  const [addPartnerOpen, setAddPartnerOpen] = useState(false);
  const [addPartnerId, setAddPartnerId] = useState("");
  const [addPartnerRole, setAddPartnerRole] = useState("collaborator");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar_url);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll("[data-animate-card]");
    gsap.fromTo(cards, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.06, ease: "power2.out" });
  }, [activeTab]);

  const handleSaveGeneral = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const result = await updateCollaborator(user.id, formData);
    setSaving(false);
    if (result.success) {
      showToast("Datos actualizados", "success");
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleToggle = async () => {
    const result = await toggleCollaboratorActive(user.id, !user.is_active);
    if (result.success) {
      showToast(user.is_active ? "Desactivado" : "Activado", "success");
      router.refresh();
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Eliminar permanentemente a "${user.name}"? Esta accion no se puede deshacer.`)) return;
    const result = await deleteUser(user.id);
    if (result.success) {
      showToast("Eliminado", "success");
      router.push("/collaborators");
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);

    const ext = getFileExtension(file);
    const result = await uploadFile("avatars", `${user.id}.${ext}`, file);
    if ("url" in result) {
      await updateUserAvatar(result.url);
      showToast("Foto actualizada", "success");
      router.refresh();
    }
  };

  const handleChangeRole = async (roleId: string, partnerId: string, newRole: string) => {
    const result = await updateUserRole(user.id, partnerId, newRole as any);
    if (result.success) {
      showToast("Rol actualizado", "success");
      router.refresh();
    }
  };

  const handleAddPartner = async () => {
    if (!addPartnerId) return;
    setSaving(true);
    const result = await assignUserToPartner(user.id, addPartnerId, addPartnerRole as any);
    setSaving(false);
    if (result.success) {
      showToast("Partner asignado", "success");
      setAddPartnerOpen(false);
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleRemovePartner = async (roleId: string, partnerName: string) => {
    if (!confirm(`Remover a ${displayName(user.name)} de ${partnerName}?`)) return;
    const result = await removeMemberFromPartner(roleId, "");
    if (result.success) {
      showToast(`Removido de ${partnerName}`, "success");
      router.refresh();
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  const usdFormatter = (v: number) => formatUSD(v);

  const statusColor = user.is_active ? "bg-green-500" : user.user_type === "system_user" ? "bg-amber-500" : "bg-gray-300";

  // Partners not yet assigned
  const assignedPartnerIds = new Set(roles.map((r: any) => r.partner_id));
  const availablePartners = partners.filter((p) => !assignedPartnerIds.has(p.id));

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => router.push("/collaborators")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="relative group shrink-0">
          <div className="h-14 w-14 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
            {avatarPreview ? (
              <img src={avatarPreview} alt={user.name} className="h-full w-full object-cover" />
            ) : user.user_type === "system_user" ? (
              <User className="h-6 w-6 text-primary" />
            ) : (
              <Ghost className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <button
            onClick={() => avatarInputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            <Camera className="h-4 w-4 text-white" />
          </button>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{displayName(user.name)}</h1>
            <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
          </div>
          <p className="text-sm text-muted-foreground">
            {user.email ?? "Sin email"} · {user.user_type === "system_user" ? "Usuario del sistema" : "Perfil virtual"}
            {lastLogin && ` · Ultimo acceso: ${formatDate(lastLogin.createdAt)}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleToggle}>
            {user.is_active ? <ToggleRight className="mr-1.5 h-4 w-4 text-green-600" /> : <ToggleLeft className="mr-1.5 h-4 w-4" />}
            {user.is_active ? "Activo" : "Inactivo"}
          </Button>
          {isSuperAdmin && (
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.id === "products" && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{products.length}</Badge>}
          </button>
        ))}
      </div>

      {/* General tab */}
      {activeTab === "general" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <Card data-animate-card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">Informacion Personal</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSaveGeneral} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre</Label>
                    <Input id="name" name="name" defaultValue={user.name} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" defaultValue={user.email ?? ""} placeholder="email@ejemplo.com" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />{saving ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card data-animate-card className="border-0 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <p className="text-sm font-medium">{user.user_type === "system_user" ? "Usuario del Sistema" : "Perfil Virtual"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Registrado</p>
                  <p className="text-sm font-medium">{formatDate(user.created_at)}</p>
                </div>
                {user.totp_enabled && (
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-green-600 font-medium">2FA Activado</span>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card data-animate-card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Ganancias Totales</p>
                <p className="text-xl font-bold">{formatUSD(earnings.totalUsd)}</p>
                <p className="text-xs text-muted-foreground mt-2">Pendiente: <span className="text-red-600 font-medium">{formatUSD(earnings.pendingUsd)}</span></p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Partners tab */}
      {activeTab === "partners" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{roles.length} partner(s) asignado(s)</p>
            <Dialog open={addPartnerOpen} onOpenChange={setAddPartnerOpen}>
              <Button size="sm" onClick={() => setAddPartnerOpen(true)} disabled={availablePartners.length === 0}>
                <Plus className="mr-2 h-4 w-4" /> Agregar Partner
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Agregar Partner</DialogTitle>
                  <DialogDescription>Asignar a {displayName(user.name)} a un partner adicional.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Partner</Label>
                    <Select value={addPartnerId || undefined} onValueChange={setAddPartnerId}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                      <SelectContent>
                        {availablePartners.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Rol</Label>
                    <Select value={addPartnerRole} onValueChange={setAddPartnerRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="collaborator">Colaborador</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddPartnerOpen(false)}>Cancelar</Button>
                  <Button onClick={handleAddPartner} disabled={saving || !addPartnerId}>{saving ? "Asignando..." : "Asignar"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {roles.map((role: any) => (
            <Card key={role.id} data-animate-card className="border-0 shadow-sm">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{role.partners?.name ?? "—"}</p>
                </div>
                <Select value={role.role} onValueChange={(v) => handleChangeRole(role.id, role.partner_id, v)}>
                  <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="collaborator">Colaborador</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
                {roles.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemovePartner(role.id, role.partners?.name)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Products tab */}
      {activeTab === "products" && (
        <div className="space-y-2">
          {products.length > 0 ? products.map((p) => (
            <Card key={p.id} data-animate-card className="border-0 shadow-sm cursor-pointer hover-lift transition-card" onClick={() => router.push(`/products/${p.id}`)}>
              <CardContent className="flex items-center gap-4 p-4">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="h-10 w-10 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted"><Package className="h-5 w-5 text-muted-foreground" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.productType}</p>
                </div>
                <Badge variant="outline" className="font-mono shrink-0">{formatPercentage(p.percentageShare)}</Badge>
                {!p.isActive && <Badge variant="secondary" className="text-[10px]">Inactivo</Badge>}
              </CardContent>
            </Card>
          )) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex h-[150px] items-center justify-center text-muted-foreground">
                <p className="text-sm">Sin productos asignados</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Earnings tab */}
      {activeTab === "earnings" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card data-animate-card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Acumulado</p>
                <p className="text-xl font-bold">{formatUSD(earnings.totalUsd)}</p>
              </CardContent>
            </Card>
            <Card data-animate-card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Pagos Recibidos</p>
                <p className="text-xl font-bold text-green-600">{formatUSD(earnings.totalPaymentsUsd)}</p>
              </CardContent>
            </Card>
            <Card data-animate-card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Pendiente</p>
                <p className="text-xl font-bold text-red-600">{formatUSD(earnings.pendingUsd)}</p>
              </CardContent>
            </Card>
          </div>

          <Card data-animate-card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-base">Ganancias por Mes</CardTitle></CardHeader>
            <CardContent>
              {earnings.monthly.length > 0 ? (
                <AreaChart className="h-56" data={earnings.monthly} index="label" categories={["totalUsd"]} colors={["blue"]} valueFormatter={usdFormatter} yAxisWidth={72} showLegend={false} curveType="monotone" />
              ) : (
                <div className="flex h-56 items-center justify-center text-muted-foreground"><p className="text-sm">Sin datos</p></div>
              )}
            </CardContent>
          </Card>

          {payments.length > 0 && (
            <Card data-animate-card className="border-0 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-base">Ultimos Pagos</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg p-3 bg-muted/30">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="text-sm font-medium">{formatUSD(p.totalUsd)}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(p.paidAt)}{p.paymentMethod && ` · ${p.paymentMethod}`}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); window.open(`/api/payments/${p.id}/receipt`, "_blank"); }}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
