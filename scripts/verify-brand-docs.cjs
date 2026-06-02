/* eslint-disable */
/**
 * Verification harness: transpiles the TS generators on the fly (resolving the
 * "@/" path alias), runs each one with representative data, and validates the
 * produced PDF / XLSX bytes. Not part of the app build — a dev-only check.
 *
 *   node scripts/verify-brand-docs.cjs
 */
const Module = require("module");
const path = require("path");
const fs = require("fs");
const ts = require("typescript");

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

// --- "@/" alias + extensionless .ts resolution ---------------------------
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  let req = request;
  if (req.startsWith("@/")) req = path.join(SRC, req.slice(2));
  try {
    return origResolve.call(this, req, ...rest);
  } catch (e) {
    for (const ext of [".ts", ".tsx", path.join("", "index.ts")]) {
      try {
        return origResolve.call(this, req + ext, ...rest);
      } catch (_) {}
    }
    throw e;
  }
};

// --- transpile .ts/.tsx on require ----------------------------------------
function compileTs(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const out = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
      jsx: ts.JsxEmit.None,
    },
    fileName: filename,
  }).outputText;
  module._compile(out, filename);
}
require.extensions[".ts"] = compileTs;
require.extensions[".tsx"] = compileTs;

// --- load generators -------------------------------------------------------
const { generateReportPDF } = require("@/lib/pdf/report-pdf");
const { generateReceiptPDF } = require("@/lib/pdf/receipt-pdf");
const { generateReportExcel } = require("@/lib/excel/report-excel");
const { generatePaymentReceiptExcel } = require("@/lib/excel/payment-receipt-excel");
const { generatePaymentsExcel } = require("@/lib/excel/payments-excel");
const { generateProductsExcel } = require("@/lib/excel/products-excel");
const { generateFiscalExcel } = require("@/lib/excel/fiscal-excel");
const { generateCollaboratorsExcel } = require("@/lib/excel/collaborators-excel");
const ExcelJS = require("exceljs");

const OUT = path.join(ROOT, "scripts", ".verify-out");
fs.mkdirSync(OUT, { recursive: true });

// --- sample data -----------------------------------------------------------
const reportData = {
  reportMonth: "2026-03",
  partnerName: "Estudio Pixelandia",
  exchangeRate: 17.2543,
  isLocked: true,
  grandTotalUsd: 1234.56,
  grandTotalMxn: 21300.12,
  userSummaries: [
    {
      userName: "Juan Pérez Núñez",
      items: [
        { productName: "Mapa Épico de Aventura", percentageApplied: 20, grossUsd: 600, afterTaxesUsd: 540, finalUsd: 108, finalMxn: 1863.46 },
        { productName: "Addon: Mobs Legendarios", percentageApplied: 35, grossUsd: 400, afterTaxesUsd: 360, finalUsd: 126, finalMxn: 2174.04 },
      ],
      adjustments: [
        { type: "bonus", description: "Bono por desempeño", amountUsd: 50 },
        { type: "deduction", description: "Anticipo entregado", amountUsd: 30 },
      ],
      totalGrossUsd: 1000, totalAfterTaxesUsd: 900, totalAdjustmentsUsd: 20, totalFinalUsd: 254, totalFinalMxn: 4382.6,
    },
    {
      userName: "María José Camasho",
      items: [
        { productName: "Skin Pack Halloween", percentageApplied: 50, grossUsd: 800, afterTaxesUsd: 720, finalUsd: 360, finalMxn: 6211.55 },
      ],
      adjustments: [],
      totalGrossUsd: 800, totalAfterTaxesUsd: 720, totalAdjustmentsUsd: 0, totalFinalUsd: 360, totalFinalMxn: 6211.55,
    },
  ],
};
// users alias for excel signature
const reportExcelData = { ...reportData, users: reportData.userSummaries };

const receiptData = {
  paymentId: "a1b2c3d4e5f6",
  partnerName: "Estudio Pixelandia",
  partnerLogoUrl: null,
  partnerLogo: null,
  userName: "Juan Pérez Núñez",
  userEmail: "juan@example.com",
  paidAt: "2026-03-15T10:00:00.000Z",
  salesPeriods: ["Febrero 2026", "Marzo 2026"],
  exchangeRate: 17.25,
  products: [
    { product: "Mapa Épico", distribution: "20% · Mapa", percentage: 20, productType: "Mapa", amountUsd: 108, amountMxn: 1863, salesPeriod: "Febrero 2026" },
    { product: "Addon Mobs", distribution: "35% · Addon", percentage: 35, productType: "Addon", amountUsd: 126, amountMxn: 2174, salesPeriod: "Marzo 2026" },
  ],
  concepts: [
    { description: "Bono por entrega anticipada", amountUsd: 50, amountMxn: 862.5, isDeduction: false },
    { description: "Deducción por anticipo", amountUsd: 30, amountMxn: 517.5, isDeduction: true },
  ],
  productsSubtotalUsd: 234, productsSubtotalMxn: 4037,
  conceptsSubtotalUsd: 20, conceptsSubtotalMxn: 345,
  totalUsd: 254, totalMxn: 4382, paymentMethod: "Transferencia", notes: "Pago correspondiente al Q1.", createdByName: "Admin",
};

