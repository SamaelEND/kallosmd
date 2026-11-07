/**
 * Constantes de almacenamiento, configuración por defecto y plantilla guía inicial de Markdown Studio.
 */

import type { Settings } from "../types";
import { DEFAULT_CODE_THEME } from "../../shared/utils/codeThemes";
import defaultGuideMd from "./defaultGuide.md?raw";

/**
 * Claves estándar de almacenamiento en localStorage para preferencias y caché de UI.
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
};

export const DEFAULT_DOCUMENT_TITLE =
  "Manual de Astrodinámica y Simulación Orbital.md";

export const DEFAULT_MARKDOWN: string = defaultGuideMd;
