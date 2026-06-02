/**
 * BoxBuild brand system — single source of truth for generated documents
 * (PDF via pdfkit, Excel via exceljs). Derived from the official
 * "Manual de Marca - BoxBuild".
 *
 * Visual direction (per product owner):
 *  - Predominantly the dark "Profesionalismo" ink (#282828) plus neutral grays.
 *  - The brand BLUE (#1B88CA, "Confianza") is the ONLY accent and is used
 *    sparingly to mark important elements (emphasized KPIs, totals, status).
 *  - No other vivid colors are used decoratively. The brand RED (#E43535,
 *    "Pasión") is reserved strictly as a semantic signal for negative /
 *    deduction amounts.
 *
 * Typography (mandated by the manual — no other typefaces allowed):
 *  - Anek Latin  → titles / headings
 *  - Sora        → body text and figures
 * The PDF generators embed static TTF instances of these (see pdf-fonts.ts);
 * Excel references them by family name (Excel substitutes if not installed).
 */

// ── Full brand palette (from the manual, for reference) ───────────────
// Not all are used decoratively; kept so future work stays on-brand.
export const BRAND = {
  ink: "#282828", // Profesionalismo
  paper: "#F3F2F2", // Calma
  green: "#66BA90", // Crecimiento
  yellow: "#FBC467", // Alegría
  red: "#E43535", // Pasión
  blue: "#1B88CA", // Confianza
} as const;

/**
 * PDF palette (hex, for pdfkit `fillColor` / `strokeColor`).
 * Neutral grays are derived from the ink/paper pair so the family stays
 * coherent and free of off-brand vivid colors.
 */
export const PDF = {
  ink: "#282828", // primary dark — banners, totals, body emphasis
  graphite: "#444444", // secondary dark — table headers, subtitle bands
  muted: "#707070", // secondary text
  faint: "#9A9A9A", // tertiary / disclaimer text
  line: "#DDDCDC", // hairline borders
  paper: "#F3F2F2", // light gray — zebra rows, soft card backgrounds
  white: "#FFFFFF",
  accent: "#1B88CA", // the single accent — important markers only
  accentTint: "#E9F2F9", // very light blue — "important" row highlights
  onDarkMuted: "#BDBDBD", // muted text placed on dark (ink) backgrounds
  negative: "#E43535", // semantic only — negative / deduction figures
} as const;

/**
 * Excel palette (ARGB, FF-prefixed, for exceljs fills/fonts).
 * Mirrors {@link PDF} exactly.
 */
export const XLS = {
  ink: "FF282828",
  graphite: "FF444444",
  muted: "FF707070",
  faint: "FF9A9A9A",
  line: "FFDDDCDC",
  paper: "FFF3F2F2",
  white: "FFFFFFFF",
  accent: "FF1B88CA",
  accentTint: "FFE9F2F9",
  onDarkMuted: "FFBDBDBD",
  negative: "FFE43535",
} as const;

/** Brand typeface family names (Excel uses these directly). */
export const FONT = {
  /** Titles / headings. */
  title: "Anek Latin",
  /** Body text and figures. */
  body: "Sora",
} as const;

/** Shared currency / percentage number formats. */
export const NUM_FMT = {
  usd: '"$"#,##0.00',
  mxn: '"$"#,##0.00" MXN"',
  pct: "0.0%",
} as const;
