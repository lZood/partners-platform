"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import {
  Building2,
  Plus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Users,
  Package,
  Receipt,
  FileText,
  ChevronRight,
  Eye,
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
  createPartner,
  updatePartner,
  togglePartnerActive,
} from "@/actions/partners";
import { useToast } from "@/components/shared/toast-provider";
import { formatUSD, formatMXN } from "@/lib/utils";

interface PartnerWithMetrics {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  memberCount: number;
  productCount: number;
  taxCount: number;
  reportCount: number;
}

interface Props {
  initialPartners: PartnerWithMetrics[];
}

export function PartnersClient({ initialPartners }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<PartnerWithMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll("[data-animate-card]");
    gsap.fromTo(
      cards,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.35, stagger: 0.06, ease: "power2.out" }
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    let result;

    if (editingPartner) {
      result = await updatePartner(editingPartner.id, formData);
    } else {
      result = await createPartner(formData);
    }

    setLoading(false);

    if (result.success) {
      showToast(
        editingPartner
          ? `Partner "${formData.get("name")}" actualizado`
          : `Partner "${formData.get("name")}" creado`,
        "success"
      );
      setDialogOpen(false);
      setEditingPartner(null);
      router.refresh();
    } else {
      showToast(result.error ?? "Error desconocido", "error");
    }
  };

  const handleToggleActive = async (e: React.MouseEvent, partner: PartnerWithMetrics) => {
    e.stopPropagation();
    const result = await togglePartnerActive(partner.id, !partner.is_active);
    if (result.success) {
      showToast(
        partner.is_active
          ? `"${partner.name}" desactivado`
          : `"${partner.name}" activado`,
        "success"
      );
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const openEdit = (e: React.MouseEvent, partner: PartnerWithMetrics) => {
    e.stopPropagation();
    setEditingPartner(partner);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingPartner(null);
    setDialogOpen(true);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Hoy";
    if (days === 1) return "Ayer";
    if (days < 30) return `Hace ${days} dias`;
    const months = Math.floor(days / 30);
    return `Hace ${months} mes${months > 1 ? "es" : ""}`;
  };

  return (
    <div ref={containerRef} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Partners</h1>
          <p className="text-muted-foreground">
            Gestiona las entidades y socios del sistema.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Partner
          </Button>

          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingPartner ? "Editar Partner" : "Nuevo Partner"}
                </DialogTitle>
                <DialogDescription>
                  {editingPartner
                    ? "Modifica los datos del partner."
                    : "Crea una nueva entidad/socio para el sistema."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Ej: Boxbuild, FineArts"
                    defaultValue={editingPartner?.name ?? ""}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descripcion (opcional)</Label>
                  <Input
                    id="description"
                    name="description"
                    placeholder="Descripcion breve del partner"
                    defaultValue={editingPartner?.description ?? ""}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading
                    ? "Guardando..."
                    : editingPartner
                    ? "Guardar Cambios"
                    : "Crear Partner"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {initialPartners.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed text-muted-foreground">
              <div className="text-center">
                <Building2 className="mx-auto h-10 w-10 mb-3 opacity-40" />
                <p className="font-medium">No hay partners registrados</p>
                <p className="text-sm mt-1">
                  Crea el primer partner para empezar.
                </p>
                <Button className="mt-4" onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Partner
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {initialPartners.map((partner) => (
            <Card
              key={partner.id}
              data-animate-card
              className="border-0 shadow-sm transition-card hover-lift cursor-pointer group"
              onClick={() =>
                router.push(`/settings/partners/${partner.id}`)
              }
            >
              <CardContent className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 overflow-hidden">
                      {partner.logo_url ? (
                        <img
                          src={partner.logo_url}
                          alt={partner.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Building2 className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{partner.name}</h3>
                        <span
                          className={`h-2 w-2 rounded-full ${
                            partner.is_active
                              ? "bg-green-500"
                              : "bg-gray-300"
                          }`}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {partner.description || "Sin descripcion"} · {timeAgo(partner.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => openEdit(e, partner)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => handleToggleActive(e, partner)}
                    >
                      {partner.is_active ? (
                        <ToggleRight className="h-4 w-4 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                    <Users className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-bold leading-none">
                      {partner.memberCount}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Miembros
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                    <Package className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-bold leading-none">
                      {partner.productCount}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Productos
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                    <Receipt className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-bold leading-none">
                      {partner.taxCount}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Impuestos
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                    <FileText className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-bold leading-none">
                      {partner.reportCount}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Reportes
                    </p>
                  </div>
                </div>

                {/* View detail hint */}
                <div className="flex items-center justify-end mt-3 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                  Ver detalles
                  <ChevronRight className="h-3 w-3 ml-0.5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
