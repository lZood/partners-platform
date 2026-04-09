"use client";

import { useState, useMemo } from "react";
import {
  DollarSign,
  Package,
  Calendar,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatUSD, formatMXN, formatMonth, formatPercentage, cn } from "@/lib/utils";

interface LineItem {
  id: string;
  user_id: string;
  product_id: string;
  product_name: string;
  percentage_applied: number;
  gross_usd: number;
  after_taxes_usd: number;
  final_usd: number;
  final_mxn: number;
  monthly_reports: {
    id: string;
    report_month: string;
    partners: {
      id: string;
      name: string;
    };
    exchange_rates: {
      usd_to_mxn: number;
    };
  };
}

interface Adjustment {
  id: string;
  user_id: string;
  adjustment_type: string;
  amount_usd: number;
  description: string;
  created_at: string;
  monthly_reports: {
    id: string;
    report_month: string;
  };
}

interface MonthlyData {
  reportMonth: string;
  year: number;
  partnerName: string;
  exchangeRate: number;
  items: LineItem[];
  adjustments: Adjustment[];
  totalGrossUsd: number;
  totalAfterTaxesUsd: number;
  totalAdjustmentsUsd: number;
  totalFinalUsd: number;
  totalFinalMxn: number;
}

interface Props {
  userId: string;
  lineItems: LineItem[];
  adjustments: Adjustment[];
}

