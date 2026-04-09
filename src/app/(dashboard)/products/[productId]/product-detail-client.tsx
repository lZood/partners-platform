"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle2,
  Ghost,
  User,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  BarChart3,
  Clock,
  Users,
  Settings,
  History,
  PieChart,
  FileText,
  Pencil,
  Lock,
  ShieldAlert,
} from "lucide-react";
import { AreaChart, BarChart } from "@tremor/react";
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
import { saveDistributions } from "@/actions/distributions";
import { updateProduct, toggleProductActive } from "@/actions/products";
import { useToast } from "@/components/shared/toast-provider";
import { cn, formatPercentage, formatUSD, formatMXN } from "@/lib/utils";
import type {
  ProductAnalyticsData,
  ProductChangelogEntry,
  AffectedReportsInfo,
} from "@/actions/product-analytics";

// ── Interfaces ──────────────────────────────────────────────────────

interface DistEntry {
  userId: string;
  userName: string;
  percentageShare: number;
}

interface AvailableUser {
  id: string;
  name: string;
  email: string | null;
  user_type: string;
}

interface Props {
  product: {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    created_at: string;
    partner_id: string;
    product_type_id: string;
    product_types: { id: string; name: string } | null;
    partners: { id: string; name: string } | null;
    product_distributions: {
      id: string;
      user_id: string;
      percentage_share: number;
      users: {
        id: string;
        name: string;
        email: string | null;
        user_type: string;
      } | null;
    }[];
  };
  availableUsers: AvailableUser[];
  productTypes: { id: string; name: string }[];
  analytics: ProductAnalyticsData | null;
  changelog: ProductChangelogEntry[];
  affectedReports: AffectedReportsInfo;
}

type Tab = "overview" | "distributions" | "history" | "settings";

// ── Product type colors ─────────────────────────────────────────────

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

// ── Component ───────────────────────────────────────────────────────

