"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AreaChart, BarChart, DonutChart } from "@tremor/react";
import {
  DollarSign,
  Package,
  Users,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Lock,
  Unlock,
  Eye,
  ArrowRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatUSD, formatMXN, formatMonth } from "@/lib/utils";
import type { DashboardData } from "@/actions/dashboard";

interface Props {
  data: DashboardData;
  partners: { id: string; name: string }[];
  currentPartnerId?: string;
  userRole: string;
}

export function DashboardClient({
  data,
  partners,
  currentPartnerId,
  userRole,
}: Props) {
  const router = useRouter();
  const { stats, monthlyTrends, productTypeProfitability, topProducts, recentReports } = data;

  const [selectedPartner, setSelectedPartner] = useState(currentPartnerId ?? "");

  const handlePartnerChange = (value: string) => {
    setSelectedPartner(value);
    const url = value ? `/?partner=${value}` : "/";
    router.push(url);
  };

  // MoM change calculation
  const momChange =
    stats.previousMonthUsd > 0
      ? ((stats.currentMonthUsd - stats.previousMonthUsd) / stats.previousMonthUsd) * 100
      : stats.currentMonthUsd > 0
        ? 100
        : 0;

  const MomIcon =
    momChange > 0 ? TrendingUp : momChange < 0 ? TrendingDown : Minus;
  const momColor =
    momChange > 0
      ? "text-green-600"
      : momChange < 0
        ? "text-red-600"
        : "text-muted-foreground";

  // Value formatter for Tremor charts
  const usdFormatter = (v: number) => formatUSD(v);
  const mxnFormatter = (v: number) => formatMXN(v);

  const isAdmin = userRole === "super_admin" || userRole === "admin";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Resumen de ganancias y actividad reciente.
          </p>
        </div>
        {isAdmin && partners.length > 1 && (
          <select
            value={selectedPartner}
            onChange={(e) => handlePartnerChange(e.target.value)}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos los Partners</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ganancias del Mes (USD)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUSD(stats.currentMonthUsd)}</div>
            {stats.previousMonthUsd > 0 || stats.currentMonthUsd > 0 ? (
              <p className={`text-xs flex items-center gap-1 ${momColor}`}>
                <MomIcon className="h-3 w-3" />
                {momChange > 0 ? "+" : ""}
                {momChange.toFixed(1)}% vs mes anterior
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sin datos del mes actual
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ganancias del Mes (MXN)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMXN(stats.currentMonthMxn)}</div>
            <p className="text-xs text-muted-foreground">
              Tipo de cambio del deposito bancario
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Productos Activos
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeProducts}</div>
            <p className="text-xs text-muted-foreground">
              Skinpacks, Minigames, Add-ons
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Colaboradores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCollaborators}</div>
            <p className="text-xs text-muted-foreground">
              Con distribuciones activas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencia de Ingresos</CardTitle>
            <CardDescription>
              Ingresos mensuales brutos (ultimos 12 meses)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyTrends.length > 0 ? (
              <AreaChart
                className="h-72"
                data={monthlyTrends}
                index="label"
                categories={["totalUsd", "totalMxn"]}
                colors={["blue", "emerald"]}
                valueFormatter={usdFormatter}
                yAxisWidth={80}
                showLegend={true}
                curveType="monotone"
                customTooltip={({ payload, active }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0]?.payload;
                  return (
                    <div className="rounded-md border bg-white p-3 shadow-md text-sm">
                      <p className="font-medium mb-1">{item?.label}</p>
                      <p className="text-blue-600">
                        USD: {formatUSD(item?.totalUsd ?? 0)}
                      </p>
                      <p className="text-emerald-600">
                        MXN: {formatMXN(item?.totalMxn ?? 0)}
                      </p>
                    </div>
                  );
                }}
              />
            ) : (
              <div className="flex h-72 items-center justify-center rounded-md border border-dashed text-muted-foreground">
                <div className="text-center">
                  <TrendingUp className="mx-auto h-8 w-8 mb-2" />
                  <p>Sin datos de tendencia aun.</p>
                  <p className="text-xs">Genera reportes para ver la grafica.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profitability by Type */}
        <Card>
          <CardHeader>
            <CardTitle>Rentabilidad por Tipo</CardTitle>
            <CardDescription>
              Ingresos brutos totales por tipo de producto
            </CardDescription>
          </CardHeader>
          <CardContent>
            {productTypeProfitability.length > 0 ? (
              <div className="space-y-4">
                <BarChart
                  className="h-52"
                  data={productTypeProfitability}
                  index="productType"
                  categories={["totalUsd"]}
                  colors={["violet"]}
                  valueFormatter={usdFormatter}
                  yAxisWidth={80}
                  showLegend={false}
                />
                <div className="grid grid-cols-3 gap-2">
                  {productTypeProfitability.map((pt) => (
                    <div
                      key={pt.productType}
                      className="rounded-md border p-2 text-center"
                    >
                      <p className="text-xs text-muted-foreground">
                        {pt.productType}
                      </p>
                      <p className="text-sm font-bold">
                        {formatUSD(pt.totalUsd)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pt.productCount} productos
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-72 items-center justify-center rounded-md border border-dashed text-muted-foreground">
                <div className="text-center">
                  <Package className="mx-auto h-8 w-8 mb-2" />
                  <p>Sin datos de rentabilidad aun.</p>
                  <p className="text-xs">
                    Genera reportes para ver la comparativa.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products + Recent Reports */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Productos</CardTitle>
            <CardDescription>
              Los 10 productos con mayor ingreso bruto acumulado
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <div
                    key={p.name}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {p.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.productType}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-mono tabular-nums shrink-0">
                      {formatUSD(p.totalUsd)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
                <div className="text-center">
                  <Package className="mx-auto h-8 w-8 mb-2" />
                  <p>Sin datos de productos aun.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Reports */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Reportes Recientes</CardTitle>
                <CardDescription>
                  Ultimos {recentReports.length || 5} reportes generados
                </CardDescription>
              </div>
              {recentReports.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => router.push("/reports")}>
                  Ver todos
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {recentReports.length > 0 ? (
              <div className="space-y-3">
                {recentReports.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/reports/${r.id}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {r.isLocked ? (
                        <Lock className="h-4 w-4 text-green-600 shrink-0" />
                      ) : (
                        <Unlock className="h-4 w-4 text-amber-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium capitalize truncate">
                          {formatMonth(r.reportMonth)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.partnerName}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono tabular-nums">
                        {formatUSD(r.totalUsd)}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono tabular-nums">
                        {formatMXN(r.totalMxn)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
                <div className="text-center">
                  <FileText className="mx-auto h-8 w-8 mb-2" />
                  <p>No hay reportes aun.</p>
                  <p className="text-xs">
                    Sube un CSV para generar el primer reporte.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
