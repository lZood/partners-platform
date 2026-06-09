"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash,
  FloppyDisk,
  WarningCircle,
  CheckCircle,
  Ghost,
  User,
  UserPlus,
  Envelope,
  TrendUp,
  TrendDown,
  Calendar,
  CurrencyDollar,
  ChartBar,
  Clock,
  Users,
  Gear,
  ClockCounterClockwise,
  ChartPie,
  FileText,
  Pencil,
  Lock,
  ShieldWarning,
  Camera,
  Package,
  Pulse,
  Sparkle,
  Moon,
  Warning,
} from "@phosphor-icons/react";
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
import { saveDistributions, addCollaboratorForProduct } from "@/actions/distributions";
import {
  computeHealth,
  computeForecast,
  type ProductHealth,
  type ProductForecast,
  type HealthStatus,
} from "@/lib/analytics/product-health";
import { updateProduct, toggleProductActive, updateProductImage, updateProductLifecycle } from "@/actions/products";
import { uploadFile, getFileExtension } from "@/lib/supabase/storage";
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
    image_url: string | null;
    lifecycle_status: string;
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
  assignableUsers: AvailableUser[];
  productTypes: { id: string; name: string }[];
  analytics: ProductAnalyticsData | null;
  changelog: ProductChangelogEntry[];
  affectedReports: AffectedReportsInfo;
}

type Tab = "overview" | "distributions" | "history" | "settings";

// ── Product type colors ─────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  skinpack: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  "skin pack": "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  minigame: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  "add-on": "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  addon: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  addons: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  mapas: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  "resource pack": "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800",
  "persona items": "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
  "emotes/bailes": "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
  emotes: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
  world: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  mashup: "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300 dark:border-pink-800",
};

function getTypeBadgeClass(typeName: string): string {
  const key = typeName.toLowerCase().trim();
  return TYPE_COLORS[key] ?? "bg-gray-100 text-gray-700 border-gray-200";
}

// ── Health badge ────────────────────────────────────────────────────

const HEALTH_STYLES: Record<
  HealthStatus,
  { badge: string; icon: React.ReactNode }
> = {
  trending: {
    badge:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    icon: <TrendUp className="h-3 w-3" />,
  },
  stable: {
    badge:
      "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    icon: <Pulse className="h-3 w-3" />,
  },
  new: {
    badge:
      "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800",
    icon: <Sparkle className="h-3 w-3" />,
  },
  declining: {
    badge:
      "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
    icon: <TrendDown className="h-3 w-3" />,
  },
  at_risk: {
    badge:
      "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
    icon: <Warning className="h-3 w-3" />,
  },
  dormant: {
    badge:
      "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-800",
    icon: <Moon className="h-3 w-3" />,
  },
};

export function HealthBadge({
  health,
  compact = false,
}: {
  health: ProductHealth;
  compact?: boolean;
}) {
  const style = HEALTH_STYLES[health.status];
  return (
    <Badge
      variant="outline"
      className={cn("border gap-1", style.badge)}
      title={health.reasoning}
    >
      {style.icon}
      {compact ? health.label : `Salud: ${health.label}`}
    </Badge>
  );
}

// ── Component ───────────────────────────────────────────────────────

