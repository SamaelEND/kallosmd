/**
 * Tipos e interfaces globales para MD Studio.
 * Diseñado con arquitectura modular extensible a largo plazo.
 */

export type ThemeMode = 'dark' | 'light';
export type ViewMode = 'editor' | 'split' | 'preview';
export type FontSize = 'small' | 'medium' | 'large';

/**
 * Representa un documento dentro del estudio.
 * Extensible para futuras características (etiquetas, favoritos, carpetas, etc.).
 */
export interface DocumentItem {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  createdAt?: number;
  tags?: string[];
  isFavorite?: boolean;
}

/**
 * Configuración global del usuario y entorno de trabajo.
 */
export interface Settings {
  theme: ThemeMode;
  viewMode: ViewMode;
  fontSize: FontSize;
  syncScroll: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  splitRatio: number; // Porcentaje del panel izquierdo (Editor), por defecto 50
  wordWrap: boolean;
}

/**
 * Encabezado procesado para la Tabla de Contenidos (TOC).
 */
export interface TocHeading {
  id: string;
  text: string;
  level: number;
}
