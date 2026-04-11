"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import gsap from "gsap";
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
  Settings2,
  Columns,
  ChevronUp,
  ChevronDown,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createProduct,
  updateProduct,
  toggleProductActive,
} from "@/actions/products";
import { useToast } from "@/components/shared/toast-provider";
import { cn, formatPercentage, formatUSD, displayName } from "@/lib/utils";
import type { ProductRevenueSummary } from "@/actions/product-analytics";

// ── Type badge colors ───────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  skinpack: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  "skin pack": "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  minigame: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  "add-on": "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  addon: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  world: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  mashup: "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300 dark:border-pink-800",
};

function getTypeBadgeClass(typeName: string): string {
  return TYPE_COLORS[typeName.toLowerCase().trim()] ?? "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300";
}

// ── Lifecycle badge ────────────────────────────────────────────────
const LIFECYCLE_LABELS: Record<string, { label: string; variant: "secondary" | "success" | "destructive" }> = {
  draft: { label: "Borrador", variant: "secondary" },
  active: { label: "Activo", variant: "success" },
  discontinued: { label: "Descontinuado", variant: "destructive" },
};

// ── Mini sparkline component ────────────────────────────────────────

function MiniSparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0 || data.every((v) => v === 0)) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const max = Math.max(...data, 0.01);
  const width = 60;
  const height = 20;
  const stepX = (width - 2) / (data.length - 1 || 1);
  const points = data.map((v, i) => `${1 + i * stepX},${height - 1 - ((v / max) * (height - 2))}`).join(" ");
  const hasGrowth = data[data.length - 1] >= data[data.length - 2];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" stroke={hasGrowth ? "#22c55e" : "#ef4444"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Column definitions ──────────────────────────────────────────────

interface ColumnDef {
  key: string;
  label: string;
  adminOnly: boolean;
  defaultVisible: boolean;
  fixed?: boolean; // can't be hidden
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Producto", adminOnly: false, defaultVisible: true, fixed: true },
  { key: "type", label: "Tipo", adminOnly: false, defaultVisible: true },
  { key: "revenue", label: "Ingreso Total", adminOnly: true, defaultVisible: true },
  { key: "trend", label: "Tendencia", adminOnly: true, defaultVisible: true },
  { key: "distribution", label: "Distribucion", adminOnly: true, defaultVisible: true },
  { key: "lifecycle", label: "Lifecycle", adminOnly: true, defaultVisible: false },
  { key: "status", label: "Estado", adminOnly: true, defaultVisible: true },
  { key: "partner", label: "Partner", adminOnly: false, defaultVisible: false },
  { key: "actions", label: "Acciones", adminOnly: true, defaultVisible: true },
];

const COLLABORATOR_COLUMNS = ["name", "type", "myShare", "myEarnings"];

// ── Interfaces ──────────────────────────────────────────────────────

interface Props {
  initialProducts: any[];
  productTypes: { id: string; name: string }[];
  partners: { id: string; name: string }[];
  revenueSummaries: Record<string, ProductRevenueSummary>;
  userRole: string;
  userId: string;
}

type SortField = "name" | "type" | "revenue" | "distribution" | "status";
type SortDir = "asc" | "desc";

// ── Component ───────────────────────────────────────────────────────

