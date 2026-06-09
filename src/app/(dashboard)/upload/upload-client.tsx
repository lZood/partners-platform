"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  CheckCircle,
  WarningCircle,
  Warning,
  X,
  CircleNotch,
  Package,
  Hash,
  ArrowsDownUp,
  Plus,
  Check,
  ArrowsClockwise,
  ShieldWarning,
  Lock,
  Clock,
  ArrowsLeftRight,
  ArrowLeft,
} from "@phosphor-icons/react";
import Link from "next/link";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/shared/toast-provider";
import {
  generateReport,
  checkExistingReport,
  type ExistingReportInfo,
} from "@/actions/reports";
import {
  matchCsvProducts,
  autoRegisterProducts,
  type ProductMatchResult,
} from "@/actions/products";
import { formatUSD, formatMXN, formatMonth } from "@/lib/utils";
import {
  parseMicrosoftCSV,
  aggregatedToCsvRows,
  type AggregatedProduct,
} from "@/lib/csv/parser";

interface Props {
  partners: { id: string; name: string }[];
  productTypes: { id: string; name: string }[];
  defaultPartnerId?: string;
}

type SortField = "productName" | "totalUsd" | "transactionCount";
type SortDir = "asc" | "desc";

const MONTHS = [
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
] as const;

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 4 }, (_, i) => String(CURRENT_YEAR - 2 + i));

