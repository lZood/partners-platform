"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Package,
  Plus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  CheckCircle2,
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
import { createProduct, updateProduct, toggleProductActive } from "@/actions/products";
import { useToast } from "@/components/shared/toast-provider";
import { formatPercentage } from "@/lib/utils";

interface Props {
  initialProducts: any[];
  productTypes: { id: string; name: string }[];
  partners: { id: string; name: string }[];
}

export function ProductsClient({ initialProducts, productTypes, partners }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    let result;

    if (editingProduct) {
      result = await updateProduct(editingProduct.id, formData);
    } else {
      result = await createProduct(formData);
    }

    setLoading(false);

    if (result.success) {
      showToast(
        editingProduct
          ? `Producto "${formData.get("name")}" actualizado`
          : `Producto "${formData.get("name")}" creado`,
        "success"
      );
      setDialogOpen(false);
      setEditingProduct(null);
      router.refresh();
    } else {
      showToast(result.error ?? "Error desconocido", "error");
    }
  };

  const handleToggleActive = async (product: any) => {
    const result = await toggleProductActive(product.id, !product.is_active);
    if (result.success) {
      showToast(
        product.is_active ? `"${product.name}" desactivado` : `"${product.name}" activado`,
        "success"
      );
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const openEdit = (product: any) => {
    setEditingProduct(product);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingProduct(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Productos</h1>
          <p className="text-muted-foreground">
            Gestiona los productos digitales y sus distribuciones de ganancias.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Producto
          </Button>

          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? "Editar Producto" : "Nuevo Producto"}
                </DialogTitle>
                <DialogDescription>
                  {editingProduct
                    ? "Modifica los datos del producto."
                    : "Crea un nuevo producto digital. Luego podras configurar su distribucion."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del producto</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Ej: Golden Hour, Night Rider Pack"
                    defaultValue={editingProduct?.name ?? ""}
                    required
                  />
                </div>

                {!editingProduct && (
                  <div className="space-y-2">
                    <Label>Partner</Label>
                    <select
                      name="partnerId"
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Seleccionar Partner</option>
                      {partners.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Tipo de producto</Label>
                  <select
                    name="productTypeId"
                    required
                    defaultValue={editingProduct?.product_type_id ?? ""}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Seleccionar tipo</option>
                    {productTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripcion (opcional)</Label>
                  <Input
                    id="description"
                    name="description"
                    placeholder="Descripcion breve"
                    defaultValue={editingProduct?.description ?? ""}
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
                  {loading ? "Guardando..." : editingProduct ? "Guardar Cambios" : "Crear Producto"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {initialProducts.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
              <div className="text-center">
                <Package className="mx-auto h-10 w-10 mb-3" />
                <p className="font-medium">No hay productos registrados</p>
                <p className="text-sm mt-1">
                  Crea un producto o sube un CSV para que se registren automaticamente.
                </p>
                <Button className="mt-4" onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Producto
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Productos Registrados</CardTitle>
            <CardDescription>
              {initialProducts.length} producto{initialProducts.length !== 1 ? "s" : ""}.
              Haz clic en "Ver" para configurar la distribucion de ganancias.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">Producto</th>
                    <th className="pb-3 font-medium text-muted-foreground">Partner</th>
                    <th className="pb-3 font-medium text-muted-foreground">Tipo</th>
                    <th className="pb-3 font-medium text-muted-foreground">Distribucion</th>
                    <th className="pb-3 font-medium text-muted-foreground">Estado</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {initialProducts.map((product: any) => (
                    <tr key={product.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-3 font-medium">{product.name}</td>
                      <td className="py-3 text-muted-foreground">
                        {product.partners?.name ?? "—"}
                      </td>
                      <td className="py-3">
                        <Badge variant="outline">
                          {product.product_types?.name ?? "—"}
                        </Badge>
                      </td>
                      <td className="py-3">
                        {product.product_distributions?.length > 0 ? (
                          <div className="flex items-center gap-2">
                            {product.isDistributionValid ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span
                              className={
                                product.isDistributionValid
                                  ? "text-green-700"
                                  : "text-red-600 font-medium"
                              }
                            >
                              {formatPercentage(product.totalPercentage)}
                            </span>
                            <span className="text-muted-foreground">
                              ({product.product_distributions.length} usuario
                              {product.product_distributions.length !== 1 ? "s" : ""})
                            </span>
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600">
                            <AlertCircle className="h-4 w-4" />
                            Sin configurar
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        <Badge variant={product.is_active ? "success" : "secondary"}>
                          {product.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/products/${product.id}`}>
                            <Button variant="ghost" size="icon" title="Ver distribucion">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(product)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(product)}
                            title={product.is_active ? "Desactivar" : "Activar"}
                          >
                            {product.is_active ? (
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
