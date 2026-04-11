"use client";

import { useState, useEffect } from "react";
import {
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Pencil,
  Trash2,
  Filter,
  Loader2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAuditLogs, type AuditLogEntry, type AuditLogResult } from "@/actions/audit";
import { displayName, getInitials } from "@/lib/utils";

interface Props {
  initialData: AuditLogResult;
}

const TABLE_LABELS: Record<string, string> = {
  product_distributions: "Distribuciones",
  adjustments: "Ajustes",
  taxes: "Impuestos",
  exchange_rates: "Tipos de Cambio",
  monthly_reports: "Reportes",
  products: "Productos",
  partners: "Partners",
  users: "Usuarios",
};

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  created: { label: "Creado", color: "bg-green-100 text-green-700", icon: Plus },
  updated: { label: "Actualizado", color: "bg-blue-100 text-blue-700", icon: Pencil },
  deleted: { label: "Eliminado", color: "bg-red-100 text-red-700", icon: Trash2 },
};

export function AuditLogClient({ initialData }: Props) {
  const [data, setData] = useState<AuditLogResult>(initialData);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterTable, setFilterTable] = useState("");
  const [filterAction, setFilterAction] = useState("");

  const fetchPage = async (page: number) => {
    setLoading(true);
    const res = await getAuditLogs({
      page,
      tableName: filterTable || undefined,
      actionType: filterAction || undefined,
    });
    setLoading(false);
    if (res.success) {
      setData(res.data);
      setExpandedId(null);
    }
  };

  const applyFilters = () => {
    fetchPage(1);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const renderJsonDiff = (entry: AuditLogEntry) => {
    if (entry.actionType === "created") {
      return (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Valores creados:
          </p>
          <pre className="text-xs bg-green-50 border border-green-200 rounded-md p-3 overflow-x-auto max-h-64">
            {JSON.stringify(entry.newValues, null, 2)}
          </pre>
        </div>
      );
    }

    if (entry.actionType === "deleted") {
      return (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Valores eliminados:
          </p>
          <pre className="text-xs bg-red-50 border border-red-200 rounded-md p-3 overflow-x-auto max-h-64">
            {JSON.stringify(entry.oldValues, null, 2)}
          </pre>
        </div>
      );
    }

    // Updated — show side by side diff
    const oldKeys = Object.keys(entry.oldValues ?? {});
    const newKeys = Object.keys(entry.newValues ?? {});
    const allKeys = Array.from(new Set([...oldKeys, ...newKeys]));
    const changedKeys = allKeys.filter((k) => {
      const old = JSON.stringify(entry.oldValues?.[k]);
      const nw = JSON.stringify(entry.newValues?.[k]);
      return old !== nw;
    });

    if (changedKeys.length === 0) {
      return (
        <p className="text-xs text-muted-foreground">
          Sin cambios detectados en los valores.
        </p>
      );
    }

    return (
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Campos modificados ({changedKeys.length}):
        </p>
        <div className="space-y-2">
          {changedKeys.map((key) => (
            <div
              key={key}
              className="rounded-md border bg-muted/30 p-2 text-xs"
            >
              <p className="font-medium text-foreground mb-1">{key}</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase">
                    Antes
                  </p>
                  <p className="font-mono text-red-700 bg-red-50 rounded px-1 py-0.5 break-all">
                    {JSON.stringify(entry.oldValues?.[key] ?? null)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase">
                    Despues
                  </p>
                  <p className="font-mono text-green-700 bg-green-50 rounded px-1 py-0.5 break-all">
                    {JSON.stringify(entry.newValues?.[key] ?? null)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">
          Historial de cambios en distribuciones, ajustes e impuestos.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Tabla:</span>
              <Select value={filterTable || "all"} onValueChange={(v) => setFilterTable(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.entries(TABLE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Accion:</span>
              <Select value={filterAction || "all"} onValueChange={(v) => setFilterAction(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="created">Creado</SelectItem>
                  <SelectItem value="updated">Actualizado</SelectItem>
                  <SelectItem value="deleted">Eliminado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={applyFilters} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Aplicar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Log entries */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Registro de Auditoria</CardTitle>
              <CardDescription>
                {data.totalCount} registro(s) encontrado(s)
                {data.totalPages > 1 &&
                  ` — Pagina ${data.page} de ${data.totalPages}`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {data.entries.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
              <div className="text-center">
                <ClipboardList className="mx-auto h-10 w-10 mb-3" />
                <p className="font-medium">Sin registros de auditoria</p>
                <p className="text-sm mt-1">
                  Los cambios se registran automaticamente via triggers.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {data.entries.map((entry) => {
                const config = ACTION_CONFIG[entry.actionType] ?? ACTION_CONFIG.updated;
                const ActionIcon = config.icon;
                const isExpanded = expandedId === entry.id;

                return (
                  <div
                    key={entry.id}
                    className="rounded-md border overflow-hidden"
                  >
                    <div
                      className="flex items-center justify-between gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : entry.id)
                      }
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold overflow-hidden">
                          {entry.createdByAvatar ? (
                            <img
                              src={entry.createdByAvatar}
                              alt={entry.createdByName ?? ""}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            getInitials(entry.createdByName ?? "S")
                          )}
                        </div>
                        <Badge
                          variant="secondary"
                          className={`${config.color} gap-1 text-xs shrink-0`}
                        >
                          <ActionIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {TABLE_LABELS[entry.tableName] ?? entry.tableName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {entry.createdByName ? displayName(entry.createdByName) : (entry.createdByEmail ?? "Sistema")}{" "}
                            · {formatDate(entry.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground font-mono">
                          {entry.recordId.substring(0, 8)}...
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t p-3 bg-muted/10">
                        {renderJsonDiff(entry)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Pagina {data.page} de {data.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchPage(data.page - 1)}
                  disabled={data.page <= 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchPage(data.page + 1)}
                  disabled={data.page >= data.totalPages || loading}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
