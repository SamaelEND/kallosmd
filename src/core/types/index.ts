/**
 * ES: Tipos e interfaces globales para Markdown Studio. Diseñado con arquitectura modular extensible a largo plazo.
 * EN: Global types and interfaces for Markdown Studio. Designed with a long-term extensible modular architecture.
 */

export type ThemeMode = 'dark' | 'light';
export type ViewMode = 'live' | 'editor' | 'split' | 'preview';
export type CodeThemeId = 'vscode' | 'solarized' | 'one' | 'github';

export type FontSize = 'small' | 'medium' | 'large';

// ES: Perfiles de formato, tamaño de hoja, tipografía y márgenes para exportación a PDF.
// EN: Format presets, paper sizes, typography, and margins for PDF export.
export type PdfFormatPreset = 'standard' | 'cv' | 'apa7';
export type PdfPaperSize = 'letter' | 'a4';
export type PdfFontFamily = 'system' | 'arial' | 'calibri' | 'times' | 'georgia';
export type PdfCvMargin = 'normal' | 'compact';

/**
 * ES: Representa una carpeta de organización de documentos.
 * EN: Represents a document organization folder.
 */
export interface FolderItem {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  isExpanded?: boolean;
}

/**
 * ES: Representa un documento dentro del estudio. Extensible para futuras características (etiquetas, favoritos, carpetas, etc.).
 * EN: Represents a document within the studio. Extensible for future features (tags, favorites, folders, etc.).
 */
export interface DocumentItem {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  createdAt?: number;
  tags?: string[];
  isFavorite?: boolean;
  folderId?: string | null;
  hasCustomTitle?: boolean;
}

/**
 * ES: Configuración global del usuario y entorno de trabajo.
 * EN: Global user and workspace configuration.
 */
export interface Settings {
  theme: ThemeMode;
  viewMode: ViewMode;
  fontSize: FontSize;
  codeTheme: CodeThemeId;
  syncScroll: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  splitRatio: number; // ES: Porcentaje del panel izquierdo (Editor), por defecto 50 / EN: Left pane percentage (Editor), default 50
  wordWrap: boolean;
  includePdfUrl?: boolean;
  pdfPreset?: PdfFormatPreset;
  pdfPaperSize?: PdfPaperSize;
  pdfFontFamily?: PdfFontFamily;
  pdfFontSizePt?: number;
  pdfFontSizeCustom?: boolean;
  pdfCvMargin?: PdfCvMargin;
}

/**
 * ES: Encabezado procesado para la Tabla de Contenidos (TOC).
 * EN: Processed heading for the Table of Contents (TOC).
 */
export interface TocHeading {
  id: string;
  text: string;
  level: number;
}
