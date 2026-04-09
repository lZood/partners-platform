"use client";

import { useState, useMemo } from "react";
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
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
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
  createProduct,
  updateProduct,
  toggleProductActive,
} from "@/actions/products";
import { useToast } from "@/components/shared/toast-provider";
import { cn, formatPercentage, formatUSD } from "@/lib/utils";
import type { ProductRevenueSummary } from "@/actions/product-analytics";

// ── Type badge colors ───────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  skinpack: "bg-purple-100 text-purple-700 border-purple-200",
  "skin pack": "bg-purple-100 text-purple-700 border-purple-200",
  minigame: "bg-blue-100 text-blue-700 border-blue-200",
  "add-on": "bg-green-100 text-green-700 border-green-200",
  addon: "bg-green-100 text-green-700 border-green-200",
  world: "bg-amber-100 text-amber-700 border-amber-200",
  mashup: "bg-pink-100 text-pink-700 border-pink-200",
};

function getTypeBadgeClass(typeName: string): string {
  const key = typeName.toLowerCase().trim();
  return TYPE_COLORS[key] ?? "bg-gray-100 text-gray-700 border-gray-200";
}

// ── Mini sparkline component ────────────────────────────────────────

function MiniSparkline({ data, className }: { data: number[]; className?: string }) {
  if (!data || data.length === 0 || data.every((v) => v === 0)) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const max = Math.max(...data, 0.01);
  const width = 60;
  const height = 20;
  const padding = 1;
  const stepX = (width - padding * 2) / (data.length - 1 || 1);

  const points = data
    .map((v, i) => {
      const x = padding + i * stepX;
      const y = height - padding - ((v / max) * (height - padding * 2));
      return `${x},${y}`;
    })
    .join(" ");

  const hasGrowth = data[data.length - 1] >= data[data.length - 2];

  return (
    <svg
      width={width}
      height={height}
      className={cn("inline-block", className)}
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke={hasGrowth ? "#22c55e" : "#ef4444"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Interfaces ──────────────────────────────────────────────────────

interface Props {
  initialProducts: any[];
  productTypes: { id: string; name: string }[];
  partners: { id: string; name: string }[];
  revenueSummaries: Record<string, ProductRevenueSummary>;
}

type SortField = "name" | "type" | "revenue" | "distribution" | "status";
type SortDir = "asc" | "desc";

// ── Component ───────────────────────────────────────────────────────

export function ProductsClient({
  initialProducts,
  productTypes,
  partners,
  revenueSummaries,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Search & filters
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterDistribution, setFilterDistribution] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const hasFilters = search || filterType || filterStatus || filterDistribution;

  // Filtered & sorted products
  const filtered = useMemo(() => {
    let list = [...initialProducts];

    // Search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.partners?.name ?? "").toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q)
      );
    }

    // Filter by type
    if (filterType) {
      list = list.filter((p) => p.product_type_id === filterType);
    }

    // Filter by status
    if (filterStatus === "active") list = list.filter((p) => p.is_active);
    if (filterStatus === "inactive") list = list.filter((p) => !p.is_active);

    // Filter by distribution
    if (filterDistribution === "configured") {
      list = list.filter((p) => p.isDistributionValid);
    }
    if (filterDistribution === "incomplete") {
      list = list.filter(
        (p) =>
          !p.isDistributionValid && (p.product_distributions?.length ?? 0) > 0
      );
    }
    if (filterDistribution === "none") {
      list = list.filter(
        (p) => (p.product_distributions?.length ?? 0) === 0
      );
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "type":
          cmp = (a.product_types?.name ?? "").localeCompare(
            b.product_types?.name ?? ""
          );
          break;
        case "revenue": {
          const ra = revenueSummaries[a.id]?.totalGrossUsd ?? 0;
          const rb = revenueSummaries[b.id]?.totalGrossUsd ?? 0;
          cmp = ra - rb;
          break;
        }
        case "distribution":
          cmp = (a.totalPercentage ?? 0) - (b.totalPercentage ?? 0);
          break;
        case "status":
          cmp = (a.is_active ? 1 : 0) - (b.is_active ? 1 : 0);
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return list;
  }, [
    initialProducts,
    search,
    filterType,
    filterStatus,
    filterDistribution,
    sortField,
    sortDir,
    revenueSummaries,
  ]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "revenue" ? "desc" : "asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  };

  const clearFilters = () => {
    setSearch("");
    setFilterType("");
    setFilterStatus("");
    setFilterDistribution("");
  };

  // Summary stats
  const totalRevenue = Object.values(revenueSummaries).reduce(
    (sum, r) => sum + (r?.totalGrossUsd ?? 0),
    0
  );
  const configuredCount = initialProducts.filter(
    (p: any) => p.isDistributionValid
  ).length;
  const activeCount = initialProducts.filter(
    (p: any) => p.is_active
  ).length;

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
        product.is_active
          ? `"${product.name}" desactivado`
          : `"${product.name}" activado`,
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
                  {loading
                    ? "Guardando..."
                    : editingProduct
                    ? "Guardar Cambios"
                    : "Crear Producto"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Productos</p>
            <p className="text-2xl font-bold">{initialProducts.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {activeCount} activos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Ingreso Bruto Total</p>
            <p className="text-2xl font-bold">{formatUSD(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              acumulado historico
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Distribucion OK</p>
            <p className="text-2xl font-bold">
              {configuredCount}/{initialProducts.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              suman 100%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Tipos</p>
            <p className="text-2xl font-bold">{productTypes.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              categorias configuradas
            </p>
          </CardContent>
        </Card>
      </div>

      {initialProducts.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
              <div className="text-center">
                <Package className="mx-auto h-10 w-10 mb-3" />
                <p className="font-medium">No hay productos registrados</p>
                <p className="text-sm mt-1">
                  Crea un producto o sube un CSV para que se registren
                  automaticamente.
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Productos Registrados</CardTitle>
                <CardDescription>
                  {filtered.length} de {initialProducts.length} producto
                  {initialProducts.length !== 1 ? "s" : ""}
                  {hasFilters ? " (filtrados)" : ""}
                </CardDescription>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-wrap gap-3 mt-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, partner..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Todos los tipos</option>
                {productTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
              <select
                value={filterDistribution}
                onChange={(e) => setFilterDistribution(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Distribucion: Todas</option>
                <option value="configured">100% configurada</option>
                <option value="incomplete">Incompleta</option>
                <option value="none">Sin configurar</option>
              </select>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-3 w-3" />
                  Limpiar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3">
                      <button
                        onClick={() => toggleSort("name")}
                        className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
                      >
                        Producto <SortIcon field="name" />
                      </button>
                    </th>
                    <th className="pb-3">
                      <button
                        onClick={() => toggleSort("type")}
                        className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
                      >
                        Tipo <SortIcon field="type" />
                      </button>
                    </th>
                    <th className="pb-3">
                      <button
                        onClick={() => toggleSort("revenue")}
                        className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
                      >
                        Ingreso Total <SortIcon field="revenue" />
                      </button>
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      Tendencia
                    </th>
                    <th className="pb-3">
                      <button
                        onClick={() => toggleSort("distribution")}
                        className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
                      >
                        Distribucion <SortIcon field="distribution" />
                      </button>
                    </th>
                    <th className="pb-3">
                      <button
                        onClick={() => toggleSort("status")}
                        className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
                      >
                        Estado <SortIcon field="status" />
                      </button>
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product: any) => {
                    const revenue = revenueSummaries[product.id];
                    return (
                      <tr
                        key={product.id}
                        className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-3">
                          <div>
                            <Link
                              href={`/products/${product.id}`}
                              className="font-medium hover:text-primary transition-colors"
                            >
                              {product.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {product.partners?.name ?? "—"}
                            </p>
                          </div>
                        </td>
                        <td className="py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "border",
                              getTypeBadgeClass(
                                product.product_types?.name ?? ""
                              )
                            )}
                          >
                            {product.product_types?.name ?? "—"}
                          </Badge>
                        </td>
                        <td className="py-3">
                          {revenue && revenue.totalGrossUsd > 0 ? (
                            <div>
                              <p className="font-medium">
                                {formatUSD(revenue.totalGrossUsd)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {revenue.monthCount} mes
                                {revenue.monthCount !== 1 ? "es" : ""}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              Sin ventas
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          {revenue ? (
                            <MiniSparkline data={revenue.trend} />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
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
                            </div>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-600 text-xs">
                              <AlertCircle className="h-3 w-3" />
                              Sin configurar
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              product.is_active ? "success" : "secondary"
                            }
                          >
                            {product.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/products/${product.id}`}>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Ver detalle"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(product)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleActive(product)}
                              title={
                                product.is_active ? "Desactivar" : "Activar"
                              }
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
                    );
                  })}
                </tbody>
              </table>

              {filtered.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="mx-auto h-8 w-8 mb-2 opacity-40" />
                  <p>No se encontraron productos con esos filtros.</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={clearFilters}
                    className="mt-1"
                  >
                    Limpiar filtros
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
