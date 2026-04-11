"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { AreaChart } from "@tremor/react";
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
  ChevronRight,
  Wallet,
  Building2,
  Bell,
  Calendar,
  AlertCircle,
  CreditCard,
  UserPlus,
  Clock,
  CalendarDays,
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
import {
  formatUSD,
  formatMXN,
  formatMonth,
  displayName,
  getInitials,
} from "@/lib/utils";
import type {
  DashboardData,
  AdminDashboardExtra,
  CalendarEvent,
  Notification,
} from "@/actions/dashboard";

interface Props {
  data: DashboardData;
  extra: AdminDashboardExtra | null;
  partners: { id: string; name: string }[];
  currentPartnerId?: string;
  currentDateFrom?: string;
  currentDateTo?: string;
  userRole: string;
  userName: string;
}

type DatePreset = "this_month" | "last_month" | "this_quarter" | "this_year" | "last_3_months" | "last_6_months" | "custom";

const datePresets: { value: DatePreset; label: string }[] = [
  { value: "this_month", label: "Este Mes" },
  { value: "last_month", label: "Mes Anterior" },
  { value: "this_quarter", label: "Este Trimestre" },
  { value: "last_3_months", label: "Ultimos 3 Meses" },
  { value: "last_6_months", label: "Ultimos 6 Meses" },
  { value: "this_year", label: "Este Ano" },
  { value: "custom", label: "Personalizado" },
];

function getDateRange(preset: DatePreset): { from: string; to: string } | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (preset) {
    case "this_month":
      return null; // default behavior
    case "last_month": {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return { from: fmt(start), to: fmt(end) };
    }
    case "this_quarter": {
      const qStart = new Date(y, Math.floor(m / 3) * 3, 1);
      return { from: fmt(qStart), to: fmt(now) };
    }
    case "last_3_months": {
      const start = new Date(y, m - 2, 1);
      return { from: fmt(start), to: fmt(now) };
    }
    case "last_6_months": {
      const start = new Date(y, m - 5, 1);
      return { from: fmt(start), to: fmt(now) };
    }
    case "this_year":
      return { from: `${y}-01-01`, to: fmt(now) };
    default:
      return null;
  }
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function useCountUp(end: number, duration: number = 0.8) {
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);
  useEffect(() => {
    if (!ref.current || hasAnimated.current) return;
    hasAnimated.current = true;
    const obj = { value: 0 };
    gsap.to(obj, {
      value: end,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        if (ref.current) {
          ref.current.textContent = obj.value.toLocaleString("en-US", {
            maximumFractionDigits: 0,
          });
        }
      },
    });
  }, [end, duration]);
  return ref;
}