const paymentsData = {
  fromDate: "2026-01-01", toDate: "2026-03-31", partnerName: "Estudio Pixelandia",
  payments: [
    { paidAt: "2026-03-15T10:00:00Z", userName: "Juan Pérez", totalUsd: 254, totalMxn: 4382, exchangeRate: 17.25, paymentMethod: "Transferencia", items: [{ description: "Distribución Mapa", amountUsd: 108, amountMxn: 1863 }, { description: "Bono", amountUsd: 50, amountMxn: 862 }] },
    { paidAt: "2026-02-15T10:00:00Z", userName: "María José", totalUsd: 360, totalMxn: 6211, exchangeRate: 17.25, paymentMethod: "PayPal", items: [{ description: "Skin Pack", amountUsd: 360, amountMxn: 6211 }] },
  ],
};

const productsData = {
  products: [
    { name: "Mapa Épico de Aventura", productType: "Mapa", category: "Aventura", partner: "Estudio Pixelandia", isActive: true, lifecycleStatus: "active", collaborators: "Juan Pérez (20%), María José (10%)", createdAt: "2026-01-10T00:00:00Z" },
    { name: "Addon Mobs", productType: "Addon", category: null, partner: "Estudio Pixelandia", isActive: false, lifecycleStatus: "deprecated", collaborators: "", createdAt: "2025-11-01T00:00:00Z" },
  ],
};

const fiscalData = {
  year: 2026, partnerName: "Estudio Pixelandia",
  users: [
    {
      userName: "Juan Pérez Núñez", userEmail: "juan@example.com",
      totalGrossUsd: 1000, totalTaxesUsd: 100, totalNetUsd: 254, totalNetMxn: 4382, totalPaymentsReceived: 254,
      months: [
        { month: "2026-01", label: "Enero 2026", grossUsd: 500, taxesUsd: 50, netUsd: 127, exchangeRate: 17.2, netMxn: 2184 },
        { month: "2026-02", label: "Febrero 2026", grossUsd: 500, taxesUsd: 50, netUsd: 127, exchangeRate: 17.3, netMxn: 2197 },
      ],
      adjustments: [{ type: "Bono", description: "Bono por desempeño", amountUsd: 50, month: "Marzo 2026" }, { type: "Deducción", description: "Anticipo", amountUsd: -30, month: "Marzo 2026" }],
    },
  ],
};

const collaboratorsData = {
  collaborators: [
    { name: "Juan Pérez Núñez", email: "juan@example.com", userType: "system_user", isActive: true, partners: "Estudio Pixelandia", roles: "Editor", createdAt: "2026-01-10T00:00:00Z", lastActivity: "2026-03-20T00:00:00Z" },
    { name: "María José Camasho", email: null, userType: "virtual", isActive: false, partners: "", roles: "", createdAt: "2025-12-01T00:00:00Z", lastActivity: null },
  ],
};

// --- run + validate --------------------------------------------------------
function isPdf(buf) { return buf.length > 800 && buf.slice(0, 5).toString("latin1") === "%PDF-"; }
function isXlsx(buf) { return buf.length > 800 && buf.slice(0, 2).toString("latin1") === "PK"; }

async function validateXlsx(buf) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb.worksheets.map((w) => `${w.name}(${w.rowCount}r)`).join(", ");
}

(async () => {
  const jobs = [
    ["report.pdf", () => generateReportPDF(reportData), isPdf],
    ["receipt.pdf", () => generateReceiptPDF(receiptData), isPdf],
    ["report.xlsx", () => generateReportExcel(reportExcelData), isXlsx],
    ["payment-receipt.xlsx", () => generatePaymentReceiptExcel(receiptData), isXlsx],
    ["payments.xlsx", () => generatePaymentsExcel(paymentsData), isXlsx],
    ["products.xlsx", () => generateProductsExcel(productsData), isXlsx],
    ["fiscal.xlsx", () => generateFiscalExcel(fiscalData), isXlsx],
    ["collaborators.xlsx", () => generateCollaboratorsExcel(collaboratorsData), isXlsx],
  ];

  let allOk = true;
  for (const [name, fn, check] of jobs) {
    try {
      const buf = await fn();
      const ok = check(buf);
      fs.writeFileSync(path.join(OUT, name), buf);
      let extra = "";
      if (name.endsWith(".xlsx")) extra = " | sheets: " + (await validateXlsx(buf));
      console.log(`${ok ? "OK " : "BAD"} ${name.padEnd(22)} ${String(buf.length).padStart(7)} bytes${extra}`);
      if (!ok) allOk = false;
    } catch (e) {
      allOk = false;
      console.log(`ERR ${name.padEnd(22)} ${e && e.stack ? e.stack.split("\n").slice(0, 4).join("\n     ") : e}`);
    }
  }
  console.log(allOk ? "\nALL DOCUMENTS VALID" : "\nFAILURES PRESENT");
  process.exit(allOk ? 0 : 1);
})();
