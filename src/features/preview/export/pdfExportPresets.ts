/**
 * ES: Catálogo de perfiles de exportación a PDF (Estándar, CV, APA 7.ª), validación de tamaño de texto (8–16 pt),
 *     cálculo puro de estilos @media print y orquestador de impresión.
 * EN: Catalog of PDF export presets (Standard, CV, APA 7th), font size validation (8–16 pt),
 *     pure @media print style calculation, and print orchestrator.
 */

import type {
  PdfCvMargin,
  PdfFontFamily,
  PdfFormatPreset,
  PdfPaperSize,
  Settings,
  ViewMode,
} from "../../../core/types";

/**
 * ES: Valores predefinidos para el selector combinado de tamaño de fuente (en puntos tipográficos).
 * EN: Predefined values for the combined font size selector (in typographic points).
 */
export const PDF_FONT_SIZE_PRESETS = [9, 10, 10.5, 11, 12, 14] as const;

export const MIN_PDF_FONT_SIZE = 8;
export const MAX_PDF_FONT_SIZE = 16;

/**
 * ES: Pilas tipográficas 100% locales/offline compatibles con Windows, macOS y Linux.
 * EN: 100% local/offline font stacks compatible with Windows, macOS, and Linux.
 */
export const PDF_FONT_STACKS: Record<PdfFontFamily, string> = {
  system:
    "var(--font-sans, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
  arial: "Arial, 'Helvetica Neue', Helvetica, 'Liberation Sans', sans-serif",
  calibri: "Calibri, 'Carlito', 'Segoe UI', Arial, sans-serif",
  times: "'Times New Roman', Times, 'Liberation Serif', 'Nimbus Roman', serif",
  georgia: "Georgia, 'Liberation Serif', Cambria, Times, serif",
};

/**
 * ES: Nombres legibles de cada familia tipográfica para mostrar en el resumen de reglas.
 * EN: Human-readable font family names to display in the export rules summary.
 */
export const PDF_FONT_DISPLAY_NAMES: Record<PdfFontFamily, string> = {
  system: "Inter / System",
  arial: "Arial",
  calibri: "Calibri",
  times: "Times New Roman",
  georgia: "Georgia",
};

/**
 * ES: Retorna el tamaño de texto por defecto (en pt) asociado a cada formato de documento.
 *     - Standard: 11 pt
 *     - CV: 11 pt
 *     - Scientific (APA 7th): 12 pt
 * EN: Returns the default font size (in pt) associated with each document format preset.
 *     - Standard: 11 pt
 *     - CV: 11 pt
 *     - Scientific (APA 7th): 12 pt
 */
export function getDefaultPdfFontSize(preset: PdfFormatPreset): number {
  return preset === "apa7" ? 12 : 11;
}

export type PdfFontSizeErrorCode = "empty" | "nan" | "range";

export interface PdfFontSizeValidation {
  valid: boolean;
  value: number | null;
  errorCode: PdfFontSizeErrorCode | null;
}

/**
 * ES: Valida el tamaño de texto ingresado por el usuario (acepta decimales, rango válido de 8 a 16 pt).
 * EN: Validates the user-entered font size (accepts decimals, valid range from 8 to 16 pt).
 */
export function validatePdfFontSize(
  rawInput: string | number | null | undefined,
): PdfFontSizeValidation {
  if (rawInput === null || rawInput === undefined) {
    return { valid: false, value: null, errorCode: "empty" };
  }

  const trimmed = String(rawInput).trim();
  if (!trimmed) {
    return { valid: false, value: null, errorCode: "empty" };
  }

  // ES: Permite punto o coma decimal, rechazando caracteres no numéricos.
  // EN: Allows dot or comma decimal separator while rejecting non-numeric characters.
  const normalized = trimmed.replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return { valid: false, value: null, errorCode: "nan" };
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) {
    return { valid: false, value: null, errorCode: "nan" };
  }

  if (numeric < MIN_PDF_FONT_SIZE || numeric > MAX_PDF_FONT_SIZE) {
    return { valid: false, value: null, errorCode: "range" };
  }

  return {
    valid: true,
    value: Math.round(numeric * 100) / 100,
    errorCode: null,
  };
}

