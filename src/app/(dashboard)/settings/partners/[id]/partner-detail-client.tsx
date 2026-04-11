"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import {
  ArrowLeft,
  Building2,
  Users,
  Package,
  Receipt,
  FileText,
  Pencil,
  Save,
  ToggleLeft,
  ToggleRight,
  UserPlus,
  Trash2,
  Lock,
  Unlock,
  ChevronRight,
  Shield,
  ShieldCheck,
  User,
  Plus,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Info,
  Camera,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  updatePartner,
  togglePartnerActive,
  addMemberToPartner,
  updateMemberRole,
  removeMemberFromPartner,
  updatePartnerLogo,
} from "@/actions/partners";
import { uploadFile, getFileExtension } from "@/lib/supabase/storage";
import {
  createTax,
  updateTax,
  deleteTax,
  toggleTaxActive,
  reorderTaxes,
} from "@/actions/taxes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/shared/toast-provider";
import { formatUSD, formatMXN, formatMonth, formatPercentage, displayName, getInitials } from "@/lib/utils";
import {
  ALL_PERMISSIONS,
  getUserPermissions,
  updateUserPermissions,
  resetToDefaultPermissions,
  type PermissionKey,
} from "@/actions/permissions";

interface PartnerData {
  partner: {
    id: string;
    name: string;
    description: string | null;
    logo_url: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
  members: {
    id: string;
    role: string;
    users: {
      id: string;
      name: string;
      email: string | null;
      user_type: string;
      is_active: boolean;
      created_at: string;
      avatar_url: string | null;
    };
  }[];
  products: {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    created_at: string;
    product_types: { name: string } | null;
    product_distributions: {
      id: string;
      percentage_share: number;
      users: { name: string } | null;
    }[];
  }[];
  taxes: {
    id: string;
    name: string;
    description: string | null;
    percentage_rate: number;
    priority_order: number;
    is_active: boolean;
  }[];
  recentReports: {
    id: string;
    report_month: string;
    total_usd: number;
    total_mxn: number;
    is_locked: boolean;
    created_at: string;
  }[];
  totals: { totalUsd: number; totalMxn: number };
}

interface SimpleUser {
  id: string;
  name: string;
  email: string | null;
  user_type: string;
  is_active: boolean;
}

interface Props {
  data: PartnerData;
  allUsers: SimpleUser[];
}

const tabs = [
  { id: "general", label: "General", icon: Building2 },
  { id: "members", label: "Miembros", icon: Users },
  { id: "products", label: "Productos", icon: Package },
  { id: "taxes", label: "Impuestos", icon: Receipt },
  { id: "activity", label: "Actividad", icon: FileText },
];

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  collaborator: "Colaborador",
};

const roleIcons: Record<string, typeof Shield> = {
  super_admin: ShieldCheck,
  admin: Shield,
  collaborator: User,
};