export function MyEarningsClient({
  userId,
  lineItems,
  adjustments,
}: Props) {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("all");

  // Group data by month
  const monthlyData = useMemo(() => {
    const monthMap = new Map<string, MonthlyData>();

    // Process line items
    for (const item of lineItems) {
      const key = item.monthly_reports.report_month;
      if (!monthMap.has(key)) {
        monthMap.set(key, {
          reportMonth: item.monthly_reports.report_month,
          year: parseInt(item.monthly_reports.report_month.split("-")[0]),
          partnerName: item.monthly_reports.partners.name,
          exchangeRate: Number(
            item.monthly_reports.exchange_rates.usd_to_mxn
          ),
          items: [],
          adjustments: [],
          totalGrossUsd: 0,
          totalAfterTaxesUsd: 0,
          totalAdjustmentsUsd: 0,
          totalFinalUsd: 0,
          totalFinalMxn: 0,
        });
      }

      const monthly = monthMap.get(key)!;
      monthly.items.push(item);
      monthly.totalGrossUsd += Number(item.gross_usd);
      monthly.totalAfterTaxesUsd += Number(item.after_taxes_usd);
      monthly.totalFinalUsd += Number(item.final_usd);
      monthly.totalFinalMxn += Number(item.final_mxn);
    }

    // Process adjustments
    for (const adj of adjustments) {
      const key = adj.monthly_reports.report_month;
      if (monthMap.has(key)) {
        const monthly = monthMap.get(key)!;
        monthly.adjustments.push(adj);
        const amount =
          adj.adjustment_type === "deduction"
            ? -Math.abs(Number(adj.amount_usd))
            : Number(adj.amount_usd);
        monthly.totalAdjustmentsUsd += amount;
        monthly.totalFinalUsd += amount;
        monthly.totalFinalMxn += amount * monthly.exchangeRate;
      }
    }

    // Sort by month descending (newest first)
    return Array.from(monthMap.values()).sort((a, b) =>
      b.reportMonth.localeCompare(a.reportMonth)
    );
  }, [lineItems, adjustments]);

  // Get unique years for filter
  const years = useMemo(() => {
    const yearSet = new Set(monthlyData.map((m) => m.year));
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [monthlyData]);

  // Filter by year
  const filteredData = useMemo(() => {
    if (selectedYear === "all") return monthlyData;
    return monthlyData.filter((m) => m.year === parseInt(selectedYear));
  }, [monthlyData, selectedYear]);

  // Calculate summary totals
  const summaryTotals = useMemo(() => {
    return filteredData.reduce(
      (acc, m) => ({
        totalEarnedUsd: acc.totalEarnedUsd + m.totalFinalUsd,
        totalEarnedMxn: acc.totalEarnedMxn + m.totalFinalMxn,
        totalProducts: acc.totalProducts + m.items.length,
        totalMonths: acc.totalMonths + 1,
      }),
      {
        totalEarnedUsd: 0,
        totalEarnedMxn: 0,
        totalProducts: 0,
        totalMonths: 0,
      }
    );
  }, [filteredData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mis Ganancias</h1>
        <p className="text-muted-foreground">
          Resumen de tus ganancias mensuales por productos y partners
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Ganado USD
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tabular-nums">
              {formatUSD(summaryTotals.totalEarnedUsd)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Ganado MXN
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tabular-nums">
              {formatMXN(summaryTotals.totalEarnedMxn)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Productos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryTotals.totalProducts}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Meses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryTotals.totalMonths}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Desglose Mensual</CardTitle>
              <CardDescription>
                Detalle de ganancias por mes
              </CardDescription>
            </div>
            {years.length > 1 && (
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Seleccionar año" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los años</SelectItem>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredData.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
              <p className="text-center">
                No hay datos de ganancias para el período seleccionado
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground w-8" />
                    <th className="pb-3 font-medium text-muted-foreground">
                      Mes
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      Partner
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      Productos
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      Bruto USD
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      Post-Tax USD
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      Ajustes USD
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      Final USD
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      Final MXN
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((monthly) => (
                    <tbody key={monthly.reportMonth}>
                      <tr
                        className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() =>
                          setExpandedMonth(
                            expandedMonth === monthly.reportMonth
                              ? null
                              : monthly.reportMonth
                          )
                        }
                      >
                        <td className="py-3 px-2">
                          {expandedMonth === monthly.reportMonth ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </td>
                        <td className="py-3 font-medium capitalize">
                          {formatMonth(monthly.reportMonth)}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {monthly.partnerName}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {monthly.items.length} producto
                          {monthly.items.length !== 1 ? "s" : ""}
                        </td>
                        <td className="py-3 text-right font-mono tabular-nums">
                          {formatUSD(monthly.totalGrossUsd)}
                        </td>
                        <td className="py-3 text-right font-mono tabular-nums">
                          {formatUSD(monthly.totalAfterTaxesUsd)}
                        </td>
                        <td className="py-3 text-right font-mono tabular-nums">
                          <span
                            className={cn(
                              monthly.totalAdjustmentsUsd < 0
                                ? "text-red-600"
                                : monthly.totalAdjustmentsUsd > 0
                                ? "text-green-600"
                                : ""
                            )}
                          >
                            {monthly.totalAdjustmentsUsd !== 0
                              ? formatUSD(monthly.totalAdjustmentsUsd)
                              : "—"}
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono font-medium tabular-nums">
                          {formatUSD(monthly.totalFinalUsd)}
                        </td>
                        <td className="py-3 text-right font-mono font-medium tabular-nums">
                          {formatMXN(monthly.totalFinalMxn)}
                        </td>
                      </tr>

                      {/* Expanded detail rows */}
                      {expandedMonth === monthly.reportMonth && (
                        <>
                          {/* Products detail */}
                          {monthly.items.map((item) => (
                            <tr
                              key={item.id}
                              className="border-b bg-muted/20 hover:bg-muted/30"
                            >
                              <td colSpan={3} />
                              <td className="py-2 pl-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary">
                                    {formatPercentage(
                                      Number(item.percentage_applied)
                                    )}
                                  </Badge>
                                  {item.product_name}
                                </div>
                              </td>
                              <td className="py-2 text-right font-mono tabular-nums text-sm">
                                {formatUSD(Number(item.gross_usd))}
                              </td>
                              <td className="py-2 text-right font-mono tabular-nums text-sm">
                                {formatUSD(Number(item.after_taxes_usd))}
                              </td>
                              <td />
                              <td className="py-2 text-right font-mono tabular-nums text-sm">
                                {formatUSD(Number(item.final_usd))}
                              </td>
                              <td className="py-2 text-right font-mono tabular-nums text-sm">
                                {formatMXN(Number(item.final_mxn))}
                              </td>
                            </tr>
                          ))}

                          {/* Adjustments detail */}
                          {monthly.adjustments.length > 0 && (
                            <>
                              {monthly.adjustments.map((adj) => (
                                <tr
                                  key={adj.id}
                                  className="border-b bg-muted/20 hover:bg-muted/30"
                                >
                                  <td colSpan={3} />
                                  <td className="py-2 pl-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                      <Badge
                                        variant={
                                          adj.adjustment_type === "bonus"
                                            ? "success"
                                            : adj.adjustment_type ===
                                              "deduction"
                                            ? "destructive"
                                            : "secondary"
                                        }
                                      >
                                        {adj.adjustment_type === "bonus"
                                          ? "Bono"
                                          : adj.adjustment_type ===
                                            "deduction"
                                          ? "Deducción"
                                          : "Corrección"}
                                      </Badge>
                                      {adj.description}
                                    </div>
                                  </td>
                                  <td />
                                  <td />
                                  <td className="py-2 text-right font-mono tabular-nums text-sm">
                                    <span
                                      className={
                                        adj.adjustment_type === "deduction"
                                          ? "text-red-600"
                                          : "text-green-600"
                                      }
                                    >
                                      {adj.adjustment_type === "deduction"
                                        ? "-"
                                        : "+"}
                                      {formatUSD(Number(adj.amount_usd))}
                                    </span>
                                  </td>
                                  <td />
                                  <td />
                                </tr>
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </tbody>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
