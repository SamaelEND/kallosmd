/**
 * ES: Constantes de almacenamiento, configuración por defecto y guías de estrés en español e inglés.
 * EN: Storage constants, default settings, and stress-test guides in Spanish and English.
 */

import type { Settings } from "../types";
import { DEFAULT_CODE_THEME } from "../../shared/utils/codeThemes";
import defaultGuideEs from "./defaultGuide.es.md?raw";
import defaultGuideEn from "./defaultGuide.en.md?raw";

/**
 * ES: Claves estándar de almacenamiento en localStorage para preferencias y caché de UI.
 * EN: Standard localStorage keys for UI preferences and cache.
 */
export const STORAGE_KEYS = {
  DOCS: "md_studio_docs_v1",
  ACTIVE_ID: "md_studio_active_id_v1",
  THEME: "md_studio_theme_v1",
  SYNC_SCROLL: "md_studio_sync_scroll_v1",
  VIEW_MODE: "md_studio_view_mode_v2",
  FONT_SIZE: "md_studio_font_size_v1",
  CODE_THEME: "md_studio_code_theme_v1",
  LINE_NUMBERS: "md_studio_line_numbers_v1",
  MINIMAP: "md_studio_minimap_v1",
  SPLIT_RATIO: "md_studio_split_ratio_v1",
  INCLUDE_PDF_URL: "md_studio_include_pdf_url_v1",
  PDF_PRESET: "md_studio_pdf_preset_v1",
  PDF_PAPER_SIZE: "md_studio_pdf_paper_size_v1",
  PDF_FONT_FAMILY: "md_studio_pdf_font_family_v1",
  PDF_FONT_SIZE_PT: "md_studio_pdf_font_size_pt_v1",
  PDF_FONT_SIZE_CUSTOM: "md_studio_pdf_font_size_custom_v1",
  PDF_CV_MARGIN: "md_studio_pdf_cv_margin_v1",
  TRANSITIONAL_DOCS: "md_studio_documents_v1",
  TRANSITIONAL_SETTINGS: "md_studio_settings_v1",
  ACTIVE_DOC_CACHE: "md_studio_active_cache_v1",
  CLEAN_INIT_FLAG: "md_studio_fresh_idb_v2",
  GUIDE_MIGRATED_FLAG: "md_studio_guide_v3",
} as const;

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  viewMode: "live",
  fontSize: "medium",
  codeTheme: DEFAULT_CODE_THEME,
  syncScroll: true,
  minimap: true,
  lineNumbers: true,
  splitRatio: 50,
  wordWrap: true,
  includePdfUrl: true,
  pdfPreset: "standard",
  pdfPaperSize: "letter",
  pdfFontFamily: "system",
  pdfFontSizePt: 11,
  pdfFontSizeCustom: false,
  pdfCvMargin: "normal",
};

export const DEFAULT_DOCUMENT_TITLE_ES =
  "Simulación Astrodinámica y Plasma MHD (Ejemplo).md";

export const DEFAULT_DOCUMENT_TITLE_EN =
  "Astrodynamic Simulation & MHD Plasma (Benchmark).md";

export const DEFAULT_DOCUMENT_TITLE = DEFAULT_DOCUMENT_TITLE_ES;

export const DEFAULT_MARKDOWN: string = defaultGuideEs;

/**
 * ES: Retorna el título inicial adecuado según el idioma activo ('es' o 'en').
 * EN: Returns the appropriate initial document title for the active locale ('es' or 'en').
 */
export function getDefaultDocumentTitle(locale: "es" | "en"): string {
  return locale === "en" ? DEFAULT_DOCUMENT_TITLE_EN : DEFAULT_DOCUMENT_TITLE_ES;
}

/**
 * ES: Retorna la guía Markdown de prueba de estrés según el idioma activo ('es' o 'en').
 * EN: Returns the stress-test Markdown guide for the active locale ('es' or 'en').
 */
export function getDefaultGuideMarkdown(locale: "es" | "en"): string {
  return locale === "en" ? defaultGuideEn : defaultGuideEs;
}

/**
 * ES: Comprueba si un documento corresponde a la guía de ejemplo inicial sin modificar.
 * EN: Checks whether a document matches the unmodified initial sample guide.
 */
export function isDefaultGuideContent(content: string, title?: string): boolean {
  const trimmed = content.trim();
  const isEsGuide = trimmed === defaultGuideEs.trim();
  const isEnGuide = trimmed === defaultGuideEn.trim();

  const isKnownTitle =
    title === DEFAULT_DOCUMENT_TITLE_ES ||
    title === DEFAULT_DOCUMENT_TITLE_EN ||
    title === "Manual de Astrodinámica y Simulación Orbital.md" ||
    title === "Manual de Astrodinámica y Simulación Cuántica (Ejemplo).md" ||
    title === "Quantum Astrodynamics & Simulation Manual (Benchmark).md";

  return isEsGuide || isEnGuide || (isKnownTitle && (trimmed.includes("BENCHMARK") || trimmed.includes("Astrodinámica") || trimmed.includes("Astrodynamic")));
}