export function UploadClient({
  partners,
  productTypes,
  defaultPartnerId,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();

  // Step 1: Config
  const [partnerId, setPartnerId] = useState(defaultPartnerId ?? "");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [exchangeRate, setExchangeRate] = useState("");

  const month = selectedMonth && selectedYear ? `${selectedYear}-${selectedMonth}` : "";

  const handleMonthFieldChange = (field: "month" | "year", val: string) => {
    if (field === "month") setSelectedMonth(val);
    else setSelectedYear(val);
    setExistingReport(null);
    setConflictChecked(false);
    setReplaceConfirmed(false);
  };

  // Step 2: File
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Step 3: Parsed products
  const [products, setProducts] = useState<AggregatedProduct[]>([]);
  const [rawRowCount, setRawRowCount] = useState(0);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>("totalUsd");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Step 4: Product matching
  const [matchResults, setMatchResults] = useState<ProductMatchResult[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);

  // Step 5: Conflict detection
  const [existingReport, setExistingReport] =
    useState<ExistingReportInfo | null>(null);
  const [conflictChecked, setConflictChecked] = useState(false);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);

  // Step 6: Processing & result
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [processError, setProcessError] = useState<{
    invalidDistribution: {
      name: string;
      productId: string | null;
      distTotal: number;
    }[];
    notFound: string[];
  } | null>(null);

  const configValid =
    partnerId && month && exchangeRate && parseFloat(exchangeRate) > 0;

  // ── File handling ──────────────────────────────────────────────────

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    setProcessError(null);
    setMatchResults([]);
    setExistingReport(null);
    setConflictChecked(false);
    setReplaceConfirmed(false);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseMicrosoftCSV(text);
      setProducts(parsed.products);
      setRawRowCount(parsed.rawRowCount);
      setParseErrors(
        parsed.errors.filter(
          (e) => !e.includes("sin nombre de producto fueron omitidas")
        )
      );
    };
    reader.readAsText(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".csv") || f.type === "text/csv")) handleFile(f);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragActive(false), []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const clearFile = () => {
    setFile(null);
    setProducts([]);
    setRawRowCount(0);
    setParseErrors([]);
    setMatchResults([]);
    setExistingReport(null);
    setConflictChecked(false);
    setReplaceConfirmed(false);
    setResult(null);
    setProcessError(null);
  };

  // ── Sorting ────────────────────────────────────────────────────────

  const totalUsd = products.reduce((sum, p) => sum + p.totalUsd, 0);
  const totalTransactions = products.reduce(
    (sum, p) => sum + p.transactionCount,
    0
  );

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir(field === "productName" ? "asc" : "desc");
    }
  };

  const sortedProducts = [...products].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortField === "productName")
      return mul * a.productName.localeCompare(b.productName);
    return mul * (a[sortField] - b[sortField]);
  });

  // ── Product matching ───────────────────────────────────────────────

  const handleCheckProducts = async () => {
    if (!configValid || products.length === 0) return;

    setMatchLoading(true);
    const csvProducts = products.map((p) => ({
      productName: p.productName,
      productType: p.productType,
    }));

    const res = await matchCsvProducts(partnerId, csvProducts);
    setMatchLoading(false);

    if (res.success) {
      setMatchResults(res.data);
    } else {
      showToast(res.error ?? "Error verificando productos", "error");
    }
  };

  const unmatchedProducts = matchResults.filter(
    (r) => r.status === "unmatched"
  );
  const matchedProducts = matchResults.filter((r) => r.status === "matched");
  const allMatched = matchResults.length > 0 && unmatchedProducts.length === 0;

  const handleAutoRegister = async () => {
    if (unmatchedProducts.length === 0) return;

    setRegisterLoading(true);
    const toRegister = unmatchedProducts.map((p) => ({
      productName: p.productName,
      productType: p.productType,
    }));

    const res = await autoRegisterProducts(partnerId, toRegister);
    setRegisterLoading(false);

    if (res.success) {
      showToast(
        `${res.data.created} producto(s) registrado(s) exitosamente`,
        "success"
      );
      await handleCheckProducts();
    } else {
      showToast(res.error ?? "Error registrando productos", "error");
    }
  };

  // ── Conflict detection ─────────────────────────────────────────────

  const handleCheckConflicts = async () => {
    if (!configValid) return;

    setConflictLoading(true);
    const reportMonth = `${month}-01`;
    const res = await checkExistingReport(partnerId, reportMonth);
    setConflictLoading(false);

    if (res.success) {
      setExistingReport(res.data);
      setConflictChecked(true);
      setReplaceConfirmed(false);
    } else {
      showToast(res.error ?? "Error verificando conflictos", "error");
    }
  };

  // ── Report generation ──────────────────────────────────────────────

  const handleProcess = async () => {
    if (!configValid || products.length === 0) return;

    setProcessing(true);
    setProcessError(null);
    const reportMonth = `${month}-01`;
    const rows = aggregatedToCsvRows(products);

    const res = await generateReport({
      partnerId,
      reportMonth,
      usdToMxn: parseFloat(exchangeRate),
      rows,
      filename: file?.name ?? "upload.csv",
    });

    setProcessing(false);

    if (res.success) {
      setResult(res.data);
      const adjMsg = res.data.migratedAdjustments > 0
        ? ` (${res.data.migratedAdjustments} ajuste(s) migrado(s))`
        : "";
      showToast(
        `Reporte ${existingReport ? "reemplazado" : "generado"}: ${res.data.processedProducts} items procesados${adjMsg}`,
        "success"
      );
    } else if (res.data?.code === "no_products_processed") {
      setProcessError({
        invalidDistribution: res.data.invalidDistribution ?? [],
        notFound: res.data.notFound ?? [],
      });
      showToast(
        "No se pudo generar el reporte. Revisa las distribuciones.",
        "error"
      );
    } else {
      showToast(res.error ?? "Error al procesar", "error");
    }
  };

  // ── Helper: format date nicely ─────────────────────────────────────
  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  // Whether we can proceed to generate
  const canGenerate =
    allMatched && conflictChecked && (!existingReport || replaceConfirmed);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Reportes
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Nuevo Reporte</h1>
        <p className="text-sm text-muted-foreground">
          Sube el archivo Earnings CSV de Microsoft para generar un reporte
          mensual.
        </p>
      </div>

      {/* ── Step 1: Configuration ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              1
            </span>
            Configuracion
          </CardTitle>
          <CardDescription>
            Selecciona el partner, mes y el tipo de cambio del deposito
            bancario.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Partner</Label>
              <Select
                value={partnerId || undefined}
                onValueChange={(val) => {
                  setPartnerId(val);
                  setMatchResults([]);
                  setExistingReport(null);
                  setConflictChecked(false);
                  setReplaceConfirmed(false);
                  setResult(null);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar Partner" /></SelectTrigger>
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
              <Label>Mes / Año</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={selectedMonth || undefined}
                  onValueChange={(val) => handleMonthFieldChange("month", val)}
                >
                  <SelectTrigger><SelectValue placeholder="Mes" /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedYear || undefined}
                  onValueChange={(val) => handleMonthFieldChange("year", val)}
                >
                  <SelectTrigger><SelectValue placeholder="Año" /></SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo de cambio (USD → MXN)</Label>
              <Input
                type="number"
                step="0.00001"
                min="0"
                placeholder="Ej: 17.21700"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
              />
            </div>
          </div>
          {configValid && (
            <p className="mt-3 text-sm text-green-600 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              Configuracion lista
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Step 2: File Upload ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              2
            </span>
            Archivo CSV
          </CardTitle>
          <CardDescription>
            Arrastra el archivo Earnings CSV de Microsoft o haz clic para
            seleccionarlo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {file ? (
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <FileText className="h-8 w-8 text-primary" />
              <div className="flex-1">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {rawRowCount.toLocaleString()} transacciones →{" "}
                  {products.length} productos unicos — {formatUSD(totalUsd)}{" "}
                  total bruto
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={clearFile}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`flex h-[180px] items-center justify-center rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onClick={() =>
                document.getElementById("csv-file-input")?.click()
              }
            >
              <div className="text-center">
                <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">
                  Arrastra tu archivo CSV aqui
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  o haz clic para seleccionar (.csv)
                </p>
              </div>
              <input
                id="csv-file-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          )}

          {parseErrors.length > 0 && (
            <div className="mt-4 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 p-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1 flex items-center gap-1">
                <WarningCircle className="h-4 w-4" />
                Advertencias ({parseErrors.length}):
              </p>
              {parseErrors.slice(0, 5).map((err, i) => (
                <p key={i} className="text-xs text-amber-700 dark:text-amber-300/90">
                  {err}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Step 3: Preview ───────────────────────────────────────── */}
      {products.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    3
                  </span>
                  Previsualizacion
                </CardTitle>
                <CardDescription>
                  {products.length} productos agregados desde{" "}
                  {rawRowCount.toLocaleString()} transacciones —{" "}
                  {formatUSD(totalUsd)} total bruto
                  {exchangeRate &&
                    ` — $${(totalUsd * parseFloat(exchangeRate)).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`}
                </CardDescription>
              </div>
              <Button
                onClick={handleCheckProducts}
                disabled={!configValid || matchLoading}
              >
                {matchLoading ? (
                  <>
                    <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : matchResults.length > 0 ? (
                  "Re-verificar Productos"
                ) : (
                  "Verificar Productos"
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="secondary" className="gap-1">
                <Package className="h-3 w-3" />
                {products.length} productos
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Hash className="h-3 w-3" />
                {totalTransactions.toLocaleString()} transacciones
              </Badge>
              <Badge variant="outline" className="gap-1 font-mono">
                {formatUSD(totalUsd)} bruto
              </Badge>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="py-2 px-3 text-left font-medium text-muted-foreground w-10">
                      #
                    </th>
                    <th
                      className="py-2 px-3 text-left font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                      onClick={() => toggleSort("productName")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Producto
                        {sortField === "productName" && (
                          <ArrowsDownUp className="h-3 w-3" />
                        )}
                      </span>
                    </th>
                    <th className="py-2 px-3 text-left font-medium text-muted-foreground">
                      Tipo
                    </th>
                    {matchResults.length > 0 && (
                      <th className="py-2 px-3 text-center font-medium text-muted-foreground">
                        Estado
                      </th>
                    )}
                    <th
                      className="py-2 px-3 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                      onClick={() => toggleSort("transactionCount")}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        Ventas
                        {sortField === "transactionCount" && (
                          <ArrowsDownUp className="h-3 w-3" />
                        )}
                      </span>
                    </th>
                    <th
                      className="py-2 px-3 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                      onClick={() => toggleSort("totalUsd")}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        Total USD
                        {sortField === "totalUsd" && (
                          <ArrowsDownUp className="h-3 w-3" />
                        )}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProducts.map((product, i) => {
                    const match = matchResults.find(
                      (m) =>
                        m.productName.toLowerCase() ===
                        product.productName.toLowerCase()
                    );
                    return (
                      <tr
                        key={product.productName}
                        className="border-b last:border-0 hover:bg-muted/30"
                      >
                        <td className="py-2 px-3 text-muted-foreground">
                          {i + 1}
                        </td>
                        <td className="py-2 px-3 font-medium">
                          {product.productName}
                        </td>
                        <td className="py-2 px-3">
                          {product.productType ? (
                            <Badge variant="outline" className="text-xs">
                              {product.productType}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        {matchResults.length > 0 && (
                          <td className="py-2 px-3 text-center">
                            {match?.status === "matched" ? (
                              <Badge
                                variant="secondary"
                                className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs gap-1"
                              >
                                <Check className="h-3 w-3" />
                                Registrado
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs gap-1"
                              >
                                <Warning className="h-3 w-3" />
                                No registrado
                              </Badge>
                            )}
                          </td>
                        )}
                        <td className="py-2 px-3 text-right text-muted-foreground tabular-nums">
                          {product.transactionCount.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {formatUSD(product.totalUsd)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-muted/50 font-medium">
                    <td
                      className="py-2 px-3"
                      colSpan={matchResults.length > 0 ? 4 : 3}
                    >
                      Total
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {totalTransactions.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      {formatUSD(totalUsd)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 4: Product Matching Result ───────────────────────── */}
      {matchResults.length > 0 && (
        <Card
          className={
            allMatched
              ? "border-green-200 dark:border-green-900"
              : "border-amber-200 dark:border-amber-900"
          }
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                4
              </span>
              {allMatched
                ? "Todos los productos estan registrados"
                : "Productos no registrados"}
            </CardTitle>
            <CardDescription>
              {allMatched ? (
                <span className="text-green-700 dark:text-green-400">
                  Los {matchedProducts.length} productos del CSV coinciden con
                  productos en la base de datos.
                </span>
              ) : (
                <span className="text-amber-700 dark:text-amber-400">
                  {unmatchedProducts.length} de {matchResults.length}{" "}
                  producto(s) no estan registrados. Registralos antes de
                  continuar.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          {!allMatched && (
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-md border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
                  <div className="px-4 py-2 bg-amber-100/50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Productos por registrar ({unmatchedProducts.length})
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-px bg-amber-100 dark:bg-amber-900/40 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {unmatchedProducts.map((p) => {
                      const product = products.find(
                        (pr) =>
                          pr.productName.toLowerCase() ===
                          p.productName.toLowerCase()
                      );
                      return (
                        <div
                          key={p.productName}
                          className="flex items-center justify-between gap-2 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-2"
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="truncate font-medium text-sm">
                              {p.productName}
                            </span>
                            {p.productType && (
                              <Badge
                                variant="outline"
                                className="shrink-0 text-xs"
                              >
                                {p.productType}
                              </Badge>
                            )}
                          </div>
                          {product && (
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              {formatUSD(product.totalUsd)} ·{" "}
                              {product.transactionCount}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleAutoRegister}
                    disabled={registerLoading}
                  >
                    {registerLoading ? (
                      <>
                        <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                        Registrando...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Registrar {unmatchedProducts.length} producto(s)
                        automaticamente
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground self-center">
                    Los productos se crearan con el tipo{" "}
                    {unmatchedProducts.some((p) => p.productType)
                      ? "detectado del CSV"
                      : "por defecto"}
                    . Puedes modificar los detalles luego en Productos.
                  </p>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Step 5: Conflict Detection ───────────────────────────── */}
      {allMatched && !result && (
        <Card
          className={
            conflictChecked
              ? existingReport
                ? existingReport.isLocked
                  ? "border-red-300 dark:border-red-900"
                  : replaceConfirmed
                    ? "border-amber-200 dark:border-amber-900"
                    : "border-amber-300 dark:border-amber-800"
                : "border-green-200 dark:border-green-900"
              : ""
          }
        >
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    5
                  </span>
                  Verificar Duplicados
                </CardTitle>
                <CardDescription>
                  {!conflictChecked
                    ? "Verifica si ya existe un reporte para este partner y mes antes de continuar."
                    : existingReport
                      ? existingReport.isLocked
                        ? "El reporte existente esta congelado y no se puede reemplazar."
                        : replaceConfirmed
                          ? "Confirmas reemplazar el reporte existente con los nuevos datos."
                          : "Ya existe un reporte para este mes. Revisa la comparacion antes de continuar."
                      : "No existe un reporte previo para este mes. Puedes continuar."}
                </CardDescription>
              </div>
              {!conflictChecked && (
                <Button
                  onClick={handleCheckConflicts}
                  disabled={conflictLoading}
                >
                  {conflictLoading ? (
                    <>
                      <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <ShieldWarning className="mr-2 h-4 w-4" />
                      Verificar Duplicados
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>

          {/* No conflict — all clear */}
          {conflictChecked && !existingReport && (
            <CardContent>
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <p className="text-sm font-medium">
                  No se encontro un reporte previo para{" "}
                  <span className="capitalize">{formatMonth(`${month}-01`)}</span>
                  . Se creara uno nuevo.
                </p>
              </div>
            </CardContent>
          )}

          {/* Conflict found — locked */}
          {conflictChecked && existingReport?.isLocked && (
            <CardContent>
              <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
                  <Lock className="h-5 w-5" />
                  <p className="font-medium">
                    El reporte de{" "}
                    <span className="capitalize">
                      {formatMonth(existingReport.reportMonth)}
                    </span>{" "}
                    esta congelado
                  </p>
                </div>
                <p className="text-sm text-red-700 dark:text-red-400">
                  No se puede reemplazar un reporte congelado. Para subir datos
                  nuevos, primero desbloquea el reporte desde la seccion de
                  Reportes.
                </p>
                <div className="text-xs text-red-600 dark:text-red-400/80">
                  Congelado el: {formatDate(existingReport.lockedAt ?? "")}
                  {" · "}
                  Total: {formatUSD(existingReport.totalUsd)}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(`/reports/${existingReport.reportId}`)
                  }
                >
                  Ir al Reporte
                </Button>
              </div>
            </CardContent>
          )}

          {/* Conflict found — unlocked, show comparison */}
          {conflictChecked &&
            existingReport &&
            !existingReport.isLocked && (
              <CardContent>
                <div className="space-y-4">
                  {/* Warning banner */}
                  <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
                    <div className="flex items-start gap-3">
                      <Warning className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-200">
                          Ya existe un reporte para{" "}
                          <span className="capitalize">
                            {formatMonth(existingReport.reportMonth)}
                          </span>
                        </p>
                        <p className="text-sm text-amber-700 dark:text-amber-300/90 mt-1">
                          Si continuas, el reporte anterior sera reemplazado
                          completamente por los nuevos datos. Los ajustes
                          manuales que se hayan agregado se migraran al nuevo reporte.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Side-by-side comparison */}
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Existing */}
                    <div className="rounded-md border p-4 bg-muted/30">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium text-sm">
                          Reporte Actual (sera reemplazado)
                        </p>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Productos:
                          </span>
                          <span className="font-medium">
                            {existingReport.productCount}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Total USD:
                          </span>
                          <span className="font-mono">
                            {formatUSD(existingReport.totalUsd)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Total MXN:
                          </span>
                          <span className="font-mono">
                            {formatMXN(existingReport.totalMxn)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">TC:</span>
                          <span>
                            ${existingReport.exchangeRate.toFixed(5)}
                          </span>
                        </div>
                        {existingReport.adjustmentCount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Ajustes:
                            </span>
                            <span className="font-medium text-amber-700">
                              {existingReport.adjustmentCount} (se migraran)
                            </span>
                          </div>
                        )}
                        {existingReport.lastUpload && (
                          <>
                            <div className="border-t pt-2 mt-2" />
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Archivo:
                              </span>
                              <span className="text-xs truncate max-w-[180px]">
                                {existingReport.lastUpload.filename}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Subido:
                              </span>
                              <span className="text-xs">
                                {formatDate(
                                  existingReport.lastUpload.processedAt
                                )}
                              </span>
                            </div>
                          </>
                        )}
                        {existingReport.products.length > 0 && (
                          <>
                            <div className="border-t pt-2 mt-2" />
                            <p className="text-xs text-muted-foreground font-medium">
                              Productos:
                            </p>
                            {existingReport.products
                              .slice(0, 8)
                              .map((p) => (
                                <div
                                  key={p.name}
                                  className="flex justify-between text-xs"
                                >
                                  <span className="truncate max-w-[140px]">
                                    {p.name}
                                  </span>
                                  <span className="font-mono text-muted-foreground">
                                    {formatUSD(p.grossUsd)}
                                  </span>
                                </div>
                              ))}
                            {existingReport.products.length > 8 && (
                              <p className="text-xs text-muted-foreground">
                                ... y {existingReport.products.length - 8} mas
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* New */}
                    <div className="rounded-md border border-primary/30 p-4 bg-primary/5">
                      <div className="flex items-center gap-2 mb-3">
                        <ArrowsLeftRight className="h-4 w-4 text-primary" />
                        <p className="font-medium text-sm">
                          Nuevo Reporte (CSV actual)
                        </p>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Productos:
                          </span>
                          <span className="font-medium">
                            {products.length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Total Bruto USD:
                          </span>
                          <span className="font-mono">
                            {formatUSD(totalUsd)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">TC:</span>
                          <span>
                            $
                            {parseFloat(exchangeRate || "0").toFixed(5)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Transacciones:
                          </span>
                          <span>
                            {totalTransactions.toLocaleString()}
                          </span>
                        </div>

                        <div className="border-t pt-2 mt-2" />
                        <p className="text-xs text-muted-foreground font-medium">
                          Diferencias:
                        </p>
                        {products.length !== existingReport.productCount && (
                          <p className="text-xs">
                            <span
                              className={
                                products.length >
                                existingReport.productCount
                                  ? "text-green-700 dark:text-green-400"
                                  : "text-red-700 dark:text-red-400"
                              }
                            >
                              {products.length >
                              existingReport.productCount
                                ? `+${products.length - existingReport.productCount}`
                                : `${products.length - existingReport.productCount}`}{" "}
                              productos
                            </span>
                          </p>
                        )}
                        {exchangeRate &&
                          Math.abs(
                            parseFloat(exchangeRate) -
                              existingReport.exchangeRate
                          ) > 0.00001 && (
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                              TC diferente: $
                              {existingReport.exchangeRate.toFixed(5)} → $
                              {parseFloat(exchangeRate).toFixed(5)}
                            </p>
                          )}
                        {products.length ===
                          existingReport.productCount &&
                          exchangeRate &&
                          Math.abs(
                            parseFloat(exchangeRate) -
                              existingReport.exchangeRate
                          ) <= 0.00001 && (
                            <p className="text-xs text-muted-foreground">
                              Misma cantidad de productos y tipo de cambio.
                              Los montos pueden variar.
                            </p>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Confirm replace */}
                  {!replaceConfirmed ? (
                    <div className="flex flex-wrap gap-3 pt-2">
                      <Button
                        variant="destructive"
                        onClick={() => setReplaceConfirmed(true)}
                      >
                        <ArrowsClockwise className="mr-2 h-4 w-4" />
                        Reemplazar Reporte Anterior
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          router.push(
                            `/reports/${existingReport.reportId}`
                          )
                        }
                      >
                        Ver Reporte Actual
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 pt-2">
                      <CheckCircle className="h-4 w-4" />
                      <p className="text-sm font-medium">
                        Confirmado: el reporte anterior sera reemplazado al
                        generar.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
        </Card>
      )}

      {/* ── Step 6: Generate report ───────────────────────────────── */}
      {canGenerate && !result && !processError && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="font-medium text-green-800 dark:text-green-300">
                  {existingReport
                    ? "Listo para reemplazar el reporte"
                    : "Todo listo para generar el reporte"}
                </p>
                <p className="text-sm text-green-700 dark:text-green-400">
                  {products.length} productos · {formatUSD(totalUsd)} bruto ·
                  TC ${parseFloat(exchangeRate || "0").toFixed(5)} MXN
                  {existingReport && " · Reemplazara el reporte existente"}
                </p>
              </div>
              <Button
                onClick={handleProcess}
                disabled={processing}
                size="lg"
                className={
                  existingReport
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-green-600 hover:bg-green-700"
                }
              >
                {processing ? (
                  <>
                    <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                    {existingReport
                      ? "Reemplazando..."
                      : "Generando Reporte..."}
                  </>
                ) : existingReport ? (
                  <>
                    <ArrowsClockwise className="mr-2 h-4 w-4" />
                    Reemplazar y Generar Reporte
                  </>
                ) : (
                  "Generar Reporte"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Process error: missing distributions ─────────────────── */}
      {processError && !result && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <WarningCircle className="h-5 w-5" />
              No se pudo generar el reporte
            </CardTitle>
            <CardDescription>
              {processError.invalidDistribution.length > 0
                ? `${processError.invalidDistribution.length} producto(s) no tienen su distribución de ganancias configurada al 100%. Asigna colaboradores hasta sumar 100% en cada uno y vuelve a intentar.`
                : "No se encontraron productos válidos para procesar."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {processError.invalidDistribution.length > 0 && (
                <div className="rounded-md border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 overflow-hidden">
                  <div className="px-4 py-2 bg-red-100/50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      Distribuciones pendientes (
                      {processError.invalidDistribution.length})
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-px bg-red-100 dark:bg-red-900/40 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {processError.invalidDistribution.map((p) => {
                      const cell = (
                        <div className="flex h-full items-center justify-between gap-2 bg-red-50/50 dark:bg-red-950/20 px-4 py-2 transition-colors hover:bg-red-100/60 dark:hover:bg-red-900/30">
                          <span className="truncate font-medium text-sm">
                            {p.name}
                          </span>
                          <Badge
                            variant="secondary"
                            className="shrink-0 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs tabular-nums"
                          >
                            {p.distTotal}%
                          </Badge>
                        </div>
                      );
                      return p.productId ? (
                        <Link
                          key={p.name}
                          href={`/products/${p.productId}`}
                          className="block"
                        >
                          {cell}
                        </Link>
                      ) : (
                        <div key={p.name}>{cell}</div>
                      );
                    })}
                  </div>
                </div>
              )}

              {processError.notFound.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Además, {processError.notFound.length} producto(s) del CSV no
                  se encontraron en la base de datos.
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/products">
                    <Package className="mr-2 h-4 w-4" />
                    Configurar distribuciones
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleProcess}
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                      Reintentando...
                    </>
                  ) : (
                    <>
                      <ArrowsClockwise className="mr-2 h-4 w-4" />
                      Reintentar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Result ────────────────────────────────────────────────── */}
      {result && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-300">
              <CheckCircle className="h-5 w-5" />
              {existingReport
                ? "Reporte Reemplazado Exitosamente"
                : "Reporte Generado Exitosamente"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 mb-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Items procesados
                </p>
                <p className="text-xl font-bold">{result.processedProducts}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Neto USD</p>
                <p className="text-xl font-bold">
                  {formatUSD(result.totalUsd)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Neto MXN</p>
                <p className="text-xl font-bold">
                  ${result.totalMxn.toLocaleString("es-MX", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>

            {result.skippedErrors?.length > 0 && (
              <div className="mb-4 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 p-3">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                  Productos omitidos ({result.skippedErrors.length}):
                </p>
                {result.skippedErrors.map((err: string, i: number) => (
                  <p key={i} className="text-xs text-amber-700 dark:text-amber-300/90">
                    {err}
                  </p>
                ))}
              </div>
            )}

            <Button onClick={() => router.push(`/reports/${result.reportId}`)}>
              Ver Reporte Detallado
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
