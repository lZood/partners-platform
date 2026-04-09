"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Receipt,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
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
  createTax,
  updateTax,
  deleteTax,
  toggleTaxActive,
  reorderTaxes,
} from "@/actions/taxes";
import { useToast } from "@/components/shared/toast-provider";
import { formatPercentage } from "@/lib/utils";

interface Tax {
  id: string;
  name: string;
  description: string | null;
  percentage_rate: number;
  priority_order: number;
  is_active: boolean;
  partner_id: string;
}

interface Props {
  initialTaxes: Tax[];
  partners: { id: string; name: string }[];
}

export function TaxesClient({ initialTaxes, partners }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<Tax | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<string>(
    partners[0]?.id ?? ""
  );

  const partnerTaxes = initialTaxes.filter(
    (t) => t.partner_id === selectedPartner
  );
  const activeTaxes = partnerTaxes.filter((t) => t.is_active);

  // Calculate cascade preview
  const cascadePreview = (() => {
    let remaining = 100;
    return activeTaxes.map((tax) => {
      const deducted = remaining * (Number(tax.percentage_rate) / 100);
      remaining = remaining - deducted;
      return {
        ...tax,
        deducted: Math.round(deducted * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
      };
    });
  })();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.set("partnerId", selectedPartner);
    let result;

    if (editingTax) {
      result = await updateTax(editingTax.id, formData);
    } else {
      result = await createTax(formData);
    }

    setLoading(false);

    if (result.success) {
      showToast(
        editingTax
          ? `Impuesto "${formData.get("name")}" actualizado`
          : `Impuesto "${formData.get("name")}" creado`,
        "success"
      );
      setDialogOpen(false);
      setEditingTax(null);
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleDelete = async (tax: Tax) => {
    if (!confirm(`Eliminar el impuesto "${tax.name}"?`)) return;

    const result = await deleteTax(tax.id);
    if (result.success) {
      showToast(`"${tax.name}" eliminado`, "success");
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleToggle = async (tax: Tax) => {
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

  const handleMove = async (index: number, direction: "up" | "down") => {
    const newTaxes = [...partnerTaxes];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newTaxes.length) return;

    [newTaxes[index], newTaxes[targetIndex]] = [
      newTaxes[targetIndex],
      newTaxes[index],
    ];

    const orderedIds = newTaxes.map((t) => t.id);
    const result = await reorderTaxes(selectedPartner, orderedIds);

    if (result.success) {
      showToast("Orden actualizado", "success");
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const openEdit = (tax: Tax) => {
    setEditingTax(tax);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingTax(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Impuestos</h1>
          <p className="text-muted-foreground">
            Configura los impuestos en cascada por partner. El orden importa.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button onClick={openCreate} disabled={!selectedPartner}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Impuesto
          </Button>

          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingTax ? "Editar Impuesto" : "Nuevo Impuesto"}
                </DialogTitle>
                <DialogDescription>
                  Los impuestos se aplican en cascada: cada uno se calcula sobre
                  el monto restante del anterior.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Ej: Envio EEUU, Regimen Mexico"
                    defaultValue={editingTax?.name ?? ""}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="percentageRate">Tasa (%)</Label>
                  <Input
                    id="percentageRate"
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
                  <Label htmlFor="description">Descripcion (opcional)</Label>
                  <Input
                    id="description"
                    name="description"
                    placeholder="Descripcion breve del impuesto"
                    defaultValue={editingTax?.description ?? ""}
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
                    : editingTax
                    ? "Guardar Cambios"
                    : "Crear Impuesto"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Partner selector */}
      {partners.length > 1 && (
        <div className="flex items-center gap-3">
          <Label className="text-muted-foreground">Partner:</Label>
          <select
            value={selectedPartner}
            onChange={(e) => setSelectedPartner(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Cascade preview */}
      {cascadePreview.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vista Previa en Cascada</CardTitle>
            <CardDescription>
              Asi se aplicarian los impuestos activos a un ingreso de $100 USD
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <Badge variant="outline" className="text-base px-3 py-1">
                $100.00
              </Badge>
              {cascadePreview.map((step, i) => (
                <div key={step.id} className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    -{formatPercentage(Number(step.percentage_rate))}
                  </span>
                  <span className="text-xs text-red-600">
                    (-${step.deducted.toFixed(2)})
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <Badge
                    variant={i === cascadePreview.length - 1 ? "default" : "outline"}
                    className="px-3 py-1"
                  >
                    ${step.remaining.toFixed(2)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tax list */}
      {partnerTaxes.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex h-[250px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
              <div className="text-center">
                <Receipt className="mx-auto h-10 w-10 mb-3" />
                <p className="font-medium">No hay impuestos configurados</p>
                <p className="text-sm mt-1">
                  Agrega impuestos como "Envio EEUU 10%" o "Regimen Mexico
                  2.5%".
                </p>
                <Button className="mt-4" onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Impuesto
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Impuestos Configurados</CardTitle>
            <CardDescription>
              Usa las flechas para cambiar el orden de aplicacion.{" "}
              {partnerTaxes.length} impuesto
              {partnerTaxes.length !== 1 ? "s" : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {partnerTaxes.map((tax, index) => (
                <div
                  key={tax.id}
                  className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  {/* Order controls */}
                  <div className="flex flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === 0}
                      onClick={() => handleMove(index, "up")}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === partnerTaxes.length - 1}
                      onClick={() => handleMove(index, "down")}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Order number */}
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                    {index + 1}
                  </div>

                  {/* Tax info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{tax.name}</p>
                      {!tax.is_active && (
                        <Badge variant="secondary">Inactivo</Badge>
                      )}
                    </div>
                    {tax.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {tax.description}
                      </p>
                    )}
                  </div>

                  {/* Rate */}
                  <Badge variant="outline" className="text-base px-3">
                    {formatPercentage(Number(tax.percentage_rate))}
                  </Badge>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(tax)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggle(tax)}
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
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(tax)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