export function PartnerDetailClient({ data, allUsers }: Props) {
  const { partner, members, products, taxes, recentReports, totals } = data;

  const router = useRouter();
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState("general");
  const [saving, setSaving] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberUserId, setAddMemberUserId] = useState("");
  const [addMemberRole, setAddMemberRole] = useState("collaborator");
  const [taxDialogOpen, setTaxDialogOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<PartnerData["taxes"][0] | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(partner.logo_url);
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [permMember, setPermMember] = useState<any>(null);
  const [permValues, setPermValues] = useState<Record<string, boolean>>({});
  const [permLoading, setPermLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Members already in this partner
  const memberUserIds = new Set(members.map((m) => m.users.id));
  const availableUsers = allUsers.filter((u) => !memberUserIds.has(u.id));

  useEffect(() => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll("[data-animate-card]");
    gsap.fromTo(
      cards,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.35, stagger: 0.06, ease: "power2.out" }
    );
  }, [activeTab]);

  const handleSaveGeneral = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const result = await updatePartner(partner.id, formData);
    setSaving(false);
    if (result.success) {
      showToast("Partner actualizado", "success");
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleToggle = async () => {
    const result = await togglePartnerActive(partner.id, !partner.is_active);
    if (result.success) {
      showToast(
        partner.is_active ? "Partner desactivado" : "Partner activado",
        "success"
      );
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const openPermissions = async (member: any) => {
    setPermMember(member);
    setPermLoading(true);
    setPermDialogOpen(true);
    const result = await getUserPermissions(member.id, member.role);
    setPermValues(result.permissions);
    setPermLoading(false);
  };

  const handleSavePermissions = async () => {
    if (!permMember) return;
    setSaving(true);
    const result = await updateUserPermissions(
      permMember.id,
      partner.id,
      permValues
    );
    setSaving(false);
    if (result.success) {
      showToast("Permisos actualizados", "success");
      setPermDialogOpen(false);
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleResetPermissions = async () => {
    if (!permMember) return;
    setSaving(true);
    const result = await resetToDefaultPermissions(permMember.id, partner.id);
    setSaving(false);
    if (result.success) {
      showToast("Permisos restaurados a defaults", "success");
      setPermDialogOpen(false);
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);

    setUploadingLogo(true);
    const ext = getFileExtension(file);
    const path = `${partner.id}.${ext}`;
    const result = await uploadFile("logos", path, file);
    if ("error" in result) {
      showToast(result.error, "error");
      setLogoPreview(partner.logo_url);
      setUploadingLogo(false);
      return;
    }
    const saveResult = await updatePartnerLogo(partner.id, result.url);
    setUploadingLogo(false);
    if (saveResult.success) {
      showToast("Logo actualizado", "success");
      router.refresh();
    } else {
      showToast(saveResult.error ?? "Error", "error");
    }
  };

  const handleAddMember = async () => {
    if (!addMemberUserId) return;
    setSaving(true);
    const result = await addMemberToPartner(
      addMemberUserId,
      partner.id,
      addMemberRole
    );
    setSaving(false);
    if (result.success) {
      showToast("Miembro agregado", "success");
      setAddMemberOpen(false);
      setAddMemberUserId("");
      setAddMemberRole("collaborator");
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleChangeRole = async (roleId: string, newRole: string) => {
    const result = await updateMemberRole(roleId, partner.id, newRole);
    if (result.success) {
      showToast("Rol actualizado", "success");
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleRemoveMember = async (roleId: string, userName: string) => {
    if (!confirm(`Remover a "${userName}" de este partner?`)) return;
    const result = await removeMemberFromPartner(roleId, partner.id);
    if (result.success) {
      showToast(`"${userName}" removido`, "success");
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  // --- Tax handlers ---
  const handleTaxSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    formData.set("partnerId", partner.id);
    let result;
    if (editingTax) {
      result = await updateTax(editingTax.id, formData);
    } else {
      result = await createTax(formData);
    }
    setSaving(false);
    if (result.success) {
      showToast(
        editingTax
          ? `Impuesto "${formData.get("name")}" actualizado`
          : `Impuesto "${formData.get("name")}" creado`,
        "success"
      );
      setTaxDialogOpen(false);
      setEditingTax(null);
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleDeleteTax = async (tax: PartnerData["taxes"][0]) => {
    if (!confirm(`Eliminar el impuesto "${tax.name}"?`)) return;
    const result = await deleteTax(tax.id);
    if (result.success) {
      showToast(`"${tax.name}" eliminado`, "success");
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleToggleTax = async (tax: PartnerData["taxes"][0]) => {
    const result = await toggleTaxActive(tax.id, !tax.is_active);
    if (result.success) {
      showToast(
        tax.is_active ? `"${tax.name}" desactivado` : `"${tax.name}" activado`,
        "success"
      );
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleMoveTax = async (index: number, direction: "up" | "down") => {
    const newTaxes = [...taxes];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newTaxes.length) return;
    [newTaxes[index], newTaxes[targetIndex]] = [newTaxes[targetIndex], newTaxes[index]];
    const orderedIds = newTaxes.map((t) => t.id);
    const result = await reorderTaxes(partner.id, orderedIds);
    if (result.success) {
      showToast("Orden actualizado", "success");
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  // Tax cascade preview
  const activeTaxes = taxes.filter((t) => t.is_active);
  const cascadePreview = (() => {
    let remaining = 100;
    return activeTaxes.map((tax) => {
      const deducted = remaining * (Number(tax.percentage_rate) / 100);
      remaining -= deducted;
      return { ...tax, deducted, remaining };
    });
  })();

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Back button + header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => router.push("/settings/partners")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {/* Logo */}
        <div className="relative group shrink-0">
          <div className="h-12 w-12 rounded-xl overflow-hidden bg-primary/10 flex items-center justify-center">
            {logoPreview ? (
              <img
                src={logoPreview}
                alt={partner.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <Building2 className="h-6 w-6 text-primary" />
            )}
          </div>
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            disabled={uploadingLogo}
            className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            <Camera className="h-4 w-4 text-white" />
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {partner.name}
            </h1>
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                partner.is_active ? "bg-green-500" : "bg-gray-300"
              }`}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {partner.description || "Sin descripcion"} · Creado el{" "}
            {formatDate(partner.created_at)}
            {uploadingLogo && " · Subiendo logo..."}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.id === "members" && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {members.length}
              </Badge>
            )}
            {tab.id === "products" && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {products.length}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "general" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            {/* Edit form */}
            <Card data-animate-card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">
                  Informacion del Partner
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveGeneral} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre</Label>
                      <Input
                        id="name"
                        name="name"
                        defaultValue={partner.name}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descripcion</Label>
                      <Input
                        id="description"
                        name="description"
                        defaultValue={partner.description ?? ""}
                        placeholder="Descripcion del partner"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        Estado:
                      </span>
                      <button
                        type="button"
                        onClick={handleToggle}
                        className="flex items-center gap-1.5 text-sm"
                      >
                        {partner.is_active ? (
                          <>
                            <ToggleRight className="h-5 w-5 text-green-600" />
                            <span className="text-green-600 font-medium">
                              Activo
                            </span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Inactivo
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                    <Button type="submit" disabled={saving}>
                      <Save className="mr-2 h-4 w-4" />
                      {saving ? "Guardando..." : "Guardar"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Dates info */}
            <Card data-animate-card className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Creado</p>
                    <p className="font-medium">
                      {formatDate(partner.created_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ultima actualizacion</p>
                    <p className="font-medium">
                      {formatDate(partner.updated_at)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stats sidebar */}
          <div className="space-y-4">
            {[
              { label: "Miembros", value: members.length, icon: Users, color: "text-blue-600 bg-blue-50" },
              { label: "Productos activos", value: products.filter((p) => p.is_active).length, icon: Package, color: "text-violet-600 bg-violet-50" },
              { label: "Impuestos activos", value: activeTaxes.length, icon: Receipt, color: "text-amber-600 bg-amber-50" },
              { label: "Reportes", value: recentReports.length, icon: FileText, color: "text-emerald-600 bg-emerald-50" },
            ].map((stat) => (
              <Card key={stat.label} data-animate-card className="border-0 shadow-sm">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">
                      {stat.label}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
            {recentReports.length > 0 && (
              <Card data-animate-card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">
                    Total Acumulado
                  </p>
                  <p className="text-lg font-bold">{formatUSD(totals.totalUsd)}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatMXN(totals.totalMxn)}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === "members" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {members.length} miembro{members.length !== 1 ? "s" : ""} en este
              partner
            </p>
            <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
              <Button
                size="sm"
                onClick={() => setAddMemberOpen(true)}
                disabled={availableUsers.length === 0}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Agregar Miembro
              </Button>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Agregar Miembro</DialogTitle>
                  <DialogDescription>
                    Asigna un usuario existente a {partner.name}.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Usuario</Label>
                    <Select value={addMemberUserId || undefined} onValueChange={setAddMemberUserId}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar usuario..." /></SelectTrigger>
                      <SelectContent>
                        {availableUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name} {u.email ? `(${u.email})` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Rol</Label>
                    <Select value={addMemberRole} onValueChange={setAddMemberRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="collaborator">Colaborador</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setAddMemberOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleAddMember}
                    disabled={!addMemberUserId || saving}
                  >
                    {saving ? "Agregando..." : "Agregar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-2">
            {members.map((member) => {
              const RoleIcon = roleIcons[member.role] ?? User;
              return (
                <Card
                  key={member.id}
                  data-animate-card
                  className="border-0 shadow-sm"
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold overflow-hidden">
                      {member.users.avatar_url ? (
                        <img
                          src={member.users.avatar_url}
                          alt={member.users.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getInitials(member.users.name)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {displayName(member.users.name)}
                        </p>
                        {!member.users.is_active && (
                          <Badge variant="secondary" className="text-[10px]">
                            Inactivo
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.users.email ?? "Sin email"} ·{" "}
                        {member.users.user_type === "virtual_profile"
                          ? "Perfil virtual"
                          : "Usuario del sistema"}
                      </p>
                    </div>
                    <Select value={member.role} onValueChange={(v) => handleChangeRole(member.id, v)}>
                      <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="collaborator">Colaborador</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      title="Permisos"
                      onClick={() => openPermissions(member)}
                    >
                      <Shield className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                      onClick={() =>
                        handleRemoveMember(member.id, member.users.name)
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
            {members.length === 0 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="flex h-[200px] items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Users className="mx-auto h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">No hay miembros en este partner</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Permissions Dialog */}
          <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  Permisos de {permMember ? displayName(permMember.users.name) : ""}
                </DialogTitle>
                <DialogDescription>
                  Personaliza que puede hacer este usuario en {partner.name}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4 max-h-[400px] overflow-y-auto">
                {permLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Cargando permisos...
                  </p>
                ) : (
                  ALL_PERMISSIONS.map((perm) => {
                    const isSuper = permMember?.role === "super_admin";
                    return (
                      <label
                        key={perm.key}
                        className={`flex items-start gap-3 rounded-lg p-3 cursor-pointer transition-colors ${
                          permValues[perm.key]
                            ? "bg-primary/5"
                            : "bg-muted/30"
                        } ${isSuper ? "opacity-50 pointer-events-none" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={permValues[perm.key] ?? false}
                          onChange={(e) =>
                            setPermValues((prev) => ({
                              ...prev,
                              [perm.key]: e.target.checked,
                            }))
                          }
                          disabled={isSuper}
                          className="mt-1 h-4 w-4 rounded border-gray-300"
                        />
                        <div>
                          <p className="text-sm font-medium">{perm.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {perm.description}
                          </p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetPermissions}
                  disabled={saving}
                  className="sm:mr-auto"
                >
                  Restaurar defaults
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPermDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSavePermissions} disabled={saving || permLoading}>
                  {saving ? "Guardando..." : "Guardar Permisos"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {activeTab === "products" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {products.length} producto{products.length !== 1 ? "s" : ""}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push("/products")}
            >
              Ir a Productos
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            {products.map((product) => (
              <Card
                key={product.id}
                data-animate-card
                className="border-0 shadow-sm"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{product.name}</h4>
                      <Badge
                        variant={product.is_active ? "success" : "secondary"}
                        className="text-[10px]"
                      >
                        {product.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {product.product_types?.name ?? "Sin tipo"}
                    </Badge>
                  </div>
                  {product.description && (
                    <p className="text-xs text-muted-foreground mb-2">
                      {product.description}
                    </p>
                  )}
                  {product.product_distributions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {product.product_distributions.map((dist) => (
                        <span
                          key={dist.id}
                          className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px]"
                        >
                          {dist.users?.name ?? "?"} ·{" "}
                          {formatPercentage(Number(dist.percentage_share))}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {products.length === 0 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="flex h-[200px] items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Package className="mx-auto h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">No hay productos para este partner</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === "taxes" && (
        <div className="space-y-4">
          {/* Warning banner */}
          <Card className="border-0 shadow-sm bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Importante sobre los cambios de impuestos
                </p>
                <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                  Los cambios en impuestos solo aplicaran a reportes futuros. Los reportes
                  ya generados y bloqueados no se veran afectados por estas modificaciones.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Header + add button */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {taxes.length} impuesto{taxes.length !== 1 ? "s" : ""} · El orden
                determina la cascada de aplicacion.
              </p>
            </div>
            <Dialog open={taxDialogOpen} onOpenChange={setTaxDialogOpen}>
              <Button
                size="sm"
                onClick={() => {
                  setEditingTax(null);
                  setTaxDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Impuesto
              </Button>

              <DialogContent>
                <form onSubmit={handleTaxSubmit}>
                  <DialogHeader>
                    <DialogTitle>
                      {editingTax ? "Editar Impuesto" : "Nuevo Impuesto"}
                    </DialogTitle>
                    <DialogDescription>
                      Los impuestos se aplican en cascada: cada uno se calcula
                      sobre el monto restante del anterior.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="taxName">Nombre</Label>
                      <Input
                        id="taxName"
                        name="name"
                        placeholder="Ej: Envio EEUU, Regimen Mexico"
                        defaultValue={editingTax?.name ?? ""}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="taxRate">Tasa (%)</Label>
                      <Input
                        id="taxRate"
                        name="percentageRate"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="Ej: 10, 2.5"
                        defaultValue={editingTax?.percentage_rate ?? ""}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="taxDesc">Descripcion (opcional)</Label>
                      <Input
                        id="taxDesc"
                        name="description"
                        placeholder="Descripcion breve"
                        defaultValue={editingTax?.description ?? ""}
                      />
                    </div>

                    {/* Inline warning */}
                    <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                      <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        {editingTax
                          ? "Al editar este impuesto, los reportes anteriores no se modificaran."
                          : "El nuevo impuesto se agregara al final de la cascada. Puedes reordenarlo despues."}
                      </p>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setTaxDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving
                        ? "Guardando..."
                        : editingTax
                        ? "Guardar Cambios"
                        : "Crear Impuesto"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Cascade preview */}
          {cascadePreview.length > 0 && (
            <Card data-animate-card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Vista Previa en Cascada
                </CardTitle>
                <CardDescription>
                  Simulacion de impuestos sobre un ingreso de $100 USD
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 flex-wrap text-sm mb-3">
                  <Badge variant="outline" className="text-base px-3 py-1">
                    $100.00
                  </Badge>
                  {cascadePreview.map((step, i) => (
                    <div key={step.id} className="flex items-center gap-2">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        -{formatPercentage(Number(step.percentage_rate))}
                      </span>
                      <span className="text-xs text-red-500">
                        (-${step.deducted.toFixed(2)})
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      <Badge
                        variant={
                          i === cascadePreview.length - 1 ? "default" : "outline"
                        }
                        className="px-3 py-1"
                      >
                        ${step.remaining.toFixed(2)}
                      </Badge>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Resultado final: el colaborador recibe{" "}
                  <span className="font-medium text-foreground">
                    ${cascadePreview[cascadePreview.length - 1]?.remaining.toFixed(2) ?? "100.00"}
                  </span>{" "}
                  de cada $100 USD brutos.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Tax list with full controls */}
          <div className="space-y-2">
            {taxes.map((tax, index) => (
              <Card
                key={tax.id}
                data-animate-card
                className="border-0 shadow-sm"
              >
                <CardContent className="flex items-center gap-3 p-4">
                  {/* Reorder */}
                  <div className="flex flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === 0}
                      onClick={() => handleMoveTax(index, "up")}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === taxes.length - 1}
                      onClick={() => handleMoveTax(index, "down")}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Order number */}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {index + 1}
                  </span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{tax.name}</p>
                      {!tax.is_active && (
                        <Badge variant="secondary" className="text-[10px]">
                          Inactivo
                        </Badge>
                      )}
                    </div>
                    {tax.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {tax.description}
                      </p>
                    )}
                  </div>

                  {/* Rate */}
                  <Badge variant="outline" className="text-sm font-mono px-3 shrink-0">
                    {formatPercentage(Number(tax.percentage_rate))}
                  </Badge>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingTax(tax);
                        setTaxDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleToggleTax(tax)}
                    >
                      {tax.is_active ? (
                        <ToggleRight className="h-4 w-4 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteTax(tax)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {taxes.length === 0 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="flex h-[200px] items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Receipt className="mx-auto h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm font-medium">
                      No hay impuestos configurados
                    </p>
                    <p className="text-xs mt-1">
                      Agrega impuestos como "Envio EEUU 10%" o "Regimen Mexico 2.5%".
                    </p>
                    <Button
                      className="mt-3"
                      size="sm"
                      onClick={() => {
                        setEditingTax(null);
                        setTaxDialogOpen(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Crear Impuesto
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === "activity" && (
        <div className="space-y-4">
          {/* Totals summary */}
          {recentReports.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card data-animate-card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground mb-1">
                    Total Acumulado USD
                  </p>
                  <p className="text-2xl font-bold">
                    {formatUSD(totals.totalUsd)}
                  </p>
                </CardContent>
              </Card>
              <Card data-animate-card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground mb-1">
                    Total Acumulado MXN
                  </p>
                  <p className="text-2xl font-bold">
                    {formatMXN(totals.totalMxn)}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Reports list */}
          <Card data-animate-card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ultimos Reportes</CardTitle>
              <CardDescription>
                {recentReports.length} reporte
                {recentReports.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentReports.length > 0 ? (
                <div className="space-y-2">
                  {recentReports.map((report) => (
                    <div
                      key={report.id}
                      className="flex items-center justify-between rounded-lg p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/reports/${report.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                          {report.is_locked ? (
                            <Lock className="h-4 w-4 text-green-600" />
                          ) : (
                            <Unlock className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium capitalize">
                            {formatMonth(report.report_month)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(report.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono font-medium tabular-nums">
                          {formatUSD(Number(report.total_usd))}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono tabular-nums">
                          {formatMXN(Number(report.total_mxn))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                  <div className="text-center">
                    <FileText className="mx-auto h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">No hay reportes aun</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