export function ProductDetailClient({
  product,
  availableUsers,
  assignableUsers,
  productTypes,
  analytics,
  changelog,
  affectedReports,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [saving, setSaving] = useState(false);

  const monthlySales = analytics?.monthlySales ?? [];
  const health = computeHealth(monthlySales);
  const forecast = computeForecast(monthlySales);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Vista General", icon: <ChartBar className="h-4 w-4" /> },
    { id: "distributions", label: "Distribuciones", icon: <ChartPie className="h-4 w-4" /> },
    { id: "history", label: "Historial", icon: <ClockCounterClockwise className="h-4 w-4" /> },
    { id: "settings", label: "Configuracion", icon: <Gear className="h-4 w-4" /> },
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

            {/* Product image */}
            <div className="relative group shrink-0">
              <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted flex items-center justify-center">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <label className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Camera className="h-4 w-4 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const ext = getFileExtension(file);
                    const result = await uploadFile("products", `${product.id}.${ext}`, file);
                    if ("url" in result) {
                      await updateProductImage(product.id, result.url);
                      showToast("Imagen actualizada", "success");
                      router.refresh();
                    }
                  }}
                />
              </label>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
                <Badge
                  className={cn("border", getTypeBadgeClass(product.product_types?.name ?? ""))}
                  variant="outline"
                >
                  {product.product_types?.name ?? "Sin tipo"}
                </Badge>
                <Badge variant={product.is_active ? "success" : "secondary"}>
                  {product.is_active ? "Activo" : "Inactivo"}
                </Badge>
                {product.lifecycle_status === "draft" && (
                  <Badge variant="secondary">Borrador</Badge>
                )}
                {product.lifecycle_status === "discontinued" && (
                  <Badge variant="destructive">Descontinuado</Badge>
                )}
                <HealthBadge health={health} />
              </div>
              <p className="text-muted-foreground mt-1">
                {product.partners?.name}
                {product.description && ` — ${product.description}`}
              </p>
            </div>
          </div>

          {/* Lifecycle selector */}
          <Select
            value={product.lifecycle_status ?? "active"}
            onValueChange={async (val) => {
              const result = await updateProductLifecycle(
                product.id,
                val as "draft" | "active" | "discontinued"
              );
              if (result.success) {
                showToast("Estado actualizado", "success");
                router.refresh();
              }
            }}
          >
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="discontinued">Descontinuado</SelectItem>
            </SelectContent>
          </Select>
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
        <OverviewTab
          analytics={analytics}
          product={product}
          health={health}
          forecast={forecast}
        />
      )}
      {activeTab === "distributions" && (
        <DistributionsTab
          product={product}
          availableUsers={availableUsers}
          assignableUsers={assignableUsers}
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
  health,
  forecast,
}: {
  analytics: ProductAnalyticsData | null;
  product: Props["product"];
  health: ProductHealth;
  forecast: ProductForecast;
}) {
  const metrics = analytics?.metrics;
  const monthlySales = analytics?.monthlySales ?? [];

  if (!metrics || metrics.totalMonthsActive === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ChartBar className="h-12 w-12 mb-4 opacity-40" />
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
      icon: <CurrencyDollar className="h-5 w-5" />,
      color: "text-green-600",
    },
    {
      label: "Promedio Mensual",
      value: formatUSD(metrics.averageMonthlyUsd),
      sublabel: `${metrics.totalMonthsActive} meses activo`,
      icon: <TrendUp className="h-5 w-5" />,
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
                      <TrendUp className="h-3 w-3" />
                    ) : (
                      <TrendDown className="h-3 w-3" />
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

      {/* Health + Forecast */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Pulse className="h-4 w-4" />
              Salud del producto
            </CardTitle>
            <CardDescription>
              Clasificacion automatica segun la tendencia reciente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-3">
              <HealthBadge health={health} />
            </div>
            <p className="text-sm text-muted-foreground">
              {health.reasoning}
            </p>
            {(health.momPct !== null || health.trend3moPct !== null) && (
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                {health.momPct !== null && (
                  <div className="rounded-lg border p-2.5">
                    <p className="text-muted-foreground">MoM</p>
                    <p
                      className={cn(
                        "font-semibold text-lg",
                        health.momPct >= 0 ? "text-green-600" : "text-red-600"
                      )}
                    >
                      {health.momPct >= 0 ? "+" : ""}
                      {health.momPct.toFixed(1)}%
                    </p>
                  </div>
                )}
                {health.trend3moPct !== null && (
                  <div className="rounded-lg border p-2.5">
                    <p className="text-muted-foreground">3m vs 3m previos</p>
                    <p
                      className={cn(
                        "font-semibold text-lg",
                        health.trend3moPct >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      )}
                    >
                      {health.trend3moPct >= 0 ? "+" : ""}
                      {health.trend3moPct.toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendUp className="h-4 w-4" />
              Proyeccion de ingresos
            </CardTitle>
            <CardDescription>
              {forecast.model === "decay" && forecast.decayRate !== null
                ? `Modelo de decaimiento · retencion ${(forecast.decayRate * 100).toFixed(0)}%/mes · confianza ${forecast.confidence === "high" ? "alta" : forecast.confidence === "medium" ? "media" : "baja"}`
                : forecast.model === "insufficient_data"
                ? "Sin datos suficientes para proyectar"
                : "Estimacion basada en ingresos actuales"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {forecast.model === "insufficient_data" ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sube al menos un reporte para ver la proyeccion.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="rounded-lg border p-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      3 meses
                    </p>
                    <p className="font-semibold text-base mt-1">
                      {formatUSD(forecast.next3MonthsUsd)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      6 meses
                    </p>
                    <p className="font-semibold text-base mt-1">
                      {formatUSD(forecast.next6MonthsUsd)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      12 meses
                    </p>
                    <p className="font-semibold text-base mt-1">
                      {formatUSD(forecast.next12MonthsUsd)}
                    </p>
                  </div>
                </div>
                <AreaChart
                  className="h-40"
                  data={[
                    ...monthlySales.slice(-6).map((m) => ({
                      label: m.label,
                      Historico: m.grossUsd,
                      Proyeccion: null,
                    })),
                    ...forecast.projection.map((p) => ({
                      label: p.label,
                      Historico: null,
                      Proyeccion: p.projectedUsd,
                    })),
                  ]}
                  index="label"
                  categories={["Historico", "Proyeccion"]}
                  colors={["blue", "violet"]}
                  valueFormatter={(v: number) => formatUSD(v)}
                  showLegend
                  showAnimation
                  curveType="monotone"
                  connectNulls={false}
                />
                <p className="text-[11px] text-muted-foreground mt-3">
                  Proyeccion estimada — los numeros reales pueden variar segun
                  relanzamientos, promociones y temporada.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

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
  assignableUsers,
  analytics,
  affectedReports,
}: {
  product: Props["product"];
  availableUsers: AvailableUser[];
  assignableUsers: AvailableUser[];
  analytics: ProductAnalyticsData | null;
  affectedReports: AffectedReportsInfo;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setSaving] = useState(false);

  // Local pool of users added via the dialog during this session (so we don't need a full refresh)
  const [extraUsers, setExtraUsers] = useState<AvailableUser[]>([]);

  const [distributions, setDistributions] = useState<DistEntry[]>(
    (product.product_distributions ?? []).map((d) => ({
      userId: d.user_id,
      userName: d.users?.name ?? "Desconocido",
      percentageShare: Number(d.percentage_share),
    }))
  );

  // Add-collaborator dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<
    "assign_existing" | "invite_system" | "create_virtual"
  >("invite_system");
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addExistingId, setAddExistingId] = useState<string>("");
  const [addSkipInvite, setAddSkipInvite] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  const totalPercentage = distributions.reduce(
    (sum, d) => sum + d.percentageShare,
    0
  );
  const roundedTotal = Math.round(totalPercentage * 100) / 100;
  const isValid = Math.abs(roundedTotal - 100) < 0.01;
  const remaining = Math.round((100 - roundedTotal) * 100) / 100;

  const assignedIds = new Set(distributions.map((d) => d.userId));
  const combinedPartnerUsers = [...availableUsers, ...extraUsers];
  const unassignedUsers = combinedPartnerUsers.filter(
    (u) => !assignedIds.has(u.id)
  );
  const assignableOutsideUsers = assignableUsers.filter(
    (u) => !extraUsers.some((e) => e.id === u.id)
  );

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

  const resetAddForm = () => {
    setAddName("");
    setAddEmail("");
    setAddExistingId("");
    setAddSkipInvite(false);
  };

  const handleAddCollaborator = async () => {
    setAddLoading(true);
    const result = await addCollaboratorForProduct({
      mode: addMode,
      partnerId: product.partner_id,
      role: "collaborator",
      userId: addMode === "assign_existing" ? addExistingId : undefined,
      name:
        addMode === "create_virtual" || addMode === "invite_system"
          ? addName
          : undefined,
      email:
        addMode === "invite_system" || addMode === "create_virtual"
          ? addEmail
          : undefined,
      skipInvite: addMode === "invite_system" ? addSkipInvite : undefined,
    });
    setAddLoading(false);

    if (!result.success || !result.data) {
      showToast(result.error ?? "Error al agregar colaborador", "error");
      return;
    }

    const newUser: AvailableUser = {
      id: result.data.id,
      name: result.data.name,
      email: result.data.email ?? null,
      user_type: result.data.user_type,
    };

    setExtraUsers((prev) => [...prev, newUser]);
    setDistributions((prev) => [
      ...prev,
      {
        userId: newUser.id,
        userName: newUser.name,
        percentageShare: remaining > 0 ? Math.min(remaining, 100) : 0,
      },
    ]);

    if (result.data.emailWarning) {
      showToast(
        `Colaborador creado, pero no se pudo enviar el email: ${result.data.emailWarning}`,
        "error"
      );
    } else {
      showToast("Colaborador agregado a la distribucion", "success");
    }

    resetAddForm();
    setAddOpen(false);
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
        <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4">
          <div className="flex gap-3">
            <ShieldWarning className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
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
                <div className="mt-2 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3">
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
                    <WarningCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
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
              <FloppyDisk className="mr-2 h-4 w-4" />
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
                ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
                : "border-amber-200 bg-amber-50"
            )}
          >
            {isValid ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <WarningCircle
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
                const userInfo = combinedPartnerUsers.find(
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
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add user */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">
                Agregar colaborador
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddOpen(true)}
              >
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                Nuevo colaborador
              </Button>
            </div>

            {unassignedUsers.length > 0 ? (
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
            ) : (
              <p className="text-xs text-muted-foreground">
                {distributions.length === 0
                  ? "Este partner no tiene colaboradores. Agrega uno nuevo o asigna un usuario existente."
                  : "Todos los colaboradores del partner ya estan en la distribucion."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add collaborator dialog */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) resetAddForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar colaborador a la distribucion</DialogTitle>
            <DialogDescription>
              Crea un perfil virtual, invita a un usuario por email, o asigna un
              usuario existente a este partner.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Mode picker */}
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  value: "invite_system" as const,
                  label: "Invitar",
                  icon: <Envelope className="h-4 w-4" />,
                },
                {
                  value: "create_virtual" as const,
                  label: "Perfil virtual",
                  icon: <Ghost className="h-4 w-4" />,
                },
                {
                  value: "assign_existing" as const,
                  label: "Existente",
                  icon: <User className="h-4 w-4" />,
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAddMode(opt.value)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-medium transition-colors",
                    addMode === opt.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-muted-foreground/40"
                  )}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>

            {addMode === "invite_system" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="add-name">Nombre</Label>
                  <Input
                    id="add-name"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="Nombre completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-email">Email</Label>
                  <Input
                    id="add-email"
                    type="email"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="email@ejemplo.com"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={addSkipInvite}
                    onChange={(e) => setAddSkipInvite(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  No enviar email de invitacion por ahora
                </label>
                <p className="text-xs text-muted-foreground">
                  Se creara un usuario del sistema y se enviara un enlace para
                  establecer su contrasena.
                </p>
              </div>
            )}

            {addMode === "create_virtual" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="add-name-virtual">Nombre</Label>
                  <Input
                    id="add-name-virtual"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="Nombre del colaborador"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-email-virtual">
                    Email (opcional)
                  </Label>
                  <Input
                    id="add-email-virtual"
                    type="email"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="Solo para contacto, sin acceso al sistema"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Los perfiles virtuales solo se usan para contabilidad. No
                  pueden iniciar sesion.
                </p>
              </div>
            )}

            {addMode === "assign_existing" && (
              <div className="space-y-2">
                <Label>Usuario</Label>
                {assignableOutsideUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    No hay otros usuarios disponibles para asignar.
                  </p>
                ) : (
                  <Select
                    value={addExistingId || undefined}
                    onValueChange={setAddExistingId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un usuario..." />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableOutsideUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                          {u.email ? ` — ${u.email}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">
                  El usuario sera asignado al partner{" "}
                  <span className="font-medium">
                    {product.partners?.name}
                  </span>{" "}
                  y agregado a la distribucion.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                addLoading ||
                (addMode === "invite_system" &&
                  (!addName.trim() || !addEmail.trim())) ||
                (addMode === "create_virtual" && !addName.trim()) ||
                (addMode === "assign_existing" && !addExistingId)
              }
              onClick={handleAddCollaborator}
            >
              {addLoading ? "Agregando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Revenue Comparison Chart ────────────────────────────────────────

type ChartCurrency = "USD" | "MXN";
type ChartPeriod = "month" | "year";

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border bg-muted/40 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function RevenueComparisonChart({
  monthlySales,
}: {
  monthlySales: ProductAnalyticsData["monthlySales"];
}) {
  const [currency, setCurrency] = useState<ChartCurrency>("USD");
  const [period, setPeriod] = useState<ChartPeriod>("month");

  // Solo ofrecemos vista anual cuando el historial abarca varios anos.
  const distinctYears = new Set(monthlySales.map((m) => m.month.slice(0, 4)));
  const canGroupByYear = distinctYears.size > 1;
  const effectivePeriod: ChartPeriod = canGroupByYear ? period : "month";

  const fmt = currency === "USD" ? formatUSD : formatMXN;
  const grossKey = currency === "USD" ? "grossUsd" : "grossMxn";
  const netKey = currency === "USD" ? "finalUsd" : "finalMxn";

  // Construye los datos del grafico con etiquetas en espanol y, si aplica,
  // agregando por ano.
  let chartData: { label: string; Bruto: number; Neto: number }[];
  if (effectivePeriod === "year") {
    const byYear = new Map<string, { Bruto: number; Neto: number }>();
    for (const m of monthlySales) {
      const year = m.month.slice(0, 4);
      const e = byYear.get(year) ?? { Bruto: 0, Neto: 0 };
      e.Bruto += (m as any)[grossKey] ?? 0;
      e.Neto += (m as any)[netKey] ?? 0;
      byYear.set(year, e);
    }
    chartData = Array.from(byYear.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, e]) => ({
        label: year,
        Bruto: Math.round(e.Bruto * 100) / 100,
        Neto: Math.round(e.Neto * 100) / 100,
      }));
  } else {
    chartData = monthlySales.map((m) => ({
      label: m.label,
      Bruto: (m as any)[grossKey] ?? 0,
      Neto: (m as any)[netKey] ?? 0,
    }));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Comparativa de Ingresos</CardTitle>
            <CardDescription>
              Bruto vs Neto en {currency === "USD" ? "dolares" : "pesos"}{" "}
              {effectivePeriod === "year" ? "por ano" : "por mes"}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              value={currency}
              onChange={setCurrency}
              options={[
                { value: "USD", label: "USD" },
                { value: "MXN", label: "MXN" },
              ]}
            />
            {canGroupByYear && (
              <SegmentedControl
                value={period}
                onChange={setPeriod}
                options={[
                  { value: "month", label: "Mensual" },
                  { value: "year", label: "Anual" },
                ]}
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <BarChart
          className="h-72"
          data={chartData}
          index="label"
          categories={["Bruto", "Neto"]}
          colors={["blue", "emerald"]}
          valueFormatter={(v: number) => fmt(v)}
          showLegend
          showAnimation
          yAxisWidth={72}
        />
      </CardContent>
    </Card>
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
                                <TrendUp className="h-3 w-3" />
                              ) : (
                                <TrendDown className="h-3 w-3" />
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
        <RevenueComparisonChart monthlySales={monthlySales} />
      )}

      {/* Changelog */}
      {changelog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClockCounterClockwise className="h-5 w-5" />
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
  const [selectedProductTypeId, setSelectedProductTypeId] = useState(product.product_type_id);

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
              <input type="hidden" name="productTypeId" value={selectedProductTypeId} />
              <Select value={selectedProductTypeId || undefined} onValueChange={setSelectedProductTypeId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {productTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <FloppyDisk className="mr-2 h-4 w-4" />
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