/**
 * ES: Calcula los cambios de configuración al elegir un formato (Standard, CV, APA 7.ª).
 *     Si el usuario ya eligió manualmente un tamaño (pdfFontSizeCustom = true), no lo sobrescribe.
 * EN: Computes settings updates when selecting a format preset (Standard, CV, APA 7th).
 *     If the user already manually chose a font size (pdfFontSizeCustom = true), it does not overwrite it.
 */
export function resolvePresetSwitchSettings(
  current: Pick<
    Settings,
    "pdfPreset" | "pdfFontFamily" | "pdfFontSizePt" | "pdfFontSizeCustom"
  >,
  nextPreset: PdfFormatPreset,
): Pick<Settings, "pdfPreset" | "pdfFontSizePt"> {
  const nextSize = current.pdfFontSizeCustom
    ? (current.pdfFontSizePt ?? getDefaultPdfFontSize(nextPreset))
    : getDefaultPdfFontSize(nextPreset);

  return {
    pdfPreset: nextPreset,
    pdfFontSizePt: nextSize,
  };
}

/**
 * ES: Verifica si la combinación de tipografía y tamaño cumple estrictamente las recomendaciones de APA 7.ª
 *     (Times New Roman 12 pt, o Arial / Calibri / Georgia a 11 pt).
 * EN: Checks whether the font family and size combination strictly matches APA 7th recommendations
 *     (Times New Roman 12 pt, or Arial / Calibri / Georgia at 11 pt).
 */
export function isApa7CompliantSelection(
  font: PdfFontFamily,
  sizePt: number,
): boolean {
  if (font === "times") return sizePt === 12;
  if (font === "arial" || font === "calibri" || font === "georgia") {
    return sizePt === 11;
  }
  return false;
}

/**
 * ES: Calcula los márgenes CSS exactos para la regla @page según el formato elegido.
 * EN: Computes exact CSS margins for the @page rule based on the chosen preset.
 */
export function resolvePdfPageMargins(
  preset: PdfFormatPreset,
  cvMargin: PdfCvMargin = "normal",
): { top: string; right: string; bottom: string; left: string } {
  if (preset === "apa7") {
    return { top: "2.54cm", right: "2.54cm", bottom: "2.54cm", left: "2.54cm" };
  }
  if (preset === "cv") {
    const val = cvMargin === "compact" ? "1.9cm" : "2.5cm";
    return { top: val, right: val, bottom: val, left: val };
  }
  return { top: "20mm", right: "25mm", bottom: "20mm", left: "25mm" };
}

/**
 * ES: Resuelve el tamaño de fuente válido en pt a partir de la configuración actual.
 * EN: Resolves the valid font size in pt from the current settings.
 */
export function resolveEffectivePdfFontSize(settings: Settings): number {
  const preset: PdfFormatPreset = settings.pdfPreset || "standard";
  const check = validatePdfFontSize(settings.pdfFontSizePt);
  return check.valid && check.value !== null
    ? check.value
    : getDefaultPdfFontSize(preset);
}

/**
 * ES: Genera la cadena CSS para @media print con el tamaño de página, márgenes, tipografía y tamaño en pt.
 * EN: Generates the @media print CSS string with page size, margins, typography, and font size in pt.
 */