export function ProductDetailClient({
  product,
  availableUsers,
  productTypes,
  analytics,
  changelog,
  affectedReports,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [saving, setSaving] = useState(false);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Vista General", icon: <BarChart3 className="h-4 w-4" /> },
    { id: "distributions", label: "Distribuciones", icon: <PieChart className="h-4 w-4" /> },
    { id: "history", label: "Historial", icon: <History className="h-4 w-4" /> },
    { id: "settings", label: "Configuracion", icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/products" className="hover:text-foreground transition-colors">
            Productos
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{product.name}</span>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Link href="/products">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
                <Badge
                  className={cn(
                    "border",
                    getTypeBadgeClass(product.product_types?.name ?? "")
                  )}
                  variant="outline"
                >
                  {product.product_types?.name ?? "Sin tipo"}
                </Badge>
                <Badge variant={product.is_active ? "success" : "secondary"}>
                  {product.is_active ? "Activo" : "Inactivo"}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">
                {product.partners?.name}
                {product.description && ` — ${product.description}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b">
        <nav className="flex gap-1 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <OverviewTab analytics={analytics} product={product} />
      )}
      {activeTab === "distributions" && (
        <DistributionsTab
          product={product}
          availableUsers={availableUsers}
          analytics={analytics}
          affectedReports={affectedReports}
        />
      )}
      {activeTab === "history" && (
        <HistoryTab analytics={analytics} changelog={changelog} />
      )}
      {activeTab === "settings" && (
        <SettingsTab
          product={product}
          productTypes={productTypes}
        />
      )}
    </div>
  );
}

// ── Overview Tab ────────────────────────────────────────────────────

function OverviewTab({
  analytics,
  product,
}: {
  analytics: ProductAnalyticsData | null;
  product: Props["product"];
}) {
  const metrics = analytics?.metrics;
  const monthlySales = analytics?.monthlySales ?? [];

  if (!metrics || metrics.totalMonthsActive === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-4 opacity-40" />
            <p className="font-medium text-lg">Sin datos de ventas</p>
            <p className="text-sm mt-1">
              Este producto aun no aparece en ningun reporte generado.
            </p>
            <p className="text-sm mt-1">
              Sube un CSV que incluya este producto para ver sus metricas.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // MoM comparison
  const lastTwo = monthlySales.slice(-2);
  const currentMonth = lastTwo.length > 0 ? lastTwo[lastTwo.length - 1] : null;
  const prevMonth = lastTwo.length > 1 ? lastTwo[0] : null;
  const momChange =
    prevMonth && prevMonth.grossUsd > 0
      ? ((currentMonth!.grossUsd - prevMonth.grossUsd) / prevMonth.grossUsd) * 100
      : null;

  const statCards = [
    {
      label: "Ingreso Bruto Total",
      value: formatUSD(metrics.totalGrossUsd),
      sublabel: formatMXN(metrics.totalFinalMxn) + " MXN neto",
      icon: <DollarSign className="h-5 w-5" />,
      color: "text-green-600",
    },
    {
      label: "Promedio Mensual",
      value: formatUSD(metrics.averageMonthlyUsd),
      sublabel: `${metrics.totalMonthsActive} meses activo`,
      icon: <TrendingUp className="h-5 w-5" />,
      color: "text-blue-600",
    },
    {
      label: "Mes Mas Fuerte",
      value: metrics.strongestMonth?.month ?? "—",
      sublabel: metrics.strongestMonth
        ? formatUSD(metrics.strongestMonth.grossUsd)
        : "",
      icon: <Calendar className="h-5 w-5" />,
      color: "text-purple-600",
    },
    {
      label: "Primera Aparicion",
      value: metrics.firstAppearance ?? "—",
      sublabel: metrics.lastAppearance
        ? `Ultimo: ${metrics.lastAppearance}`
        : "",
      icon: <Clock className="h-5 w-5" />,
      color: "text-amber-600",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-bold mt-1">{card.value}</p>
                  {card.sublabel && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {card.sublabel}
                    </p>
                  )}
                </div>
                <div className={cn("p-2 rounded-lg bg-muted/50", card.color)}>
                  {card.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sales chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Ventas Mensuales</CardTitle>
              <CardDescription>
                Ingreso bruto USD por mes
                {momChange !== null && (
                  <span
                    className={cn(
                      "ml-2 inline-flex items-center gap-1 text-sm font-medium",
                      momChange >= 0 ? "text-green-600" : "text-red-600"
                    )}
                  >
                    {momChange >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {momChange >= 0 ? "+" : ""}
                    {momChange.toFixed(1)}% vs mes anterior
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AreaChart
            className="h-72"
            data={monthlySales}
            index="label"
            categories={["grossUsd"]}
            colors={["blue"]}
            valueFormatter={(v: number) => formatUSD(v)}
            showLegend={false}
            showAnimation
            curveType="monotone"
          />
        </CardContent>
      </Card>

      {/* Collaborator earnings summary */}
      {analytics && analytics.collaboratorShares.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Ganancias por Colaborador
            </CardTitle>
            <CardDescription>
              Distribucion acumulada historica de este producto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.collaboratorShares.map((collab) => (
                <div
                  key={collab.userId}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{collab.userName}</p>
                      <p className="text-xs text-muted-foreground">
                        {collab.percentageShare > 0
                          ? `${formatPercentage(collab.percentageShare)} del producto`
                          : "Sin distribucion actual"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatUSD(collab.totalEarnedUsd)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMXN(collab.totalEarnedMxn)}
                    </p>
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

// ── Distributions Tab ───────────────────────────────────────────────

function DistributionsTab({
  product,
  availableUsers,
  analytics,
  affectedReports,
}: {
  product: Props["product"];
  availableUsers: AvailableUser[];
  analytics: ProductAnalyticsData | null;
  affectedReports: AffectedReportsInfo;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setSaving] = useState(false);

  const [distributions, setDistributions] = useState<DistEntry[]>(
    (product.product_distributions ?? []).map((d) => ({
      userId: d.user_id,
      userName: d.users?.name ?? "Desconocido",
      percentageShare: Number(d.percentage_share),
    }))
  );

  const totalPercentage = distributions.reduce(
    (sum, d) => sum + d.percentageShare,
    0
  );
  const roundedTotal = Math.round(totalPercentage * 100) / 100;
  const isValid = Math.abs(roundedTotal - 100) < 0.01;
  const remaining = Math.round((100 - roundedTotal) * 100) / 100;

  const assignedIds = new Set(distributions.map((d) => d.userId));
  const unassignedUsers = availableUsers.filter((u) => !assignedIds.has(u.id));

  const addUser = (user: AvailableUser) => {
    setDistributions((prev) => [
      ...prev,
      {
        userId: user.id,
        userName: user.name,
        percentageShare: remaining > 0 ? Math.min(remaining, 100) : 0,
      },
    ]);
  };

  const removeUser = (userId: string) => {
    setDistributions((prev) => prev.filter((d) => d.userId !== userId));
  };

  const updatePercentage = (userId: string, value: number) => {
    setDistributions((prev) =>
      prev.map((d) =>
        d.userId === userId ? { ...d, percentageShare: value } : d
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await saveDistributions(
      product.id,
      distributions.map((d) => ({
        userId: d.userId,
        percentageShare: d.percentageShare,
      }))
    );
    setSaving(false);

    if (result.success) {
      showToast("Distribucion guardada correctamente", "success");
      router.refresh();
    } else {
      showToast(result.error ?? "Error al guardar", "error");
    }
  };

  // Format month for display
  const fmtMonth = (m: string) => {
    const d = new Date(m + "T00:00:00");
    return new Intl.DateTimeFormat("es-MX", {
      month: "long",
      year: "numeric",
    }).format(d);
  };

  const hasLockedReports = affectedReports.lockedReports.length > 0;
  const hasUnlockedReports = affectedReports.unlockedReports.length > 0;

  return (
    <div className="space-y-6">
      {/* Warning: affected reports */}
      {(hasLockedReports || hasUnlockedReports) && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-amber-800">
                Importante sobre los cambios de distribucion
              </p>
              <p className="text-sm text-amber-700">
                Los cambios en la distribucion solo se aplicaran cuando se{" "}
                <span className="font-medium">regeneren</span> los reportes
                existentes no bloqueados y en todos los reportes futuros que se
                generen.
              </p>

              {hasLockedReports && (
                <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3">
                  <div className="flex items-start gap-2">
                    <Lock className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800">
                        {affectedReports.lockedReports.length} reporte
                        {affectedReports.lockedReports.length !== 1 ? "s" : ""}{" "}
                        bloqueado{affectedReports.lockedReports.length !== 1 ? "s" : ""}{" "}
                        — NO se veran afectados
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        {affectedReports.lockedReports
                          .map((r) => fmtMonth(r.month))
                          .join(", ")}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {hasUnlockedReports && (
                <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">
                        {affectedReports.unlockedReports.length} reporte
                        {affectedReports.unlockedReports.length !== 1 ? "s" : ""}{" "}
                        sin bloquear — se actualizaran al regenerar
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        {affectedReports.unlockedReports
                          .map((r) => fmtMonth(r.month))
                          .join(", ")}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Distribucion de Ganancias</CardTitle>
              <CardDescription>
                Asigna el porcentaje de ganancias para cada colaborador. Debe
                sumar exactamente 100%.
              </CardDescription>
            </div>
            <Button onClick={handleSave} disabled={loading || !isValid}>
              <Save className="mr-2 h-4 w-4" />
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Status bar */}
          <div
            className={cn(
              "mb-6 flex items-center gap-3 rounded-lg border p-4",
              isValid
                ? "border-green-200 bg-green-50"
                : roundedTotal > 100
                ? "border-red-200 bg-red-50"
                : "border-amber-200 bg-amber-50"
            )}
          >
            {isValid ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle
                className={cn(
                  "h-5 w-5",
                  roundedTotal > 100 ? "text-red-600" : "text-amber-600"
                )}
              />
            )}
            <div className="flex-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  isValid
                    ? "text-green-800"
                    : roundedTotal > 100
                    ? "text-red-800"
                    : "text-amber-800"
                )}
              >
                {isValid
                  ? "Distribucion valida — Los porcentajes suman 100%"
                  : roundedTotal > 100
                  ? `Los porcentajes exceden el 100% (+${formatPercentage(roundedTotal - 100)})`
                  : distributions.length === 0
                  ? "Sin distribucion configurada — Agrega colaboradores"
                  : `Faltan ${formatPercentage(remaining)} para completar el 100%`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">
                {formatPercentage(roundedTotal)}
              </p>
              <p className="text-xs text-muted-foreground">de 100%</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-6 h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                isValid
                  ? "bg-green-500"
                  : roundedTotal > 100
                  ? "bg-red-500"
                  : "bg-amber-500"
              )}
              style={{ width: `${Math.min(roundedTotal, 100)}%` }}
            />
          </div>

          {/* Distribution entries */}
          {distributions.length > 0 && (
            <div className="space-y-3 mb-6">
              {distributions.map((dist) => {
                const userInfo = availableUsers.find(
                  (u) => u.id === dist.userId
                );
                // Show earned amount if analytics available
                const earned = analytics?.collaboratorShares.find(
                  (c) => c.userId === dist.userId
                );
                return (
                  <div
                    key={dist.userId}
                    className="flex items-center gap-4 rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {userInfo?.user_type === "system_user" ? (
                        <User className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <Ghost className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{dist.userName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {userInfo?.email ?? "Perfil virtual"}
                          {earned && earned.totalEarnedUsd > 0 && (
                            <span className="ml-2 text-green-600">
                              Total: {formatUSD(earned.totalEarnedUsd)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0.01"
                        max="100"
                        step="0.01"
                        value={dist.percentageShare}
                        onChange={(e) =>
                          updatePercentage(
                            dist.userId,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-24 text-right"
                      />
                      <span className="text-sm text-muted-foreground w-4">
                        %
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeUser(dist.userId)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add user */}
          {unassignedUsers.length > 0 && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">
                Agregar colaborador
              </Label>
              <div className="flex flex-wrap gap-2">
                {unassignedUsers.map((user) => (
                  <Button
                    key={user.id}
                    variant="outline"
                    size="sm"
                    onClick={() => addUser(user)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {user.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {distributions.length === 0 && unassignedUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No hay colaboradores disponibles en este partner.</p>
              <p className="text-sm mt-1">
                <Link
                  href="/collaborators"
                  className="text-primary hover:underline"
                >
                  Crea colaboradores primero
                </Link>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── History Tab ─────────────────────────────────────────────────────

function HistoryTab({
  analytics,
  changelog,
}: {
  analytics: ProductAnalyticsData | null;
  changelog: ProductChangelogEntry[];
}) {
  const monthlySales = analytics?.monthlySales ?? [];

  return (
    <div className="space-y-6">
      {/* Monthly sales table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Historial de Ventas por Mes
          </CardTitle>
          <CardDescription>
            Detalle de ingresos mensuales desde la primera aparicion
          </CardDescription>
        </CardHeader>
        <CardContent>
          {monthlySales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Sin historial de ventas disponible.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">
                      Mes
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      Bruto USD
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      Post-Impuestos USD
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      Neto USD
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      Neto MXN
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      Variacion
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...monthlySales].reverse().map((entry, index, arr) => {
                    const prevEntry = arr[index + 1];
                    const change =
                      prevEntry && prevEntry.grossUsd > 0
                        ? ((entry.grossUsd - prevEntry.grossUsd) /
                            prevEntry.grossUsd) *
                          100
                        : null;
                    return (
                      <tr
                        key={entry.month}
                        className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-3 font-medium">{entry.label}</td>
                        <td className="py-3 text-right">
                          {formatUSD(entry.grossUsd)}
                        </td>
                        <td className="py-3 text-right">
                          {formatUSD(entry.afterTaxesUsd)}
                        </td>
                        <td className="py-3 text-right">
                          {formatUSD(entry.finalUsd)}
                        </td>
                        <td className="py-3 text-right">
                          {formatMXN(entry.finalMxn)}
                        </td>
                        <td className="py-3 text-right">
                          {change !== null ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-xs font-medium",
                                change >= 0 ? "text-green-600" : "text-red-600"
                              )}
                            >
                              {change >= 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {change >= 0 ? "+" : ""}
                              {change.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              —
                            </span>
                          )}
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

      {/* Revenue chart (bar view) */}
      {monthlySales.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Comparativa Mensual</CardTitle>
            <CardDescription>
              Bruto vs Neto USD por mes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              className="h-64"
              data={monthlySales}
              index="label"
              categories={["grossUsd", "finalUsd"]}
              colors={["blue", "green"]}
              valueFormatter={(v: number) => formatUSD(v)}
              showLegend
              showAnimation
            />
          </CardContent>
        </Card>
      )}

      {/* Changelog */}
      {changelog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Log de Cambios
            </CardTitle>
            <CardDescription>
              Modificaciones registradas en la configuracion del producto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {changelog.map((entry) => {
                const actionLabels: Record<string, string> = {
                  INSERT: "Creado",
                  UPDATE: "Modificado",
                  DELETE: "Eliminado",
                };
                const tableLabels: Record<string, string> = {
                  products: "Producto",
                  product_distributions: "Distribucion",
                };
                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <div
                      className={cn(
                        "mt-0.5 h-2 w-2 rounded-full shrink-0",
                        entry.action === "INSERT"
                          ? "bg-green-500"
                          : entry.action === "UPDATE"
                          ? "bg-blue-500"
                          : "bg-red-500"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {tableLabels[entry.tableName] ?? entry.tableName}
                        </Badge>
                        <span className="text-sm font-medium">
                          {actionLabels[entry.action] ?? entry.action}
                        </span>
                        {entry.userName && (
                          <span className="text-xs text-muted-foreground">
                            por {entry.userName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(entry.changedAt).toLocaleString("es-MX", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      {/* Show changed fields */}
                      {entry.action === "UPDATE" &&
                        entry.oldValues &&
                        entry.newValues && (
                          <div className="mt-2 text-xs space-y-1">
                            {Object.keys(entry.newValues)
                              .filter(
                                (key) =>
                                  JSON.stringify(entry.oldValues![key]) !==
                                  JSON.stringify(entry.newValues![key])
                              )
                              .filter(
                                (key) =>
                                  !["updated_at", "created_at", "id"].includes(
                                    key
                                  )
                              )
                              .map((key) => (
                                <div key={key} className="flex gap-2">
                                  <span className="text-muted-foreground font-mono">
                                    {key}:
                                  </span>
                                  <span className="text-red-600 line-through">
                                    {String(entry.oldValues![key] ?? "null")}
                                  </span>
                                  <span className="text-green-600">
                                    {String(entry.newValues![key] ?? "null")}
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Settings Tab ────────────────────────────────────────────────────

function SettingsTab({
  product,
  productTypes,
}: {
  product: Props["product"];
  productTypes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await updateProduct(product.id, formData);
    setLoading(false);

    if (result.success) {
      showToast("Producto actualizado", "success");
      router.refresh();
    } else {
      showToast(result.error ?? "Error al actualizar", "error");
    }
  };

  const handleToggle = async () => {
    const result = await toggleProductActive(product.id, !product.is_active);
    if (result.success) {
      showToast(
        product.is_active ? "Producto desactivado" : "Producto activado",
        "success"
      );
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Informacion del Producto</CardTitle>
          <CardDescription>
            Modifica el nombre, tipo y descripcion del producto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                name="name"
                defaultValue={product.name}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de producto</Label>
              <select
                name="productTypeId"
                required
                defaultValue={product.product_type_id}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
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
                defaultValue={product.description ?? ""}
                placeholder="Descripcion breve del producto"
              />
            </div>

            <Button type="submit" disabled={loading}>
              <Save className="mr-2 h-4 w-4" />
              {loading ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estado del Producto</CardTitle>
          <CardDescription>
            Desactivar un producto lo oculta del sistema sin eliminarlo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">
                {product.is_active ? "Producto activo" : "Producto inactivo"}
              </p>
              <p className="text-sm text-muted-foreground">
                {product.is_active
                  ? "El producto aparece en reportes y distribuciones."
                  : "El producto esta oculto y no se incluira en nuevos reportes."}
              </p>
            </div>
            <Button
              variant={product.is_active ? "destructive" : "default"}
              onClick={handleToggle}
            >
              {product.is_active ? "Desactivar" : "Activar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">ID</p>
              <p className="font-mono text-xs">{product.id}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Partner</p>
              <p>{product.partners?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Creado</p>
              <p>
                {new Date(product.created_at).toLocaleString("es-MX", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Distribuciones</p>
              <p>
                {product.product_distributions?.length ?? 0} colaborador
                {(product.product_distributions?.length ?? 0) !== 1 ? "es" : ""}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
