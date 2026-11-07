/**
 * Utilidades de caché síncrono en localStorage para el documento activo.
 * Permite arranque instantáneo antes de resolver IndexedDB.
 */

import { STORAGE_KEYS } from "../markdown/defaultDocument";
import type { DocumentItem } from "../types";

/**
 * Elimina claves heredadas de versiones anteriores en localStorage.
 */
export function clearLegacyStorageKeys(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEYS.DOCS);
    localStorage.removeItem(STORAGE_KEYS.TRANSITIONAL_DOCS);
  } catch {
    // Ignorar errores de cuota o acceso
  }
}

/**
 * Recupera el ID del documento activo y la instantánea en caché desde localStorage.
 */
export function readCachedActiveDocument(): {
  activeId: string;
  cachedDoc: DocumentItem | null;
} {
  if (typeof window === "undefined") {
    return { activeId: "", cachedDoc: null };
  }

  let activeId = "";
  let cachedDoc: DocumentItem | null = null;

  try {
    const savedActiveId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ID);
    if (savedActiveId) {
      activeId = savedActiveId;
    }

    const cachedActiveRaw = localStorage.getItem(
      STORAGE_KEYS.ACTIVE_DOC_CACHE,
    );
    if (cachedActiveRaw) {
      const parsed = JSON.parse(cachedActiveRaw);
      if (parsed && parsed.id) {
        cachedDoc = parsed as DocumentItem;
        if (!activeId) activeId = cachedDoc.id;
      }
    }
  } catch {
    // Ignorar errores de parseo en caché inicial
  }

  return { activeId, cachedDoc };
}

/**
 * Persiste el identificador del documento activo en localStorage.
 */
export function writeActiveDocumentId(activeId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, activeId);
  } catch {
    // Ignorar errores de cuota
  }
}

/**
 * Guarda una instantánea ligera del documento activo en localStorage.
 */
export function writeActiveDocumentCache(doc: DocumentItem | undefined): void {
  if (typeof window === "undefined") return;
  try {
    if (doc) {
      localStorage.setItem(
        STORAGE_KEYS.ACTIVE_DOC_CACHE,
        JSON.stringify({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          folderId: doc.folderId || null,
          hasCustomTitle: Boolean(doc.hasCustomTitle),
        }),
      );
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_DOC_CACHE);
    }
  } catch {
    // Ignorar errores de cuota
  }
}

