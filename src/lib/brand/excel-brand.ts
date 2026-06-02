import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import { XLS, FONT } from "./theme";

/**
 * Shared ExcelJS building blocks so every workbook the app exports speaks the
 * same BoxBuild visual language: a dark "Profesionalismo" banner, Sora/Anek
 * Latin typography, neutral-gray zebra rows and the blue accent used sparingly
 * for important figures. See {@link file://./theme.ts} for the palette.
 */

const LOGO_DARK_PATH = path.join(
  process.cwd(),
  "public",
  "brand",
  "LogoCompleto_DarkTheme.png" // white wordmark — for the dark banner
);

let logoCache: Buffer | null | undefined;
function darkLogo(): Buffer | null {
  if (logoCache !== undefined) return logoCache;
  try {
    logoCache = fs.readFileSync(LOGO_DARK_PATH);
  } catch {
    logoCache = null;
  }
  return logoCache;
}

/** Solid fill from an ARGB string. */
export function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

/** Hairline border in the brand line color, all four sides. */
export const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: XLS.line } },
  left: { style: "thin", color: { argb: XLS.line } },
  bottom: { style: "thin", color: { argb: XLS.line } },
  right: { style: "thin", color: { argb: XLS.line } },
};

/** Sora (body) font descriptor. */
export function bodyFont(
  opts: Partial<ExcelJS.Font> = {}
): Partial<ExcelJS.Font> {
  return { name: FONT.body, color: { argb: XLS.ink }, ...opts };
}

/** Anek Latin (title) font descriptor. */
export function titleFont(
  opts: Partial<ExcelJS.Font> = {}
): Partial<ExcelJS.Font> {
  return { name: FONT.title, color: { argb: XLS.ink }, ...opts };
}

/**
 * Paint the standard branded banner (dark title band + graphite subtitle band)
 * across `colSpan` columns and float the BoxBuild wordmark on the right.
 *
 * @returns the first free row index below the banner.
 */
export function addBrandBanner(opts: {
  wb: ExcelJS.Workbook;
  sheet: ExcelJS.Worksheet;
  title: string;
  subtitle: string;
  colSpan: number;
  startRow?: number;
}): number {
  const { wb, sheet, title, subtitle, colSpan } = opts;
  const startRow = opts.startRow ?? 1;

  // Title band (ink).
  sheet.mergeCells(startRow, 1, startRow, colSpan);
  const titleCell = sheet.getCell(startRow, 1);
  titleCell.value = title;
  titleCell.font = titleFont({
    bold: true,
    size: 18,
    color: { argb: XLS.white },
  });
  titleCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  titleCell.fill = fill(XLS.ink);
  sheet.getRow(startRow).height = 38;

  // Subtitle band (graphite).
  sheet.mergeCells(startRow + 1, 1, startRow + 1, colSpan);
  const subCell = sheet.getCell(startRow + 1, 1);
  subCell.value = subtitle;
  subCell.font = bodyFont({ size: 10.5, color: { argb: XLS.onDarkMuted } });
  subCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  subCell.fill = fill(XLS.graphite);
  sheet.getRow(startRow + 1).height = 20;

  // Wordmark, floated over the right side of the title band.
  const logo = darkLogo();
  if (logo) {
    try {
      const imageId = wb.addImage({ buffer: logo as any, extension: "png" });
      sheet.addImage(imageId, {
        tl: { col: Math.max(colSpan - 1.85, 0.2), row: startRow - 1 + 0.22 },
        ext: { width: 92, height: 24 },
        editAs: "absolute",
      } as any);
    } catch {
      // Branding is decorative; never fail an export over it.
    }
  }

  return startRow + 2;
}

/**
 * Style a column-header row (1-based) with the brand table-header look:
 * graphite fill, white bold Sora, centered, hairline borders.
 */
export function styleHeaderRow(
  sheet: ExcelJS.Worksheet,
  rowIdx: number,
  colSpan: number,
  opts: { startCol?: number } = {}
) {
  const startCol = opts.startCol ?? 1;
  const row = sheet.getRow(rowIdx);
  row.height = 22;
  for (let c = startCol; c < startCol + colSpan; c++) {
    const cell = row.getCell(c);
    cell.font = bodyFont({ bold: true, color: { argb: XLS.white }, size: 10.5 });
    cell.fill = fill(XLS.graphite);
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  }
}

/**
 * Append a faint footer line (Sora) spanning `colSpan` columns. Useful as a
 * consistent "BoxBuild · generated …" sign-off across sheets.
 */
export function addBrandFooter(
  sheet: ExcelJS.Worksheet,
  text: string,
  colSpan: number
) {
  const row = sheet.addRow([text]);
  row.getCell(1).font = bodyFont({ size: 8, color: { argb: XLS.faint } });
  row.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
  sheet.mergeCells(row.number, 1, row.number, colSpan);
}

/**
 * Apply Sora to every populated cell that has not already been given a font.
 * Call right before writing the workbook so plain data rows pick up the brand
 * typeface without each generator having to set it per cell.
 */
export function applyBodyFontDefault(sheet: ExcelJS.Worksheet) {
  sheet.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (!cell.font || !cell.font.name) {
        cell.font = { ...(cell.font ?? {}), name: FONT.body };
      }
    });
  });
}
