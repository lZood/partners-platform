"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Lock,
  Unlock,
  Plus,
  Trash2,
  FileDown,
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
import { lockReport, unlockReport } from "@/actions/reports";
import { useToast } from "@/components/shared/toast-provider";
import { formatUSD, formatMXN, formatMonth, formatPercentage } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface Props {
  report: any;
  lineItems: any[];
  adjustments: any[];
  availableUsers: { id: string; name: string }[];
  currentUserId?: string;
}

export function ReportDetailClient({
  report,
  lineItems,
  adjustments,
  availableUsers,
  currentUserId,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [adjDialogOpen, setAdjDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const exchangeRate = Number(report.exchange_rates?.usd_to_mxn ?? 0);
  const isCollaboratorView = !!currentUserId;

  // Group line items by user
  const userSummaries = useMemo(() => {
    const map = new Map<string, any>();

    // Filter line items if this is a collaborator view
    const itemsToProcess = isCollaboratorView
      ? lineItems.filter((item) => item.user_id === currentUserId)
      : lineItems;

    for (const item of itemsToProcess) {
      const uid = item.user_id;
      if (!map.has(uid)) {
        map.set(uid, {
          userId: uid,
          userName: item.users?.name ?? "Desconocido",
          userEmail: item.users?.email ?? null,
          totalGrossUsd: 0,
          totalAfterTaxesUsd: 0,
          totalAdjustmentsUsd: 0,
          totalFinalUsd: 0,
          totalFinalMxn: 0,
          items: [],
        });
      }
      const summary = map.get(uid)!;
      summary.totalGrossUsd += Number(item.gross_usd);
      summary.totalAfterTaxesUsd += Number(item.after_taxes_usd);
      summary.totalFinalUsd += Number(item.final_usd);
      summary.totalFinalMxn += Number(item.final_mxn);
      summary.items.push(item);
    }

    // Add adjustments (filtered for collaborator view)
    const adjsToProcess = isCollaboratorView
      ? adjustments.filter((adj) => adj.user_id === currentUserId)
      : adjustments;

    for (const adj of adjsToProcess) {
      const uid = adj.user_id;
      if (map.has(uid)) {
        const summary = map.get(uid)!;
        const amount =
          adj.adjustment_type === "deduction"
            ? -Math.abs(Number(adj.amount_usd))
            : Number(adj.amount_usd);
        summary.totalAdjustmentsUsd += amount;
        summary.totalFinalUsd += amount;
        summary.totalFinalMxn += amount * exchangeRate;
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.userName.localeCompare(b.userName)
    );
  }, [lineItems, adjustments, exchangeRate, currentUserId, isCollaboratorView]);

  const grandTotalUsd = userSummaries.reduce(
    (sum, u) => sum + u.totalFinalUsd,
    0
  );
  const grandTotalMxn = userSummaries.reduce(
    (sum, u) => sum + u.totalFinalMxn,
    0
  );

  const handleLock = async () => {
    setLoading(true);
    const result = report.is_locked
      ? await unlockReport(report.id)
      : await lockReport(report.id);
    setLoading(false);

    if (result.success) {
      showToast(
        report.is_locked ? "Reporte desbloqueado" : "Reporte congelado",
        "success"
      );
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleAddAdjustment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const supabase = createClient();

    const { data: appUser } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", (await supabase.auth.getUser()).data.user?.id)
      .single();

    const { error } = await supabase.from("adjustments").insert({
      monthly_report_id: report.id,
      user_id: formData.get("userId") as string,
      adjustment_type: formData.get("adjustmentType") as string,
      amount_usd: parseFloat(formData.get("amountUsd") as string),
      description: formData.get("description") as string,
      created_by: appUser?.id,
    });

    setLoading(false);

    if (error) {
      showToast(error.message, "error");
    } else {
      showToast("Ajuste agregado", "success");
      setAdjDialogOpen(false);
      router.refresh();
    }
  };

  const handleDeleteAdjustment = async (adjId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("adjustments")
      .delete()
      .eq("id", adjId);

    if (error) {
      showToast(error.message, "error");
    } else {
      showToast("Ajuste eliminado", "success");
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/reports">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight capitalize">
            {formatMonth(report.report_month)}
          </h1>
          <p className="text-muted-foreground">
            {report.partners?.name} — TC: $
            {exchangeRate.toFixed(5)} MXN/USD
          </p>
        </div>
        <div className="flex items-center gap-2">
          {report.is_locked ? (
            <Badge variant="default" className="gap-1">
              <Lock className="h-3 w-3" />
              Congelado
            </Badge>
          ) : (
            <Badge variant="warning" className="gap-1">
              <Unlock className="h-3 w-3" />
              Abierto
            </Badge>
          )}
          {!isCollaboratorView && (
            <>
              <a href={`/api/reports/${report.id}/pdf`} target="_blank">
                <Button variant="outline" size="sm">
                  <FileDown className="mr-2 h-4 w-4" />
                  Descargar PDF
                </Button>
              </a>
              <Button
                variant={report.is_locked ? "outline" : "default"}
                size="sm"
                onClick={handleLock}
                disabled={loading}
              >
                {report.is_locked ? (
                  <>
                    <Unlock className="mr-2 h-4 w-4" />
                    Desbloquear
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Congelar Reporte
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Bruto USD</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {formatUSD(
                userSummaries.reduce((s, u) => s + u.totalGrossUsd, 0)
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Despues Impuestos USD</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {formatUSD(
                userSummaries.reduce((s, u) => s + u.totalAfterTaxesUsd, 0)
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Neto USD</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {formatUSD(grandTotalUsd)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Neto MXN</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {formatMXN(grandTotalMxn)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Desglose por Colaborador</CardTitle>
          <CardDescription>
            Vista bimonetaria con detalle de impuestos aplicados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-medium text-muted-foreground">Colaborador</th>
                  <th className="pb-3 font-medium text-muted-foreground">Productos</th>
                  <th className="pb-3 font-medium text-muted-foreground text-right">Bruto USD</th>
                  <th className="pb-3 font-medium text-muted-foreground text-right">Post-Tax USD</th>
                  <th className="pb-3 font-medium text-muted-foreground text-right">Ajustes USD</th>
                  <th className="pb-3 font-medium text-muted-foreground text-right">Neto USD</th>
                  <th className="pb-3 font-medium text-muted-foreground text-right">Neto MXN</th>
                </tr>
              </thead>
              <tbody>
                {userSummaries.map((user) => (
                  <tr key={user.userId} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-3">
                      <p className="font-medium">{user.userName}</p>
                      {user.userEmail && (
                        <p className="text-xs text-muted-foreground">{user.userEmail}</p>
                      )}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {user.items.map((item: any, i: number) => (
                        <div key={i} className="text-xs">
                          {item.product_name} ({formatPercentage(Number(item.percentage_applied))})
                        </div>
                      ))}
                    </td>
                    <td className="py-3 text-right font-mono">
                      {formatUSD(user.totalGrossUsd)}
                    </td>
                    <td className="py-3 text-right font-mono">
                      {formatUSD(user.totalAfterTaxesUsd)}
                    </td>
                    <td className="py-3 text-right font-mono">
                      <span className={user.totalAdjustmentsUsd < 0 ? "text-red-600" : user.totalAdjustmentsUsd > 0 ? "text-green-600" : ""}>
                        {user.totalAdjustmentsUsd !== 0 ? formatUSD(user.totalAdjustmentsUsd) : "—"}
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono font-medium">
                      {formatUSD(user.totalFinalUsd)}
                    </td>
                    <td className="py-3 text-right font-mono font-medium">
                      {formatMXN(user.totalFinalMxn)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/50 font-medium">
                  <td className="py-3" colSpan={2}>Total</td>
                  <td className="py-3 text-right font-mono">
                    {formatUSD(userSummaries.reduce((s, u) => s + u.totalGrossUsd, 0))}
                  </td>
                  <td className="py-3 text-right font-mono">
                    {formatUSD(userSummaries.reduce((s, u) => s + u.totalAfterTaxesUsd, 0))}
                  </td>
                  <td className="py-3 text-right font-mono">
                    {formatUSD(userSummaries.reduce((s, u) => s + u.totalAdjustmentsUsd, 0))}
                  </td>
                  <td className="py-3 text-right font-mono">
                    {formatUSD(grandTotalUsd)}
                  </td>
                  <td className="py-3 text-right font-mono">
                    {formatMXN(grandTotalMxn)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Adjustments */}
      {!isCollaboratorView && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Ajustes</CardTitle>
                <CardDescription>
                  Bonos, deducciones y correcciones manuales por usuario
                </CardDescription>
              </div>
              {!report.is_locked && (
              <Dialog open={adjDialogOpen} onOpenChange={setAdjDialogOpen}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAdjDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Ajuste
                </Button>

                <DialogContent>
                  <form onSubmit={handleAddAdjustment}>
                    <DialogHeader>
                      <DialogTitle>Nuevo Ajuste</DialogTitle>
                      <DialogDescription>
                        Agrega un bono, deduccion o correccion al reporte de un
                        usuario.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Colaborador</Label>
                        <select
                          name="userId"
                          required
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Seleccionar</option>
                          {availableUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label>Tipo</Label>
                        <select
                          name="adjustmentType"
                          required
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="bonus">Bono (+)</option>
                          <option value="deduction">Deduccion (-)</option>
                          <option value="correction">Correccion</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label>Monto USD</Label>
                        <Input
                          name="amountUsd"
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="Ej: 50.00"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Descripcion</Label>
                        <Input
                          name="description"
                          placeholder="Ej: Pago Server, Bono Adobe"
                          required
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setAdjDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={loading}>
                        {loading ? "Guardando..." : "Agregar Ajuste"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {adjustments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay ajustes para este reporte.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">Colaborador</th>
                    <th className="pb-3 font-medium text-muted-foreground">Tipo</th>
                    <th className="pb-3 font-medium text-muted-foreground">Descripcion</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Monto USD</th>
                    {!report.is_locked && (
                      <th className="pb-3 font-medium text-muted-foreground text-right">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((adj: any) => (
                    <tr key={adj.id} className="border-b last:border-0">
                      <td className="py-3">{adj.users?.name ?? "—"}</td>
                      <td className="py-3">
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
                            ? "Deduccion"
                            : "Correccion"}
                        </Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {adj.description}
                      </td>
                      <td className="py-3 text-right font-mono">
                        <span
                          className={
                            adj.adjustment_type === "deduction"
                              ? "text-red-600"
                              : "text-green-600"
                          }
                        >
                          {adj.adjustment_type === "deduction" ? "-" : "+"}
                          {formatUSD(Number(adj.amount_usd))}
                        </span>
                      </td>
                      {!report.is_locked && (
                        <td className="py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDeleteAdjustment(adj.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
