"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import {
  ArrowLeft,
  Wallet,
  Plus,
  Trash2,
  FileText,
  CheckCircle2,
  Clock,
  Download,
  DollarSign,
  Briefcase,
  Gift,
  MinusCircle,
  Star,
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
  createPaymentConcept,
  deletePaymentConcept,
  registerPayment,
} from "@/actions/payments";
import type { UserPaymentDetail } from "@/actions/payments";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/shared/toast-provider";
import {
  formatUSD,
  formatMXN,
  formatMonth,
  displayName,
  getInitials,
} from "@/lib/utils";

interface Props {
  data: UserPaymentDetail;
  partners: { id: string; name: string }[];
  defaultExchangeRate: number;
}

const conceptTypeLabels: Record<string, { label: string; icon: typeof Star }> = {
  commission: { label: "Comision", icon: Star },
  work: { label: "Trabajo", icon: Briefcase },
  bonus: { label: "Bono", icon: Gift },
  deduction: { label: "Deduccion", icon: MinusCircle },
};

export function PaymentDetailClient({
  data,
  partners,
  defaultExchangeRate,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [conceptDialogOpen, setConceptDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);

  // Payment selection
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [selectedConcepts, setSelectedConcepts] = useState<Set<string>>(new Set());
  const [exchangeRate, setExchangeRate] = useState(defaultExchangeRate);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Concept dialog form state
  const [conceptPartnerId, setConceptPartnerId] = useState(partners[0]?.id ?? "");
  const [conceptType, setConceptType] = useState("commission");

  useEffect(() => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll("[data-animate-card]");
    gsap.fromTo(
      cards,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.35, stagger: 0.06, ease: "power2.out" }
    );
  }, []);

  const toggleReport = (id: string) => {
    const next = new Set(selectedReports);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedReports(next);
  };

  const toggleConcept = (id: string) => {
    const next = new Set(selectedConcepts);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedConcepts(next);
  };

  const selectAll = () => {
    setSelectedReports(new Set(data.unpaidEarnings.map((e) => e.reportId)));
    setSelectedConcepts(new Set(data.unpaidConcepts.map((c) => c.id)));
  };

  const selectedTotal = (() => {
    let usd = 0;
    for (const e of data.unpaidEarnings) {
      if (selectedReports.has(e.reportId)) usd += e.totalFinalUsd;
    }
    for (const c of data.unpaidConcepts) {
      if (selectedConcepts.has(c.id)) usd += c.amountUsd;
    }
    return Math.round(usd * 100) / 100;
  })();

  const handleAddConcept = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    formData.set("userId", data.userId);
    const result = await createPaymentConcept(formData);
    setSaving(false);
    if (result.success) {
      showToast("Concepto agregado", "success");
      setConceptDialogOpen(false);
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleDeleteConcept = async (id: string) => {
    if (!confirm("Eliminar este concepto?")) return;
    const result = await deletePaymentConcept(id, data.userId);
    if (result.success) {
      showToast("Concepto eliminado", "success");
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleRegisterPayment = async () => {
    if (selectedReports.size === 0 && selectedConcepts.size === 0) {
      showToast("Selecciona al menos un item", "error");
      return;
    }

    // Determine partner from first selected item
    let partnerId = "";
    for (const e of data.unpaidEarnings) {
      if (selectedReports.has(e.reportId)) {
        partnerId = e.partnerId;
        break;
      }
    }
    if (!partnerId) {
      for (const c of data.unpaidConcepts) {
        if (selectedConcepts.has(c.id)) {
          partnerId = c.partnerId;
          break;
        }
      }
    }

    setSaving(true);
    const result = await registerPayment({
      partnerId,
      userId: data.userId,
      reportIds: Array.from(selectedReports),
      conceptIds: Array.from(selectedConcepts),
      exchangeRate,
      paymentMethod: paymentMethod || undefined,
      notes: paymentNotes || undefined,
    });
    setSaving(false);

    if (result.success) {
      showToast("Pago registrado exitosamente", "success");
      setPayDialogOpen(false);
      setSelectedReports(new Set());
      setSelectedConcepts(new Set());
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const totalPendingUsd =
    data.unpaidEarnings.reduce((s, e) => s + e.totalFinalUsd, 0) +
    data.unpaidConcepts.reduce((s, c) => s + c.amountUsd, 0);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => router.push("/payments")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold overflow-hidden">
          {data.avatarUrl ? (
            <img
              src={data.avatarUrl}
              alt={data.userName}
              className="h-full w-full object-cover"
            />
          ) : (
            getInitials(data.userName)
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {displayName(data.userName)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.userEmail ?? "Sin email"} · Pendiente:{" "}
            <span className="font-medium text-red-600">
              {formatUSD(totalPendingUsd)}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          {(data.unpaidEarnings.length > 0 ||
            data.unpaidConcepts.length > 0) && (
            <Button
              onClick={() => {
                selectAll();
                setPayDialogOpen(true);
              }}
            >
              <Wallet className="mr-2 h-4 w-4" />
              Registrar Pago
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card data-animate-card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Meses sin pagar</p>
            <p className="text-xl font-bold">
              {data.unpaidEarnings.length}
            </p>
          </CardContent>
        </Card>
        <Card data-animate-card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Conceptos extras</p>
            <p className="text-xl font-bold">
              {data.unpaidConcepts.length}
            </p>
          </CardContent>
        </Card>
        <Card data-animate-card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pagos realizados</p>
            <p className="text-xl font-bold">{data.payments.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Unpaid Earnings */}
      <Card data-animate-card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Comisiones Pendientes</CardTitle>
          <CardDescription>
            Ganancias por productos de reportes no pagados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.unpaidEarnings.length > 0 ? (
            <div className="space-y-2">
              {data.unpaidEarnings.map((earning) => (
                <div
                  key={earning.reportId}
                  className={`flex items-center gap-3 rounded-lg p-3 transition-colors cursor-pointer ${
                    selectedReports.has(earning.reportId)
                      ? "bg-primary/5 ring-1 ring-primary/20"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => toggleReport(earning.reportId)}
                >
                  <input
                    type="checkbox"
                    checked={selectedReports.has(earning.reportId)}
                    onChange={() => toggleReport(earning.reportId)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize">
                      {formatMonth(earning.reportMonth)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {earning.partnerName}
                      {earning.isLocked && (
                        <Badge
                          variant="success"
                          className="ml-1.5 text-[9px] px-1"
                        >
                          Bloqueado
                        </Badge>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono font-medium tabular-nums">
                      {formatUSD(earning.totalFinalUsd)}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono tabular-nums">
                      {formatMXN(earning.totalFinalMxn)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-[100px] items-center justify-center rounded-lg border border-dashed text-muted-foreground">
              <div className="text-center">
                <CheckCircle2 className="mx-auto h-6 w-6 mb-1 text-green-500" />
                <p className="text-sm">Todo pagado</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Extra Concepts */}
      <Card data-animate-card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Conceptos Extras</CardTitle>
              <CardDescription>
                Comisiones, trabajos, bonos y deducciones
              </CardDescription>
            </div>
            <Dialog
              open={conceptDialogOpen}
              onOpenChange={setConceptDialogOpen}
            >
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConceptDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Agregar Concepto
              </Button>

              <DialogContent>
                <form onSubmit={handleAddConcept}>
                  <DialogHeader>
                    <DialogTitle>Nuevo Concepto</DialogTitle>
                    <DialogDescription>
                      Agrega un pago adicional para{" "}
                      {displayName(data.userName)}.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Partner</Label>
                      <input type="hidden" name="partnerId" value={conceptPartnerId} />
                      <Select value={conceptPartnerId || undefined} onValueChange={setConceptPartnerId}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                        <SelectContent>
                          {partners.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <input type="hidden" name="conceptType" value={conceptType} />
                      <Select value={conceptType || undefined} onValueChange={setConceptType}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="commission">Comision</SelectItem>
                          <SelectItem value="work">Trabajo realizado</SelectItem>
                          <SelectItem value="bonus">Bono</SelectItem>
                          <SelectItem value="deduction">Deduccion</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Descripcion</Label>
                      <Input
                        name="description"
                        placeholder="Ej: Diseno de 3 skins, Bono Q4..."
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Monto USD</Label>
                        <Input
                          name="amountUsd"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fecha</Label>
                        <Input
                          name="conceptDate"
                          type="date"
                          defaultValue={
                            new Date().toISOString().split("T")[0]
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConceptDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Guardando..." : "Agregar"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {data.unpaidConcepts.length > 0 ? (
            <div className="space-y-2">
              {data.unpaidConcepts.map((concept) => {
                const config = conceptTypeLabels[concept.conceptType];
                const Icon = config?.icon ?? Star;
                return (
                  <div
                    key={concept.id}
                    className={`flex items-center gap-3 rounded-lg p-3 transition-colors cursor-pointer ${
                      selectedConcepts.has(concept.id)
                        ? "bg-primary/5 ring-1 ring-primary/20"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => toggleConcept(concept.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedConcepts.has(concept.id)}
                      onChange={() => toggleConcept(concept.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {concept.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {config?.label ?? concept.conceptType} ·{" "}
                        {concept.partnerName} · {formatDate(concept.conceptDate)}
                      </p>
                    </div>
                    <p
                      className={`text-sm font-mono font-medium tabular-nums shrink-0 ${
                        concept.conceptType === "deduction"
                          ? "text-red-600"
                          : ""
                      }`}
                    >
                      {concept.conceptType === "deduction" ? "-" : ""}
                      {formatUSD(Math.abs(concept.amountUsd))}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConcept(concept.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-[80px] items-center justify-center rounded-lg border border-dashed text-muted-foreground">
              <p className="text-sm">Sin conceptos extras pendientes</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selection summary + Pay button */}
      {(selectedReports.size > 0 || selectedConcepts.size > 0) && (
        <Card className="border-0 shadow-sm bg-primary/5 sticky bottom-4 z-10">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium">
                {selectedReports.size + selectedConcepts.size} item(s)
                seleccionado(s)
              </p>
              <p className="text-2xl font-bold">{formatUSD(selectedTotal)}</p>
            </div>
            <Button onClick={() => setPayDialogOpen(true)}>
              <Wallet className="mr-2 h-4 w-4" />
              Registrar Pago
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pay dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Pago</DialogTitle>
            <DialogDescription>
              Registrar pago para {displayName(data.userName)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">Total a pagar</p>
              <p className="text-3xl font-bold">{formatUSD(selectedTotal)}</p>
              <p className="text-sm text-muted-foreground">
                ≈ {formatMXN(selectedTotal * exchangeRate)}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Tipo de cambio USD/MXN</Label>
              <Input
                type="number"
                step="0.01"
                value={exchangeRate}
                onChange={(e) =>
                  setExchangeRate(parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Metodo de pago (opcional)</Label>
              <Input
                placeholder="Ej: Transferencia SPEI, Efectivo..."
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Input
                placeholder="Notas adicionales del pago..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPayDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleRegisterPayment} disabled={saving}>
              {saving ? "Procesando..." : "Confirmar Pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment History */}
      <Card data-animate-card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Historial de Pagos</CardTitle>
          <CardDescription>
            {data.payments.length} pago(s) registrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.payments.length > 0 ? (
            <div className="space-y-3">
              {data.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {formatUSD(payment.totalUsd)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(payment.paidAt)}
                          {payment.paymentMethod &&
                            ` · ${payment.paymentMethod}`}
                          {payment.createdByName &&
                            ` · por ${displayName(payment.createdByName)}`}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(
                          `/api/payments/${payment.id}/receipt`,
                          "_blank"
                        )
                      }
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Recibo
                    </Button>
                  </div>
                  {/* Items breakdown */}
                  <div className="space-y-1 pl-12">
                    {payment.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-muted-foreground">
                          {item.description}
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatUSD(item.amountUsd)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {payment.notes && (
                    <p className="text-xs text-muted-foreground pl-12 italic">
                      {payment.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed text-muted-foreground">
              <div className="text-center">
                <Clock className="mx-auto h-6 w-6 mb-1 opacity-40" />
                <p className="text-sm">Sin pagos registrados</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