// ── Mini Calendar ───────────────────────────────────────────────
function MiniCalendar({ events }: { events: CalendarEvent[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();

  const eventDates = new Map<number, CalendarEvent[]>();
  for (const e of events) {
    const d = parseInt(e.date.split("-")[2]);
    if (!eventDates.has(d)) eventDates.set(d, []);
    eventDates.get(d)!.push(e);
  }

  const monthName = now.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  const dayNames = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];

  return (
    <div>
      <p className="text-sm font-medium capitalize mb-3">{monthName}</p>
      <div className="grid grid-cols-7 gap-1 text-center">
        {dayNames.map((d) => (
          <span key={d} className="text-[10px] text-muted-foreground font-medium">
            {d}
          </span>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => (
          <span key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayEvents = eventDates.get(day);
          const isToday = day === today;
          return (
            <div
              key={day}
              className={`relative flex items-center justify-center h-7 w-7 mx-auto rounded-full text-xs ${
                isToday
                  ? "bg-primary text-primary-foreground font-bold"
                  : "text-foreground"
              }`}
            >
              {day}
              {dayEvents && (
                <span className="absolute -bottom-0.5 flex gap-0.5">
                  {dayEvents.some((e) => e.type === "report") && (
                    <span className="h-1 w-1 rounded-full bg-blue-500" />
                  )}
                  {dayEvents.some((e) => e.type === "payment") && (
                    <span className="h-1 w-1 rounded-full bg-green-500" />
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Reportes
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Pagos
        </span>
      </div>
    </div>
  );
}

// ── Notification Feed ───────────────────────────────────────────
function NotificationFeed({ notifications }: { notifications: Notification[] }) {
  const icons: Record<string, typeof Bell> = {
    report_generated: FileText,
    payment_registered: CreditCard,
    payment_received: Wallet,
    user_unassigned: UserPlus,
    concept_added: DollarSign,
  };

  const colors: Record<string, string> = {
    report_generated: "text-blue-500",
    payment_registered: "text-green-500",
    payment_received: "text-emerald-500",
    user_unassigned: "text-amber-500",
    concept_added: "text-violet-500",
  };

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  if (notifications.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        Sin actividad reciente
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.map((n) => {
        const Icon = icons[n.type] ?? Bell;
        const color = colors[n.type] ?? "text-muted-foreground";
        return (
          <div key={n.id} className="flex items-start gap-2.5">
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs leading-relaxed">{n.message}</p>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {timeAgo(n.timestamp)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Dashboard Component ────────────────────────────────────
export function DashboardClient({
  data,
  extra,
  partners,
  currentPartnerId,
  currentDateFrom,
  currentDateTo,
  userRole,
  userName,
}: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const { stats, monthlyTrends, productTypeProfitability, topProducts, recentReports } = data;

  const [selectedPartner, setSelectedPartner] = useState(currentPartnerId ?? "");
  const [datePreset, setDatePreset] = useState<DatePreset>(
    currentDateFrom ? "custom" : "this_month"
  );
  const [customFrom, setCustomFrom] = useState(currentDateFrom ?? "");
  const [customTo, setCustomTo] = useState(currentDateTo ?? "");
  const [showCustom, setShowCustom] = useState(false);

  const buildUrl = (partner: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (partner) params.set("partner", partner);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };

  const handlePartnerChange = (value: string) => {
    const p = value === "all" ? "" : value;
    setSelectedPartner(p);
    const range = datePreset !== "this_month" ? getDateRange(datePreset) : null;
    router.push(buildUrl(p, range?.from, range?.to));
  };

  const handleDatePresetChange = (value: string) => {
    const preset = value as DatePreset;
    setDatePreset(preset);
    if (preset === "custom") {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    const range = getDateRange(preset);
    router.push(buildUrl(selectedPartner, range?.from, range?.to));
  };

  const applyCustomRange = () => {
    if (customFrom && customTo) {
      router.push(buildUrl(selectedPartner, customFrom, customTo));
      setShowCustom(false);
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll("[data-animate-card]");
    gsap.fromTo(
      cards,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: "power2.out" }
    );
  }, []);

  const momChange =
    stats.previousMonthUsd > 0
      ? ((stats.currentMonthUsd - stats.previousMonthUsd) / stats.previousMonthUsd) * 100
      : stats.currentMonthUsd > 0 ? 100 : 0;

  const MomIcon = momChange > 0 ? TrendingUp : momChange < 0 ? TrendingDown : Minus;
  const momColor = momChange > 0 ? "text-green-600" : momChange < 0 ? "text-red-600" : "text-muted-foreground";

  const usdFormatter = (v: number) => formatUSD(v);
  const isAdmin = userRole === "super_admin" || userRole === "admin";

  const usdRef = useCountUp(stats.currentMonthUsd);
  const pendingRef = useCountUp(extra?.totalPendingPayments ?? 0);
  const paidRef = useCountUp(extra?.totalPaidThisMonth ?? 0);

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Filters bar */}
      {isAdmin && (
        <div data-animate-card className="flex items-center justify-end gap-3 flex-wrap">
          {/* Date range */}
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Select value={datePreset} onValueChange={handleDatePresetChange}>
              <SelectTrigger className="w-[170px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {datePresets.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom date inputs */}
          {showCustom && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 rounded-md border bg-card px-2 text-sm"
              />
              <span className="text-xs text-muted-foreground">a</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 rounded-md border bg-card px-2 text-sm"
              />
              <Button size="sm" variant="outline" onClick={applyCustomRange} disabled={!customFrom || !customTo}>
                Aplicar
              </Button>
            </div>
          )}

          {/* Partner selector */}
          {partners.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Partner:</span>
              <Select value={selectedPartner || "all"} onValueChange={handlePartnerChange}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Partners</SelectItem>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Unassigned users alert */}
      {extra && extra.unassignedUsersCount > 0 && (
        <div data-animate-card className="flex items-center gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3 cursor-pointer" onClick={() => router.push("/collaborators")}>
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{extra.unassignedUsersCount} usuario(s) esperando asignacion</p>
          <ChevronRight className="h-4 w-4 text-amber-600 ml-auto shrink-0" />
        </div>
      )}

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card data-animate-card className="transition-card hover-lift border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">
                {currentDateFrom ? "Ingresos Periodo" : "Ingresos Mes"}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold">$<span ref={usdRef}>0</span></p>
            {(stats.previousMonthUsd > 0 || stats.currentMonthUsd > 0) && (
              <p className={`text-xs flex items-center gap-1 mt-1 ${momColor}`}>
                <MomIcon className="h-3 w-3" />
                {momChange > 0 ? "+" : ""}{momChange.toFixed(1)}% vs periodo anterior
              </p>
            )}
          </CardContent>
        </Card>

        <Card data-animate-card className="transition-card hover-lift border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">Pendiente Pago</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-red-600">$<span ref={pendingRef}>0</span></p>
            <p className="text-xs text-muted-foreground mt-1">Por pagar a colaboradores</p>
          </CardContent>
        </Card>

        <Card data-animate-card className="transition-card hover-lift border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">
                {currentDateFrom ? "Pagado Periodo" : "Pagado este Mes"}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950/30 text-green-600">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-green-600">$<span ref={paidRef}>0</span></p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.activeProducts} productos · {stats.activeCollaborators} colaboradores
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend */}
      <Card data-animate-card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tendencia de Ingresos</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyTrends.length > 0 ? (
            <AreaChart
              className="h-56"
              data={monthlyTrends}
              index="label"
              categories={["totalUsd", "totalMxn"]}
              colors={["blue", "emerald"]}
              valueFormatter={usdFormatter}
              yAxisWidth={72}
              showLegend
              curveType="monotone"
            />
          ) : (
            <div className="flex h-56 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
              <div className="text-center">
                <TrendingUp className="mx-auto h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Sin datos de tendencia</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two-column: Pending Payments + Top Products */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Payments */}
        {extra && extra.pendingPayments.length > 0 && (
          <Card data-animate-card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Pagos Pendientes</CardTitle>
                <Button variant="link" size="sm" className="text-primary gap-1" onClick={() => router.push("/payments")}>
                  Ver Todos <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {extra.pendingPayments.slice(0, 5).map((p) => (
                  <div key={p.userId} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => router.push(`/payments/${p.userId}`)}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold overflow-hidden">
                      {p.avatarUrl ? (
                        <img src={p.avatarUrl} alt={p.userName} className="h-full w-full object-cover" />
                      ) : (
                        getInitials(p.userName)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{displayName(p.userName)}</p>
                      <p className="text-xs text-muted-foreground">{p.unpaidMonths} mes(es)</p>
                    </div>
                    <p className="text-sm font-mono font-bold tabular-nums text-red-600 shrink-0">
                      {formatUSD(p.totalPendingUsd)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Products */}
        <Card data-animate-card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Top Productos</CardTitle>
              <Button variant="link" size="sm" className="text-primary gap-1" onClick={() => router.push("/products")}>
                Ver Todos <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <div className="space-y-2">
                {topProducts.slice(0, 5).map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{i + 1}</span>
                    <p className="text-sm font-medium truncate flex-1">{p.name}</p>
                    <span className="text-xs font-mono tabular-nums text-muted-foreground shrink-0">{formatUSD(p.totalUsd)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Sin datos</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Reports */}
      <Card data-animate-card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Reportes Recientes</CardTitle>
            {recentReports.length > 0 && (
              <Button variant="link" size="sm" className="text-primary gap-1" onClick={() => router.push("/reports")}>
                Ver Todos <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {recentReports.length > 0 ? (
            <div className="space-y-2">
              {recentReports.slice(0, 3).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg p-3 hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => router.push(`/reports/${r.id}`)}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      {r.isLocked ? <Lock className="h-4 w-4 text-green-600" /> : <Unlock className="h-4 w-4 text-amber-500" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize truncate">{formatMonth(r.reportMonth)}</p>
                      <p className="text-xs text-muted-foreground">{r.partnerName}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono tabular-nums font-medium">{formatUSD(r.totalUsd)}</p>
                    <p className="text-xs text-muted-foreground font-mono tabular-nums">{formatMXN(r.totalMxn)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed text-muted-foreground">
              <p className="text-sm">No hay reportes aun</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
