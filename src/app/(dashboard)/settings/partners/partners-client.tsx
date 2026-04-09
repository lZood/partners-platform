"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  Pencil,
  ToggleLeft,
  ToggleRight,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createPartner,
  updatePartner,
  togglePartnerActive,
} from "@/actions/partners";
import { useToast } from "@/components/shared/toast-provider";

interface Partner {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Props {
  initialPartners: Partner[];
}

export function PartnersClient({ initialPartners }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(false);

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

  const handleToggleActive = async (partner: Partner) => {
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

  const openEdit = (partner: Partner) => {
    setEditingPartner(partner);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingPartner(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Partners</h1>
          <p className="text-muted-foreground">
            Gestiona las entidades/socios principales del sistema.
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
        <Card>
          <CardContent className="pt-6">
            <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
              <div className="text-center">
                <Building2 className="mx-auto h-10 w-10 mb-3" />
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
        <Card>
          <CardHeader>
            <CardTitle>Partners Registrados</CardTitle>
            <CardDescription>
              {initialPartners.length} partner
              {initialPartners.length !== 1 ? "s" : ""} en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">
                      Nombre
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      Descripcion
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      Estado
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {initialPartners.map((partner) => (
                    <tr
                      key={partner.id}
                      className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3 font-medium">{partner.name}</td>
                      <td className="py-3 text-muted-foreground">
                        {partner.description || "—"}
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={partner.is_active ? "success" : "secondary"}
                        >
                          {partner.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(partner)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(partner)}
                            title={
                              partner.is_active ? "Desactivar" : "Activar"
                            }
                          >
                            {partner.is_active ? (
                              <ToggleRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