export function ProductsClient({
  initialProducts,
  productTypes,
  partners,
  revenueSummaries,
  userRole,
  userId,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [formPartnerId, setFormPartnerId] = useState("");
  const [formTypeId, setFormTypeId] = useState("");

  // Search & filters
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterDistribution, setFilterDistribution] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const isAdmin = userRole === "super_admin" || userRole === "admin";

  // Column visibility (persisted in localStorage, hydration-safe)
  const defaultCols = new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key));
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(defaultCols);
  const [columnsLoaded, setColumnsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("products-columns");
      if (saved) setVisibleColumns(new Set(JSON.parse(saved)));
    } catch {}
    setColumnsLoaded(true);
  }, []);

  useEffect(() => {
    if (!columnsLoaded) return;
    try {
      localStorage.setItem("products-columns", JSON.stringify([...visibleColumns]));
    } catch {}
  }, [visibleColumns, columnsLoaded]);

  const toggleColumn = (key: string) => {
    const next = new Set(visibleColumns);
    next.has(key) ? next.delete(key) : next.add(key);
    setVisibleColumns(next);
  };

  const availableColumns = isAdmin
    ? ALL_COLUMNS
    : ALL_COLUMNS.filter((c) => !c.adminOnly);

  const hasFilters = search || filterType || filterStatus || filterDistribution;

  // Filtered & sorted products
  const filtered = useMemo(() => {
    let list = [...initialProducts];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.partners?.name ?? "").toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
      );
    }
    if (filterType) list = list.filter((p) => p.product_type_id === filterType);
    if (filterStatus === "active") list = list.filter((p) => p.is_active);
    if (filterStatus === "inactive") list = list.filter((p) => !p.is_active);
    if (filterStatus === "draft") list = list.filter((p) => p.lifecycle_status === "draft");
    if (filterStatus === "discontinued") list = list.filter((p) => p.lifecycle_status === "discontinued");
    if (filterDistribution === "configured") list = list.filter((p) => p.isDistributionValid);
    if (filterDistribution === "incomplete") list = list.filter((p) => !p.isDistributionValid && p.product_distributions?.length > 0);
    if (filterDistribution === "none") list = list.filter((p) => !p.product_distributions?.length);

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "type": cmp = (a.product_types?.name ?? "").localeCompare(b.product_types?.name ?? ""); break;
        case "revenue": cmp = (revenueSummaries[a.id]?.totalGrossUsd ?? 0) - (revenueSummaries[b.id]?.totalGrossUsd ?? 0); break;
        case "distribution": cmp = a.totalPercentage - b.totalPercentage; break;
        case "status": cmp = (a.is_active ? 1 : 0) - (b.is_active ? 1 : 0); break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [initialProducts, search, filterType, filterStatus, filterDistribution, sortField, sortDir, revenueSummaries]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir(field === "revenue" ? "desc" : "asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const clearFilters = () => { setSearch(""); setFilterType(""); setFilterStatus(""); setFilterDistribution(""); };

  const totalRevenue = Object.values(revenueSummaries).reduce((sum, r) => sum + (r?.totalGrossUsd ?? 0), 0);
  const configuredCount = initialProducts.filter((p: any) => p.isDistributionValid).length;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = editingProduct
      ? await updateProduct(editingProduct.id, formData)
      : await createProduct(formData);
    setLoading(false);
    if (result.success) {
      showToast(editingProduct ? `Producto actualizado` : `Producto creado`, "success");
      setDialogOpen(false);
      setEditingProduct(null);
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleToggleActive = async (product: any) => {
    const result = await toggleProductActive(product.id, !product.is_active);
    if (result.success) {
      showToast(product.is_active ? `"${product.name}" desactivado` : `"${product.name}" activado`, "success");
      router.refresh();
    }
  };

  // Helper to get collaborator's share in a product
  const getMyShare = (product: any) => {
    const dist = (product.product_distributions ?? []).find((d: any) => d.user_id === userId);
    return dist ? Number(dist.percentage_share) : 0;
  };

  const isColVisible = (key: string) => visibleColumns.has(key);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isAdmin ? "Productos" : "Mis Productos"}
          </h1>
          <p className="text-muted-foreground">
            {isAdmin
              ? "Gestiona los productos digitales y sus distribuciones."
              : "Productos donde tienes distribucion asignada."}
          </p>
        </div>

        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <Button onClick={() => { setEditingProduct(null); setFormPartnerId(""); setFormTypeId(""); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Producto
            </Button>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingProduct ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
                  <DialogDescription>
                    {editingProduct ? "Modifica los datos del producto." : "Crea un nuevo producto digital."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre</Label>
                    <Input id="name" name="name" placeholder="Ej: Golden Hour" defaultValue={editingProduct?.name ?? ""} required />
                  </div>
                  {!editingProduct && (
                    <div className="space-y-2">
                      <Label>Partner</Label>
                      <input type="hidden" name="partnerId" value={formPartnerId} />
                      <Select value={formPartnerId || undefined} onValueChange={setFormPartnerId}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                        <SelectContent>
                          {partners.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <input type="hidden" name="productTypeId" value={formTypeId} />
                    <Select value={formTypeId || undefined} onValueChange={setFormTypeId}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {productTypes.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="desc">Descripcion (opcional)</Label>
                    <Input id="desc" name="description" defaultValue={editingProduct?.description ?? ""} placeholder="Descripcion breve" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={loading}>{loading ? "Guardando..." : editingProduct ? "Guardar" : "Crear"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Productos</p>
            <p className="text-2xl font-bold">{initialProducts.length}</p>
          </CardContent>
        </Card>
        {isAdmin && (
          <>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Ingreso Bruto</p>
                <p className="text-2xl font-bold">{formatUSD(totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Distribucion OK</p>
                <p className="text-2xl font-bold">{configuredCount}/{initialProducts.length}</p>
              </CardContent>
            </Card>
          </>
        )}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tipos</p>
            <p className="text-2xl font-bold">{productTypes.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 w-48 h-9 bg-card border-0 shadow-sm" />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Tipo:</span>
          <Select value={filterType || "all"} onValueChange={(v) => setFilterType(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {productTypes.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Estado:</span>
          <Select value={filterStatus || "all"} onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="discontinued">Descontinuado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Dist:</span>
            <Select value={filterDistribution || "all"} onValueChange={(v) => setFilterDistribution(v === "all" ? "" : v)}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="configured">100%</SelectItem>
                <SelectItem value="incomplete">Incompleta</SelectItem>
                <SelectItem value="none">Sin config</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {isAdmin && (
          <div className="relative">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setColumnsOpen(!columnsOpen)}>
              <Columns className="h-3.5 w-3.5 mr-1.5" /> Columnas
            </Button>
                {columnsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setColumnsOpen(false)} />
                    <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border bg-card shadow-lg p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1">Columnas visibles</p>
                      {availableColumns.map((col) => (
                        <label key={col.key} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleColumns.has(col.key)}
                            onChange={() => toggleColumn(col.key)}
                            disabled={col.fixed}
                            className="h-3.5 w-3.5 rounded border-gray-300"
                          />
                          <span className={col.fixed ? "text-muted-foreground" : ""}>{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
            <X className="h-3.5 w-3.5 mr-1" /> Limpiar
          </Button>
        )}

        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} de {initialProducts.length}
        </span>
      </div>

      {/* Mobile card view */}
      <div className="space-y-2 md:hidden">
        {filtered.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex h-[200px] items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Package className="mx-auto h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">{hasFilters ? "Sin resultados" : "Sin productos"}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filtered.map((product: any) => {
            const revenue = revenueSummaries[product.id];
            const lifecycle = LIFECYCLE_LABELS[product.lifecycle_status] ?? LIFECYCLE_LABELS.active;
            return (
              <Card key={product.id} className="border-0 shadow-sm" onClick={() => router.push(`/products/${product.id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="h-10 w-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{product.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className={cn("border text-[10px]", getTypeBadgeClass(product.product_types?.name ?? ""))}>
                          {product.product_types?.name ?? "—"}
                        </Badge>
                        {product.lifecycle_status !== "active" && (
                          <Badge variant={lifecycle.variant} className="text-[10px]">{lifecycle.label}</Badge>
                        )}
                      </div>
                    </div>
                    {isAdmin && revenue && revenue.totalGrossUsd > 0 && (
                      <p className="text-sm font-mono font-medium tabular-nums shrink-0">{formatUSD(revenue.totalGrossUsd)}</p>
                    )}
                    {!isAdmin && (
                      <Badge variant="outline" className="font-mono shrink-0">{formatPercentage(getMyShare(product))}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Desktop table view */}
      <Card className="border-0 shadow-sm hidden md:block">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Package className="mx-auto h-10 w-10 mb-3 opacity-40" />
                <p className="font-medium">{hasFilters ? "Sin resultados" : "Sin productos"}</p>
                {hasFilters && (
                  <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">Limpiar filtros</Button>
                )}
                {!hasFilters && isAdmin && (
                  <Button className="mt-3" onClick={() => { setEditingProduct(null); setFormPartnerId(""); setFormTypeId(""); setDialogOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> Crear Producto
                  </Button>
                )}
              </div>
            </div>
          ) : isAdmin ? (
            /* Admin table */
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    {isColVisible("name") && (
                      <th className="p-3 font-medium text-muted-foreground">
                        <button onClick={() => toggleSort("name")} className="flex items-center gap-1">Producto <SortIcon field="name" /></button>
                      </th>
                    )}
                    {isColVisible("type") && (
                      <th className="p-3 font-medium text-muted-foreground">
                        <button onClick={() => toggleSort("type")} className="flex items-center gap-1">Tipo <SortIcon field="type" /></button>
                      </th>
                    )}
                    {isColVisible("revenue") && (
                      <th className="p-3 font-medium text-muted-foreground">
                        <button onClick={() => toggleSort("revenue")} className="flex items-center gap-1">Ingreso <SortIcon field="revenue" /></button>
                      </th>
                    )}
                    {isColVisible("trend") && <th className="p-3 font-medium text-muted-foreground">Tendencia</th>}
                    {isColVisible("distribution") && (
                      <th className="p-3 font-medium text-muted-foreground">
                        <button onClick={() => toggleSort("distribution")} className="flex items-center gap-1">Distribucion <SortIcon field="distribution" /></button>
                      </th>
                    )}
                    {isColVisible("lifecycle") && <th className="p-3 font-medium text-muted-foreground">Lifecycle</th>}
                    {isColVisible("partner") && <th className="p-3 font-medium text-muted-foreground">Partner</th>}
                    {isColVisible("status") && (
                      <th className="p-3 font-medium text-muted-foreground">
                        <button onClick={() => toggleSort("status")} className="flex items-center gap-1">Estado <SortIcon field="status" /></button>
                      </th>
                    )}
                    {isColVisible("actions") && <th className="p-3 font-medium text-muted-foreground text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product: any) => {
                    const revenue = revenueSummaries[product.id];
                    const lifecycle = LIFECYCLE_LABELS[product.lifecycle_status] ?? LIFECYCLE_LABELS.active;
                    return (
                      <tr key={product.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        {isColVisible("name") && (
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              {product.image_url ? (
                                <img src={product.image_url} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" />
                              ) : (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <Link href={`/products/${product.id}`} className="font-medium hover:text-primary transition-colors">
                                  {product.name}
                                </Link>
                                {product.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{product.description}</p>}
                              </div>
                            </div>
                          </td>
                        )}
                        {isColVisible("type") && (
                          <td className="p-3">
                            <Badge variant="outline" className={cn("border", getTypeBadgeClass(product.product_types?.name ?? ""))}>
                              {product.product_types?.name ?? "—"}
                            </Badge>
                          </td>
                        )}
                        {isColVisible("revenue") && (
                          <td className="p-3">
                            {revenue && revenue.totalGrossUsd > 0 ? (
                              <div>
                                <p className="font-medium font-mono tabular-nums">{formatUSD(revenue.totalGrossUsd)}</p>
                                <p className="text-xs text-muted-foreground">{revenue.monthCount} mes{revenue.monthCount !== 1 ? "es" : ""}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sin ventas</span>
                            )}
                          </td>
                        )}
                        {isColVisible("trend") && (
                          <td className="p-3">{revenue ? <MiniSparkline data={revenue.trend} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                        )}
                        {isColVisible("distribution") && (
                          <td className="p-3">
                            {product.isDistributionValid ? (
                              <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> 100%</span>
                            ) : product.product_distributions?.length > 0 ? (
                              <span className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-3.5 w-3.5" /> {product.totalPercentage}%</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sin configurar</span>
                            )}
                          </td>
                        )}
                        {isColVisible("lifecycle") && (
                          <td className="p-3"><Badge variant={lifecycle.variant} className="text-[10px]">{lifecycle.label}</Badge></td>
                        )}
                        {isColVisible("partner") && (
                          <td className="p-3 text-xs text-muted-foreground">{product.partners?.name ?? "—"}</td>
                        )}
                        {isColVisible("status") && (
                          <td className="p-3">
                            <Badge variant={product.is_active ? "success" : "secondary"}>
                              {product.is_active ? "Activo" : "Inactivo"}
                            </Badge>
                          </td>
                        )}
                        {isColVisible("actions") && (
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-1">
                              <Link href={`/products/${product.id}`}>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-3.5 w-3.5" /></Button>
                              </Link>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingProduct(product); setFormTypeId(product.product_type_id ?? ""); setDialogOpen(true); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleActive(product)}>
                                {product.is_active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Collaborator table */
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-3 font-medium text-muted-foreground">Producto</th>
                    <th className="p-3 font-medium text-muted-foreground">Tipo</th>
                    <th className="p-3 font-medium text-muted-foreground">Mi %</th>
                    <th className="p-3 font-medium text-muted-foreground">Mis Ganancias</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product: any) => {
                    const myShare = getMyShare(product);
                    const revenue = revenueSummaries[product.id];
                    const myEarnings = revenue ? revenue.totalGrossUsd * (myShare / 100) : 0;
                    return (
                      <tr key={product.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => router.push(`/products/${product.id}`)}>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            {product.image_url ? (
                              <img src={product.image_url} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                                <Package className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-xs text-muted-foreground">{product.partners?.name ?? "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={cn("border", getTypeBadgeClass(product.product_types?.name ?? ""))}>
                            {product.product_types?.name ?? "—"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="font-mono">{formatPercentage(myShare)}</Badge>
                        </td>
                        <td className="p-3 font-mono tabular-nums font-medium">
                          {myEarnings > 0 ? formatUSD(myEarnings) : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
