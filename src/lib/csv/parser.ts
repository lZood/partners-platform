import type { CsvRow } from "@/types/app";

// ── Column mappings for Microsoft Earnings CSV ──────────────────────
// The CSV has ~120 columns. We only care about a handful.
const COLUMN_MAP = {
  productName: ["productName", "productname", "product name", "producto", "nombre"],
  earningAmountUSD: [
    "earningAmountUSD",
    "earningamountusd",
    "earning amount usd",
    "earningAmount",
    "amount",
    "amountusd",
    "amount (usd)",
  ],
  productId: ["productId", "productid", "product id"],
  productType: ["productType", "producttype", "product type"],
  transactionDate: ["transactionDate", "transactiondate", "transaction date"],
} as const;

/**
 * Find the index of a column by trying multiple header aliases (case-insensitive).
 */
function findColumn(headers: string[], aliases: readonly string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = lower.indexOf(alias.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Parse a single CSV line that may contain quoted fields (with commas inside quotes).
 * Handles the standard RFC 4180 format Microsoft uses.
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

// ── Aggregated row (one per unique product) ─────────────────────────
export interface AggregatedProduct {
  productName: string;
  productId: string;
  productType: string;
  totalUsd: number;
  transactionCount: number;
  dateRange: { earliest: string; latest: string };
}

/**
 * Parse the Microsoft Earnings CSV and aggregate rows by product.
 *
 * Each row in the CSV is a single transaction. The same product appears
 * many times. This function sums `earningAmountUSD` per unique
 * `productName` and returns one entry per product.
 */
export function parseMicrosoftCSV(csvText: string): {
  products: AggregatedProduct[];
  rawRowCount: number;
  headers: string[];
  errors: string[];
} {
  const errors: string[] = [];
  const lines = csvText.split("\n");

  // Remove BOM if present
  if (lines[0] && lines[0].charCodeAt(0) === 0xfeff) {
    lines[0] = lines[0].slice(1);
  }

  if (lines.length < 2) {
    return {
      products: [],
      rawRowCount: 0,
      headers: [],
      errors: ["El archivo CSV esta vacio o solo tiene encabezados."],
    };
  }

  const headers = parseCSVLine(lines[0]);

  // Locate key columns
  const productNameIdx = findColumn(headers, COLUMN_MAP.productName);
  const amountIdx = findColumn(headers, COLUMN_MAP.earningAmountUSD);
  const productIdIdx = findColumn(headers, COLUMN_MAP.productId);
  const productTypeIdx = findColumn(headers, COLUMN_MAP.productType);
  const txDateIdx = findColumn(headers, COLUMN_MAP.transactionDate);

  if (productNameIdx === -1) {
    errors.push(
      'No se encontro la columna "productName" en el CSV. Verifica que el archivo sea el correcto.'
    );
  }
  if (amountIdx === -1) {
    errors.push(
      'No se encontro la columna "earningAmountUSD" en el CSV. Verifica que el archivo sea el correcto.'
    );
  }

  if (errors.length > 0) {
    return { products: [], rawRowCount: 0, headers, errors };
  }

  // ── Aggregate by product name ───────────────────────────────────
  const productMap = new Map<
    string,
    {
      productName: string;
      productId: string;
      productType: string;
      totalUsd: number;
      count: number;
      earliest: string;
      latest: string;
    }
  >();

  let rawRowCount = 0;
  let skippedEmpty = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    rawRowCount++;

    const productName = values[productNameIdx] ?? "";
    const amountStr = (values[amountIdx] ?? "").replace(/[$,]/g, "");
    const amountUsd = parseFloat(amountStr);

    if (!productName) {
      skippedEmpty++;
      continue;
    }

    if (isNaN(amountUsd)) {
      errors.push(
        `Fila ${i + 1}: monto invalido "${values[amountIdx]}" para "${productName}".`
      );
      continue;
    }

    const productId = productIdIdx >= 0 ? (values[productIdIdx] ?? "") : "";
    const productType = productTypeIdx >= 0 ? (values[productTypeIdx] ?? "") : "";
    const txDate = txDateIdx >= 0 ? (values[txDateIdx] ?? "") : "";

    // Use productName as the aggregation key (lowercased for safety)
    const key = productName.toLowerCase();
    const existing = productMap.get(key);

    if (existing) {
      existing.totalUsd += amountUsd;
      existing.count += 1;
      if (txDate && txDate < existing.earliest) existing.earliest = txDate;
      if (txDate && txDate > existing.latest) existing.latest = txDate;
    } else {
      productMap.set(key, {
        productName,
        productId,
        productType,
        totalUsd: amountUsd,
        count: 1,
        earliest: txDate || "",
        latest: txDate || "",
      });
    }
  }

  // Empty product rows are normal in Microsoft CSVs (refunds, adjustments, etc.)
  // No need to warn about them — they're silently skipped.

  // ── Build sorted result ─────────────────────────────────────────
  const products: AggregatedProduct[] = Array.from(productMap.values())
    .map((p) => ({
      productName: p.productName,
      productId: p.productId,
      productType: p.productType,
      totalUsd: Math.round(p.totalUsd * 1_000_000) / 1_000_000, // preserve precision
      transactionCount: p.count,
      dateRange: { earliest: p.earliest, latest: p.latest },
    }))
    .sort((a, b) => b.totalUsd - a.totalUsd); // highest earnings first

  return { products, rawRowCount, headers, errors };
}

/**
 * Convert aggregated products to the CsvRow[] format that generateReport expects.
 */
export function aggregatedToCsvRows(products: AggregatedProduct[]): CsvRow[] {
  return products.map((p) => ({
    productName: p.productName,
    amountUsd: p.totalUsd,
    productId: p.productId,
    productType: p.productType,
  }));
}

/**
 * Generate a CSV template string with expected headers.
 * (Simplified 2-column version for manual creation)
 */
export function generateCSVTemplate(): string {
  return "productName,earningAmountUSD\nGolden Hour,150.00\nNight Rider Pack,200.50\n";
}
