import path from "path";
import fs from "fs";

/**
 * Logical font names used throughout the PDF generators. Each maps to an
 * embedded brand TTF (Anek Latin / Sora) or, if the font files are missing
 * from the deployment bundle, to a Helvetica fallback so generation never
 * fails.
 */
export interface BrandFonts {
  /** Anek Latin Bold — large document titles. */
  display: string;
  /** Anek Latin SemiBold — section / column headers and bar labels. */
  heading: string;
  /** Sora Regular — body text and figures. */
  body: string;
  /** Sora SemiBold — emphasized text, labels and totals. */
  bodyBold: string;
}

const FONT_DIR = path.join(process.cwd(), "public", "brand", "fonts");

const FILES: Record<keyof BrandFonts, string> = {
  display: "AnekLatin-Bold.ttf",
  heading: "AnekLatin-SemiBold.ttf",
  body: "Sora-Regular.ttf",
  bodyBold: "Sora-SemiBold.ttf",
};

// Registered (internal) names so repeated registration is idempotent per doc.
const NAMES: BrandFonts = {
  display: "BB-Display",
  heading: "BB-Heading",
  body: "BB-Body",
  bodyBold: "BB-BodyBold",
};

const FALLBACK: BrandFonts = {
  display: "Helvetica-Bold",
  heading: "Helvetica-Bold",
  body: "Helvetica",
  bodyBold: "Helvetica-Bold",
};

/**
 * Register the BoxBuild brand fonts on a pdfkit document and return the names
 * to use with `doc.font(...)`. Falls back to Helvetica (and logs a warning)
 * if any of the embedded TTFs are not present at runtime — the document is
 * still produced, just without the brand typefaces.
 */
export function registerBrandFonts(doc: PDFKit.PDFDocument): BrandFonts {
  try {
    const paths = Object.fromEntries(
      (Object.keys(FILES) as (keyof BrandFonts)[]).map((k) => [
        k,
        path.join(FONT_DIR, FILES[k]),
      ])
    ) as Record<keyof BrandFonts, string>;

    for (const p of Object.values(paths)) {
      if (!fs.existsSync(p)) {
        console.warn(
          `[brand] Missing PDF font ${p}; falling back to Helvetica.`
        );
        return FALLBACK;
      }
    }

    (Object.keys(NAMES) as (keyof BrandFonts)[]).forEach((k) => {
      doc.registerFont(NAMES[k], paths[k]);
    });
    return NAMES;
  } catch (err) {
    console.warn("[brand] Failed to register PDF fonts:", err);
    return FALLBACK;
  }
}
