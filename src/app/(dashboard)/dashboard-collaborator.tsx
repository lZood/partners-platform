"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { AreaChart } from "@tremor/react";
import {
  DollarSign,
  Wallet,
  Package,
  CreditCard,
  Download,
  Bell,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Clock,
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
  formatUSD,
  formatMXN,
  formatPercentage,
  displayName,
} from "@/lib/utils";
import type {
  CollaboratorDashboardData,
  CalendarEvent,
  Notification,
} from "@/actions/dashboard";

interface Props {
  data: CollaboratorDashboardData;
  userName: string;
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
          <span key={d} className="text-[10px] text-muted-foreground font-medium">{d}</span>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => (
          <span key={`e-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayEvents = eventDates.get(day);
          const isToday = day === today;
          return (
            <div
              key={day}
              className={`relative flex items-center justify-center h-7 w-7 mx-auto rounded-full text-xs ${
                isToday ? "bg-primary text-primary-foreground font-bold" : "text-foreground"
              }`}
            >
              {day}
              {dayEvents && (
                <span className="absolute -bottom-0.5">
                  <span className="h-1 w-1 rounded-full bg-green-500 inline-block" />
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Pagos recibidos
        </span>
      </div>
    </div>
  );
}

export function DashboardCollaborator({ data, userName }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const { stats, monthlyTrends, lastPayment, myProducts } = data;

  useEffect(() => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll("[data-animate-card]");
    gsap.fromTo(
      cards,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: "power2.out" }
    );
  }, []);

  const monthRef = useCountUp(stats.currentMonthUsd);
  const totalRef = useCountUp(stats.totalAccumulatedUsd);
  const pendingTotal = data.pendingPaymentUsd + data.pendingConceptsUsd;

  const usdFormatter = (v: number) => formatUSD(v);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const icons: Record<string, typeof Bell> = {
    payment_received: Wallet,
  };
  const colors: Record<string, string> = {
    payment_received: "text-green-500",
  };

  return (
    <div ref={containerRef} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card data-animate-card className="transition-card hover-lift border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">Mes Actual</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <DollarSign className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold">$<span ref={monthRef}>0</span></p>
                <p className="text-xs text-muted-foreground mt-1">{formatMXN(stats.currentMonthMxn)}</p>
              </CardContent>
            </Card>

            <Card data-animate-card className="transition-card hover-lift border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">Acumulado</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold">$<span ref={totalRef}>0</span></p>
                <p className="text-xs text-muted-foreground mt-1">Total historico</p>
              </CardContent>
            </Card>

            <Card data-animate-card className="transition-card hover-lift border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">Pagos</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                    <CreditCard className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{stats.totalPaymentsReceived}</p>
                <p className="text-xs text-muted-foreground mt-1">Recibidos</p>
              </CardContent>
            </Card>

            <Card data-animate-card className="transition-card hover-lift border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">Productos</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Package className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{stats.assignedProducts}</p>
                <p className="text-xs text-muted-foreground mt-1">Asignados</p>
              </CardContent>
            </Card>
          </div>

          {/* Pending payment alert */}
          {pendingTotal > 0 && (
            <Card data-animate-card className="border-0 shadow-sm bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Wallet className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Pagos Pendientes</p>
                    <p className="text-xs text-amber-600">
                      Comisiones: {formatUSD(data.pendingPaymentUsd)}
                      {data.pendingConceptsUsd > 0 && (
                        <> · Extras: {formatUSD(data.pendingConceptsUsd)}</>
                      )}
                    </p>
                  </div>
                </div>
                <p className="text-xl font-bold text-amber-800">{formatUSD(pendingTotal)}</p>
              </CardContent>
            </Card>
          )}

          {/* Last payment */}
          {lastPayment && (
            <Card data-animate-card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ultimo Pago Recibido</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{formatUSD(lastPayment.totalUsd)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(lastPayment.paidAt)}
                        {lastPayment.paymentMethod && ` · ${lastPayment.paymentMethod}`}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/api/payments/${lastPayment.id}/receipt`, "_blank")}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Recibo
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* My earnings trend */}
          <Card data-animate-card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Mis Ganancias</CardTitle>
              <CardDescription>Ultimos 12 meses</CardDescription>
            </CardHeader>
            <CardContent>
              {monthlyTrends.length > 0 ? (
                <AreaChart
                  className="h-56"
                  data={monthlyTrends}
                  index="label"
                  categories={["totalUsd"]}
                  colors={["blue"]}
                  valueFormatter={usdFormatter}
                  yAxisWidth={72}
                  showLegend={false}
                  curveType="monotone"
                />
              ) : (
                <div className="flex h-56 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                  <div className="text-center">
                    <TrendingUp className="mx-auto h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">Sin datos de ganancias aun</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Calendar */}
          <Card data-animate-card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Calendario
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MiniCalendar events={data.calendar} />
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card data-animate-card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" /> Notificaciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.notifications.length > 0 ? (
                <div className="space-y-3">
                  {data.notifications.map((n) => {
                    const Icon = icons[n.type] ?? Bell;
                    const color = colors[n.type] ?? "text-muted-foreground";
                    const diff = Date.now() - new Date(n.timestamp).getTime();
                    const mins = Math.floor(diff / 60000);
                    const timeAgo = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`;
                    return (
                      <div key={n.id} className="flex items-start gap-2.5">
                        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                        <p className="text-xs leading-relaxed flex-1">{n.message}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">Sin notificaciones</p>
              )}
            </CardContent>
          </Card>

          {/* My Products */}
          <Card data-animate-card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Mis Productos</CardTitle>
            </CardHeader>
            <CardContent>
              {myProducts.length > 0 ? (
                <div className="space-y-2">
                  {myProducts.map((p) => (
                    <div key={p.name} className="flex items-center justify-between rounded-lg p-3 bg-muted/30">
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.productType}</p>
                      </div>
                      <Badge variant="outline" className="font-mono">
                        {formatPercentage(p.percentageShare)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Sin productos asignados</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