export function buildPdfPrintPageCss(
  settings: Settings,
  locale: "es" | "en",
  currentUrl = "https://kallosmd.xyz/",
): string {
  const preset: PdfFormatPreset = settings.pdfPreset || "standard";
  const paperSize: PdfPaperSize = settings.pdfPaperSize || "letter";
  const cvMargin: PdfCvMargin = settings.pdfCvMargin || "normal";
  const fontFamily: PdfFontFamily = settings.pdfFontFamily || "system";
  const fontSizePt = resolveEffectivePdfFontSize(settings);

  const urlContent = settings.includePdfUrl
    ? JSON.stringify(currentUrl)
    : '""';

  const margins = resolvePdfPageMargins(preset, cvMargin);
  const pageSizeCss = paperSize === "a4" ? "A4" : "letter";
  const fontStack = PDF_FONT_STACKS[fontFamily];
  const pageWord = locale === "en" ? "Page " : "Página ";
  const ofWord = locale === "en" ? " of " : " de ";

  const topRightContent =
    preset === "apa7"
      ? `content: counter(page); font-size: ${fontSizePt}pt; font-family: ${fontStack}; color: #1f2328;`
      : `content: "";`;

  const bottomRightContent =
    preset === "apa7"
      ? `content: "";`
      : `content: "${pageWord}" counter(page) "${ofWord}" counter(pages); font-size: 8.5pt; font-family: ${fontStack}; color: rgba(110, 119, 129, 0.75);`;

  return `@media print {
    @page {
      size: ${pageSizeCss};
      margin-top: ${margins.top};
      margin-right: ${margins.right};
      margin-bottom: ${margins.bottom};
      margin-left: ${margins.left};
      @top-right { ${topRightContent} }
      @bottom-right { ${bottomRightContent} }
      @bottom-left { content: ${urlContent}; font-size: 8.5pt; font-family: ${fontStack}; color: rgba(110, 119, 129, 0.65); }
    }
    :root {
      --pdf-base-font-size: ${fontSizePt}pt;
    }
    .reading-table-content {
      font-family: ${fontStack} !important;
      font-size: ${fontSizePt}pt !important;
    }
  }`;
}

/**
 * ES: Sincroniza los atributos data-pdf-* en <html> y actualiza la regla @page de impresión.
 * EN: Synchronizes data-pdf-* attributes on <html> and updates the print @page rule.
 */
export function syncPdfPrintStylesheet(
  settings: Settings,
  locale: "es" | "en",
): void {
  if (typeof document === "undefined") return;

  const preset: PdfFormatPreset = settings.pdfPreset || "standard";
  const paperSize: PdfPaperSize = settings.pdfPaperSize || "letter";
  const fontFamily: PdfFontFamily = settings.pdfFontFamily || "system";
  const fontSizePt = resolveEffectivePdfFontSize(settings);

  const root = document.documentElement;
  root.setAttribute("data-pdf-preset", preset);
  root.setAttribute("data-pdf-font", fontFamily);
  root.setAttribute("data-pdf-paper", paperSize);
  root.setAttribute("data-pdf-size", String(fontSizePt));

  let styleEl = document.getElementById(
    "md-studio-print-page-style",
  ) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "md-studio-print-page-style";
    document.head.appendChild(styleEl);
  }

  const currentUrl =
    typeof window !== "undefined"
      ? window.location.href
      : "https://kallosmd.xyz/";

  styleEl.textContent = buildPdfPrintPageCss(settings, locale, currentUrl);
}

export interface PdfPrintContext {
  docTitle: string;
  currentViewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  prepareForPrint?: () => Promise<void>;
  restoreAfterPrint?: () => Promise<void>;
}

/**
 * ES: Ejecuta el flujo completo de preparación de vista previa, impresión nativa a PDF y restauración de estado.
 * EN: Executes the full workflow of preview preparation, native PDF print, and state restoration.
 */
export async function executePdfPrint(ctx: PdfPrintContext): Promise<void> {
  const originalTitle = typeof document !== "undefined" ? document.title : "";
  const cleanTitle = ctx.docTitle
    ? ctx.docTitle.replace(/\.md$/i, "")
    : "documento";
  if (typeof document !== "undefined") document.title = cleanTitle;

  const previousMode = ctx.currentViewMode;
  if (previousMode === "editor" || previousMode === "live") {
    ctx.setViewMode("preview");
    await new Promise((resolve) => setTimeout(resolve, 80));
  }

  if (ctx.prepareForPrint) {
    await ctx.prepareForPrint();
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  window.print();

  if (ctx.restoreAfterPrint) {
    await ctx.restoreAfterPrint();
  }
  if (previousMode === "editor" || previousMode === "live") {
    ctx.setViewMode(previousMode);
  }
  if (typeof document !== "undefined") document.title = originalTitle;
}
