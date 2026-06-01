"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Wallet,
  Receipt,
  Clock,
  CheckCircle,
  WarningCircle,
  CurrencyDollar,
  Package,
  Calendar,
  CaretDown,
  CaretRight,
  Download,
  TrendUp,
} from "@phosphor-icons/react";
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
import {
  formatUSD,
  formatMXN,
  formatMonth,
  formatPercentage,
  cn,
} from "@/lib/utils";
import type { UserPaymentDetail } from "@/actions/payments";

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
    partners: { id: string; name: string };
    exchange_rates: { usd_to_mxn: number };
  };
}

interface Adjustment {
  id: string;
  user_id: string;
  adjustment_type: string;
  amount_usd: number;
  description: string;
  created_at: string;
  monthly_reports: { id: string; report_month: string };
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
  paymentDetail: UserPaymentDetail;
  lineItems: LineItem[];
  adjustments: Adjustment[];
}

type Tab = "resumen" | "pagos" | "desglose";

const CONCEPT_TYPE_LABELS: Record<string, string> = {
  commission: "Comisión",
  work: "Trabajo",
  bonus: "Bono",
  deduction: "Deducción",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function MyIncomeClient({
  paymentDetail,
  lineItems,
  adjustments,
}: Props) {
  const [tab, setTab] = useState<Tab>("resumen");
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(
    null
  );
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("all");

  // ── Derived data ─────────────────────────────────────────────────
  const monthlyData = useMemo<MonthlyData[]>(() => {
    const map = new Map<string, MonthlyData>();

    for (const item of lineItems) {
      const key = item.monthly_reports.report_month;
      if (!map.has(key)) {
        map.set(key, {
          reportMonth: key,
          year: parseInt(key.split("-")[0]),
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
      const m = map.get(key)!;
      m.items.push(item);
      m.totalGrossUsd += Number(item.gross_usd);
      m.totalAfterTaxesUsd += Number(item.after_taxes_usd);
      m.totalFinalUsd += Number(item.final_usd);
      m.totalFinalMxn += Number(item.final_mxn);
    }

    for (const adj of adjustments) {
      const key = adj.monthly_reports.report_month;
      const m = map.get(key);
      if (!m) continue;
      m.adjustments.push(adj);
      const amount =
        adj.adjustment_type === "deduction"
          ? -Math.abs(Number(adj.amount_usd))
          : Number(adj.amount_usd);
      m.totalAdjustmentsUsd += amount;
      m.totalFinalUsd += amount;
      m.totalFinalMxn += amount * m.exchangeRate;
    }

    return Array.from(map.values()).sort((a, b) =>
      b.reportMonth.localeCompare(a.reportMonth)
    );
  }, [lineItems, adjustments]);

  const years = useMemo(() => {
    const set = new Set(monthlyData.map((m) => m.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [monthlyData]);

  const filteredMonthly = useMemo(() => {
    if (selectedYear === "all") return monthlyData;
    return monthlyData.filter((m) => m.year === parseInt(selectedYear));
  }, [monthlyData, selectedYear]);

  const pendingEarningsTotal = paymentDetail.unpaidEarnings.reduce(
    (s, e) => s + e.totalFinalUsd,
    0
  );
  const pendingConceptsTotal = paymentDetail.unpaidConcepts.reduce(
    (s, c) => s + c.amountUsd,
    0
  );
  const totalPending = pendingEarningsTotal + pendingConceptsTotal;
  const totalPaid = paymentDetail.payments.reduce(
    (s, p) => s + p.totalUsd,
    0
  );
  const totalEarned = monthlyData.reduce((s, m) => s + m.totalFinalUsd, 0);
  const lastPayment = paymentDetail.payments[0];

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "pagos", label: "Pagos", count: paymentDetail.payments.length },
    {
      id: "desglose",
      label: "Desglose mensual",
      count: monthlyData.length,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mis Ingresos</h1>
        <p className="text-muted-foreground">
          Tu dinero: lo que se te debe, lo que ya te pagaron y de dónde
          viene.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                tab === t.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {typeof t.count === "number" && t.count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    tab === t.id
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === "resumen" && (
        <ResumenTab
          totalPending={totalPending}
          totalPaid={totalPaid}
          totalEarned={totalEarned}
          unpaidEarningsCount={paymentDetail.unpaidEarnings.length}
          unpaidConceptsCount={paymentDetail.unpaidConcepts.length}
          paymentsCount={paymentDetail.payments.length}
          monthsCount={monthlyData.length}
          lastPayment={lastPayment}
          onGoToPagos={() => setTab("pagos")}
          onGoToDesglose={() => setTab("desglose")}
        />
      )}

      {tab === "pagos" && (
        <PagosTab
          paymentDetail={paymentDetail}
          totalPending={totalPending}
          expandedPaymentId={expandedPaymentId}
          setExpandedPaymentId={setExpandedPaymentId}
        />
      )}

      {tab === "desglose" && (
        <DesgloseTab
          filteredMonthly={filteredMonthly}
          years={years}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          expandedMonth={expandedMonth}
          setExpandedMonth={setExpandedMonth}
        />
      )}
    </div>
  );
}

// ── Resumen ───────────────────────────────────────────────────────

function ResumenTab(props: {
  totalPending: number;
  totalPaid: number;
  totalEarned: number;
  unpaidEarningsCount: number;
  unpaidConceptsCount: number;
  paymentsCount: number;
  monthsCount: number;
  lastPayment: UserPaymentDetail["payments"][number] | undefined;
  onGoToPagos: () => void;
  onGoToDesglose: () => void;
}) {
  const {
    totalPending,
    totalPaid,
    totalEarned,
    unpaidEarningsCount,
    unpaidConceptsCount,
    paymentsCount,
    monthsCount,
    lastPayment,
    onGoToPagos,
    onGoToDesglose,
  } = props;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Pendiente de cobro
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                "text-2xl font-bold tabular-nums",
                totalPending > 0 ? "text-amber-600" : ""
              )}
            >
              {formatUSD(totalPending)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {unpaidEarningsCount} reporte
              {unpaidEarningsCount !== 1 ? "s" : ""} ·{" "}
              {unpaidConceptsCount} concepto
              {unpaidConceptsCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Total pagado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {formatUSD(totalPaid)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {paymentsCount} pago{paymentsCount !== 1 ? "s" : ""} recibido
              {paymentsCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendUp className="h-4 w-4" /> Total generado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {formatUSD(totalEarned)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {monthsCount} mes{monthsCount !== 1 ? "es" : ""} con
              actividad
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Último pago
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lastPayment ? (
              <>
                <p className="text-2xl font-bold tabular-nums">
                  {formatUSD(lastPayment.totalUsd)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {fmtDate(lastPayment.paidAt)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-2">
                Sin pagos aún
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              ¿Qué sigue?
            </CardTitle>
            <CardDescription>
              {totalPending > 0
                ? "Tienes saldo pendiente de cobro."
                : "Estás al día — no hay saldos pendientes."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totalPending > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onGoToPagos}
                className="w-full"
              >
                Ver detalle de pendientes
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Cuando se genere un nuevo reporte aparecerá aquí.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              ¿De dónde viene?
            </CardTitle>
            <CardDescription>
              Revisa el desglose mensual por producto y partner.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={onGoToDesglose}
              disabled={monthsCount === 0}
              className="w-full"
            >
              Ver desglose mensual
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Pagos ─────────────────────────────────────────────────────────

function PagosTab(props: {
  paymentDetail: UserPaymentDetail;
  totalPending: number;
  expandedPaymentId: string | null;
  setExpandedPaymentId: (id: string | null) => void;
}) {
  const { paymentDetail, expandedPaymentId, setExpandedPaymentId } = props;
  const hasPending =
    paymentDetail.unpaidEarnings.length > 0 ||
    paymentDetail.unpaidConcepts.length > 0;

  return (
    <div className="space-y-6">
      {hasPending && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              Pendiente de cobro
            </CardTitle>
            <CardDescription>
              Comisiones y conceptos que aún no han sido pagados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {paymentDetail.unpaidEarnings.map((e) => (
              <div
                key={e.reportId}
                className="flex items-center justify-between rounded-lg border p-3 gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium capitalize">
                      {formatMonth(e.reportMonth)}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {e.partnerName}
                    </Badge>
                    {e.isLocked && (
                      <Badge variant="secondary" className="text-[10px]">
                        Bloqueado
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    TC {e.exchangeRate.toFixed(2)} MXN/USD
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold tabular-nums">
                    {formatUSD(e.totalFinalUsd)}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatMXN(e.totalFinalMxn)}
                  </p>
                </div>
              </div>
            ))}

            {paymentDetail.unpaidConcepts.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border p-3 gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">
                      {CONCEPT_TYPE_LABELS[c.conceptType] ?? c.conceptType}
                    </Badge>
                    <p className="font-medium truncate">{c.description}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.partnerName} · {fmtDate(c.conceptDate)}
                  </p>
                </div>
                <p
                  className={cn(
                    "font-semibold tabular-nums shrink-0",
                    c.conceptType === "deduction" ? "text-red-600" : ""
                  )}
                >
                  {c.conceptType === "deduction" ? "−" : ""}
                  {formatUSD(Math.abs(c.amountUsd))}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Historial de pagos
          </CardTitle>
          <CardDescription>
            Detalle de cada pago recibido con recibo descargable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paymentDetail.payments.length === 0 ? (
            <div className="flex h-[160px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
              <div className="text-center">
                <WarningCircle className="mx-auto h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Aún no has recibido ningún pago.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {paymentDetail.payments.map((p) => {
                const isOpen = expandedPaymentId === p.id;
                return (
                  <div key={p.id} className="rounded-lg border">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPaymentId(isOpen ? null : p.id)
                      }
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40 transition-colors rounded-lg"
                    >
                      {isOpen ? (
                        <CaretDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <CaretRight className="h-4 w-4 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium tabular-nums">
                            {formatUSD(p.totalUsd)}
                          </p>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatMXN(p.totalMxn)}
                          </span>
                          {p.paymentMethod && (
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {p.paymentMethod}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {fmtDate(p.paidAt)}
                          {p.createdByName &&
                            ` · Registrado por ${p.createdByName}`}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(
                            `/api/payments/${p.id}/receipt`,
                            "_blank"
                          );
                        }}
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Recibo
                      </Button>
                    </button>

                    {isOpen && (
                      <div className="border-t px-3 py-2 bg-muted/30">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-muted-foreground">
                              <th className="py-2 font-medium">Concepto</th>
                              <th className="py-2 font-medium text-right">
                                USD
                              </th>
                              <th className="py-2 font-medium text-right">
                                MXN
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.items.map((i) => (
                              <tr key={i.id} className="border-t">
                                <td className="py-2 pr-4">
                                  {i.description}
                                </td>
                                <td className="py-2 pl-4 text-right tabular-nums whitespace-nowrap">
                                  {formatUSD(i.amountUsd)}
                                </td>
                                <td className="py-2 pl-4 text-right tabular-nums whitespace-nowrap">
                                  {formatMXN(i.amountMxn)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {p.notes && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            {p.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Desglose mensual ─────────────────────────────────────────────

function DesgloseTab(props: {
  filteredMonthly: MonthlyData[];
  years: number[];
  selectedYear: string;
  setSelectedYear: (y: string) => void;
  expandedMonth: string | null;
  setExpandedMonth: (m: string | null) => void;
}) {
  const {
    filteredMonthly,
    years,
    selectedYear,
    setSelectedYear,
    expandedMonth,
    setExpandedMonth,
  } = props;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Desglose mensual
            </CardTitle>
            <CardDescription>
              Detalle de ganancias por mes, partner y producto.
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
        {filteredMonthly.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
            <p className="text-center">
              No hay datos de ganancias para el período seleccionado
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-medium text-muted-foreground w-8" />
                  <th className="pb-3 pr-4 font-medium text-muted-foreground">
                    Mes
                  </th>
                  <th className="pb-3 pr-4 font-medium text-muted-foreground">
                    Partner
                  </th>
                  <th className="pb-3 pr-4 font-medium text-muted-foreground">
                    Productos
                  </th>
                  <th className="pb-3 pl-4 font-medium text-muted-foreground text-right">
                    Bruto USD
                  </th>
                  <th className="pb-3 pl-4 font-medium text-muted-foreground text-right">
                    Post-Tax USD
                  </th>
                  <th className="pb-3 pl-4 font-medium text-muted-foreground text-right">
                    Ajustes USD
                  </th>
                  <th className="pb-3 pl-4 font-medium text-muted-foreground text-right">
                    Final USD
                  </th>
                  <th className="pb-3 pl-4 font-medium text-muted-foreground text-right">
                    Final MXN
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMonthly.map((m) => (
                  <Fragment key={m.reportMonth}>
                    <tr
                      className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() =>
                        setExpandedMonth(
                          expandedMonth === m.reportMonth
                            ? null
                            : m.reportMonth
                        )
                      }
                    >
                      <td className="py-3 px-2">
                        {expandedMonth === m.reportMonth ? (
                          <CaretDown className="h-4 w-4" />
                        ) : (
                          <CaretRight className="h-4 w-4" />
                        )}
                      </td>
                      <td className="py-3 pr-4 font-medium capitalize whitespace-nowrap">
                        {formatMonth(m.reportMonth)}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                        {m.partnerName}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                        {m.items.length} producto
                        {m.items.length !== 1 ? "s" : ""}
                      </td>
                      <td className="py-3 pl-4 text-right font-mono tabular-nums whitespace-nowrap">
                        {formatUSD(m.totalGrossUsd)}
                      </td>
                      <td className="py-3 pl-4 text-right font-mono tabular-nums whitespace-nowrap">
                        {formatUSD(m.totalAfterTaxesUsd)}
                      </td>
                      <td className="py-3 pl-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <span
                          className={cn(
                            m.totalAdjustmentsUsd < 0
                              ? "text-red-600"
                              : m.totalAdjustmentsUsd > 0
                              ? "text-green-600"
                              : ""
                          )}
                        >
                          {m.totalAdjustmentsUsd !== 0
                            ? formatUSD(m.totalAdjustmentsUsd)
                            : "—"}
                        </span>
                      </td>
                      <td className="py-3 pl-4 text-right font-mono font-medium tabular-nums whitespace-nowrap">
                        {formatUSD(m.totalFinalUsd)}
                      </td>
                      <td className="py-3 pl-4 text-right font-mono font-medium tabular-nums whitespace-nowrap">
                        {formatMXN(m.totalFinalMxn)}
                      </td>
                    </tr>

                    {expandedMonth === m.reportMonth && (
                      <>
                        {m.items.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b bg-muted/20 hover:bg-muted/30"
                          >
                            <td colSpan={3} />
                            <td className="py-2 pr-4 pl-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">
                                  {formatPercentage(
                                    Number(item.percentage_applied)
                                  )}
                                </Badge>
                                <span className="truncate">
                                  {item.product_name}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 pl-4 text-right font-mono tabular-nums text-sm whitespace-nowrap">
                              {formatUSD(Number(item.gross_usd))}
                            </td>
                            <td className="py-2 pl-4 text-right font-mono tabular-nums text-sm whitespace-nowrap">
                              {formatUSD(Number(item.after_taxes_usd))}
                            </td>
                            <td />
                            <td className="py-2 pl-4 text-right font-mono tabular-nums text-sm whitespace-nowrap">
                              {formatUSD(Number(item.final_usd))}
                            </td>
                            <td className="py-2 pl-4 text-right font-mono tabular-nums text-sm whitespace-nowrap">
                              {formatMXN(Number(item.final_mxn))}
                            </td>
                          </tr>
                        ))}

                        {m.adjustments.map((adj) => (
                          <tr
                            key={adj.id}
                            className="border-b bg-muted/20 hover:bg-muted/30"
                          >
                            <td colSpan={3} />
                            <td className="py-2 pr-4 pl-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    adj.adjustment_type === "bonus"
                                      ? "success"
                                      : adj.adjustment_type === "deduction"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                >
                                  {adj.adjustment_type === "bonus"
                                    ? "Bono"
                                    : adj.adjustment_type === "deduction"
                                    ? "Deducción"
                                    : "Corrección"}
                                </Badge>
                                <span className="truncate">
                                  {adj.description}
                                </span>
                              </div>
                            </td>
                            <td />
                            <td />
                            <td className="py-2 pl-4 text-right font-mono tabular-nums text-sm whitespace-nowrap">
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
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
