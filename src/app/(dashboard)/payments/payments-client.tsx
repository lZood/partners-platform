"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import {
  Wallet,
  ChevronRight,
  Search,
  AlertCircle,
  Clock,
  DollarSign,
  Users,
  Download,
  CheckSquare,
  CreditCard,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatUSD, displayName, getInitials } from "@/lib/utils";
import type { CollaboratorPaymentSummary } from "@/actions/payments";

interface Props {
  summaries: CollaboratorPaymentSummary[];
  partners: { id: string; name: string }[];
  currentPartnerId?: string;
}

export function PaymentsClient({
  summaries,
  partners,
  currentPartnerId,
}: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [selectedPartner, setSelectedPartner] = useState(
    currentPartnerId ?? ""
  );
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll("[data-animate-card]");
    gsap.fromTo(
      cards,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.35, stagger: 0.06, ease: "power2.out" }
    );
  }, []);

  const handlePartnerChange = (value: string) => {
    setSelectedPartner(value);
    router.push(value ? `/payments?partner=${value}` : "/payments");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Only show collaborators with pending amounts in selection
  const pendingCollabs = summaries.filter((s) => s.totalPendingUsd > 0);

  const selectAllPending = () => {
    if (selectedIds.size === pendingCollabs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingCollabs.map((s) => s.userId)));
    }
  };

  const selectedTotal = summaries
    .filter((s) => selectedIds.has(s.userId))
    .reduce((sum, s) => sum + s.totalPendingUsd, 0);

  const filtered = summaries.filter((s) =>
    s.userName.toLowerCase().includes(search.toLowerCase())
  );

  const totalPending = summaries.reduce(
    (sum, s) => sum + s.totalPendingUsd,
    0
  );
  const totalCollaborators = summaries.filter(
    (s) => s.totalPendingUsd > 0
  ).length;

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return "Nunca";
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Hoy";
    if (days === 1) return "Ayer";
    if (days < 30) return `Hace ${days}d`;
    const months = Math.floor(days / 30);
    return `Hace ${months}m`;
  };

  return (
    <div ref={containerRef} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pagos</h1>
          <p className="text-muted-foreground">
            Gestiona los pagos pendientes a colaboradores.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const year = new Date().getFullYear();
              const params = new URLSearchParams();
              params.set("from", `${year}-01-01`);
              params.set("to", `${year}-12-31`);
              if (selectedPartner) params.set("partnerId", selectedPartner);
              window.open(`/api/payments/export?${params}`, "_blank");
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button
            variant={selectionMode ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              setSelectionMode(!selectionMode);
              setSelectedIds(new Set());
            }}
          >
            <CheckSquare className="mr-1.5 h-4 w-4" />
            {selectionMode ? "Cancelar" : "Pago Masivo"}
          </Button>
          {partners.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">Partner:</span>
              <Select value={selectedPartner || "all"} onValueChange={(v) => handlePartnerChange(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {partners.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card data-animate-card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                Total Pendiente
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold">{formatUSD(totalPending)}</p>
          </CardContent>
        </Card>
        <Card data-animate-card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                Con Pagos Pendientes
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold">{totalCollaborators}</p>
          </CardContent>
        </Card>
        <Card data-animate-card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                Colaboradores
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold">{summaries.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar colaborador..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-0 shadow-sm"
        />
      </div>

      {/* Bulk action bar */}
      {selectionMode && selectedIds.size > 0 && (
        <Card data-animate-card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-3 p-3">
            <button onClick={selectAllPending} className="text-xs text-primary hover:underline">
              {selectedIds.size === pendingCollabs.length ? "Deseleccionar todos" : "Seleccionar todos con pendiente"}
            </button>
            <span className="text-xs text-muted-foreground">
              {selectedIds.size} seleccionado(s) · Total: <span className="font-medium text-foreground">{formatUSD(selectedTotal)}</span>
            </span>
            <div className="ml-auto">
              <Button
                size="sm"
                onClick={() => {
                  // Navigate to each selected collaborator's payment page sequentially
                  // For now, open each in a new sequence
                  const ids = Array.from(selectedIds);
                  if (ids.length === 1) {
                    router.push(`/payments/${ids[0]}`);
                  } else {
                    // Store selected IDs and open first one
                    sessionStorage.setItem("bulk-payment-queue", JSON.stringify(ids));
                    router.push(`/payments/${ids[0]}?bulk=true`);
                  }
                }}
              >
                <CreditCard className="mr-1.5 h-4 w-4" />
                Registrar Pagos ({selectedIds.size})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Collaborator cards */}
      {filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex h-[200px] items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Wallet className="mx-auto h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No hay colaboradores con pagos</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((collab) => (
            <Card
              key={collab.userId}
              data-animate-card
              className="border-0 shadow-sm transition-card hover-lift cursor-pointer group"
              onClick={() => {
                if (selectionMode && collab.totalPendingUsd > 0) {
                  toggleSelect(collab.userId);
                } else {
                  router.push(`/payments/${collab.userId}`);
                }
              }}
            >
              <CardContent className="flex items-center gap-4 p-4">
                {/* Checkbox */}
                {selectionMode && collab.totalPendingUsd > 0 && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(collab.userId)}
                    onChange={() => toggleSelect(collab.userId)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-border accent-primary shrink-0"
                  />
                )}
                {/* Avatar */}
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold overflow-hidden">
                  {collab.avatarUrl ? (
                    <img
                      src={collab.avatarUrl}
                      alt={collab.userName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getInitials(collab.userName)
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {displayName(collab.userName)}
                    </p>
                    {collab.unpaidMonths >= 3 && (
                      <Badge
                        variant="destructive"
                        className="text-[10px] gap-1"
                      >
                        <AlertCircle className="h-3 w-3" />
                        {collab.unpaidMonths} meses
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {collab.partners.join(", ")}
                    {collab.lastPaymentDate && (
                      <> · Ultimo pago: {formatTimeAgo(collab.lastPaymentDate)}</>
                    )}
                  </p>
                </div>

                {/* Amounts */}
                <div className="text-right shrink-0">
                  {collab.totalPendingUsd > 0 ? (
                    <>
                      <p className="text-sm font-mono font-bold tabular-nums text-red-600">
                        {formatUSD(collab.totalPendingUsd)}
                      </p>
                      <div className="flex gap-2 text-[10px] text-muted-foreground">
                        {collab.unpaidEarningsUsd > 0 && (
                          <span>
                            Comisiones: {formatUSD(collab.unpaidEarningsUsd)}
                          </span>
                        )}
                        {collab.unpaidConceptsUsd > 0 && (
                          <span>
                            Extras: {formatUSD(collab.unpaidConceptsUsd)}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <Badge variant="success" className="text-[10px]">
                      Al dia
                    </Badge>
                  )}
                </div>

                {/* Arrow */}
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
