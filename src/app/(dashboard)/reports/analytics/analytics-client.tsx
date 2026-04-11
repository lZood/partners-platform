"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { BarChart, DonutChart, AreaChart } from "@tremor/react";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  AlertCircle,
  Download,
  BarChart3,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatUSD, formatPercentage } from "@/lib/utils";
import type { AnalyticsData } from "@/actions/analytics";

interface Props {
  data: AnalyticsData | null;
  year: number;
  partnerId?: string;
  partners: { id: string; name: string }[];
}

export function AnalyticsClient({ data, year, partnerId, partners }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll("[data-animate-card]");
    gsap.fromTo(
      cards,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.35, stagger: 0.06, ease: "power2.out" }
    );
  }, []);

  const handleYearChange = (newYear: string) => {
    const params = new URLSearchParams();
    params.set("year", newYear);
    if (partnerId) params.set("partner", partnerId);
    router.push(`/reports/analytics?${params}`);
  };

  const handlePartnerChange = (pid: string) => {
    const params = new URLSearchParams();
    params.set("year", year.toString());
    if (pid) params.set("partner", pid);
    router.push(`/reports/analytics?${params}`);
  };

  const usdFormatter = (v: number) => formatUSD(v);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  if (!data) {
    return <p className="text-red-500">Error cargando datos de analytics</p>;
  }

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Graficas y comparativas de ingresos, productos y pagos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">Ano:</span>
            <Select value={String(year)} onValueChange={handleYearChange}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          {partners.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">Partner:</span>
              <Select value={partnerId ?? "all"} onValueChange={(v) => handlePartnerChange(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {partners.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams();
              params.set("year", year.toString());
              if (partnerId) params.set("partnerId", partnerId);
              window.open(`/api/reports/fiscal?${params}`, "_blank");
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Fiscal {year}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card data-animate-card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Bruto</span>
              <DollarSign className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">{formatUSD(data.totals.totalGrossUsd)}</p>
          </CardContent>
        </Card>
        <Card data-animate-card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Neto</span>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold">{formatUSD(data.totals.totalNetUsd)}</p>
          </CardContent>
        </Card>
        <Card data-animate-card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Pagado</span>
              <CreditCard className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">{formatUSD(data.totals.totalPaidUsd)}</p>
          </CardContent>
        </Card>
        <Card data-animate-card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Pendiente</span>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">{formatUSD(data.totals.totalPendingUsd)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly comparison */}
        <Card data-animate-card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Comparativa Mensual</CardTitle>
            <CardDescription>Bruto vs Neto por mes</CardDescription>
          </CardHeader>
          <CardContent>
            {data.monthlyComparison.length > 0 ? (
              <BarChart
                className="h-64"
                data={data.monthlyComparison}
                index="label"
                categories={["grossUsd", "netUsd"]}
                colors={["blue", "emerald"]}
                valueFormatter={usdFormatter}
                yAxisWidth={72}
                showLegend
              />
            ) : (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                <p className="text-sm">Sin datos para {year}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Partner comparison */}
        <Card data-animate-card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribucion por Partner</CardTitle>
            <CardDescription>Proporcion de ingresos</CardDescription>
          </CardHeader>
          <CardContent>
            {data.partnerComparison.length > 0 ? (
              <>
                <DonutChart
                  className="h-48"
                  data={data.partnerComparison}
                  category="totalUsd"
                  index="name"
                  valueFormatter={usdFormatter}
                  colors={["blue", "violet", "amber", "emerald", "rose"]}
                  showLabel
                />
                <div className="mt-3 space-y-1.5">
                  {data.partnerComparison.map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-sm">
                      <span>{p.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono tabular-nums">{formatUSD(p.totalUsd)}</span>
                        <Badge variant="outline" className="text-[10px]">{p.percentage}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                <p className="text-sm">Sin datos</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment trend */}
        <Card data-animate-card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tendencia de Pagos</CardTitle>
            <CardDescription>Pagado vs Pendiente por mes</CardDescription>
          </CardHeader>
          <CardContent>
            {data.paymentTrend.length > 0 ? (
              <AreaChart
                className="h-64"
                data={data.paymentTrend}
                index="label"
                categories={["paidUsd", "pendingUsd"]}
                colors={["green", "red"]}
                valueFormatter={usdFormatter}
                yAxisWidth={72}
                showLegend
                curveType="monotone"
              />
            ) : (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                <p className="text-sm">Sin datos</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product ranking */}
        <Card data-animate-card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ranking de Productos</CardTitle>
            <CardDescription>Top 15 por ingreso bruto</CardDescription>
          </CardHeader>
          <CardContent>
            {data.productRanking.length > 0 ? (
              <div className="space-y-2.5">
                {data.productRanking.map((p, i) => (
                  <div key={p.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                        <span className="font-medium truncate">{p.name}</span>
                        <Badge variant="outline" className="text-[9px]">{p.productType}</Badge>
                      </div>
                      <span className="font-mono tabular-nums text-xs shrink-0">{formatUSD(p.totalUsd)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${p.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                <p className="text-sm">Sin datos</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
