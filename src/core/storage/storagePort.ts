/**
 * ES: Contrato común (Puerto) para los adaptadores de almacenamiento local (IndexedDB o File System Access API).
 * EN: Common contract (Port) for local storage adapters (IndexedDB or File System Access API).
 */

import type { DocumentItem, FolderItem, RecoveryDraft } from "../types";
import type { BackupRestore } from "./backupFormat";

/** ES: Resultado de retirar una copia verificada sin pisar ediciones posteriores.
 * EN: Outcome of retiring a verified copy without clobbering later edits. */
export type RetireDocumentOutcome = "retired" | "edited" | "missing";

export interface RetireExpectation {
  content: string;
  updatedAt: number;
}

export interface StorageAdapter {
  // ES: Restauración atómica de un respaldo validado; sin reemplazo falla ante colisiones.
  // EN: Atomic restore of a validated backup; without replacement it fails on collisions.
  restoreBackup(plan: BackupRestore): Promise<void>;

  getAllDrafts(): Promise<RecoveryDraft[]>;
  saveDraft(draft: RecoveryDraft): Promise<void>;
  replaceDrafts(oldKeys: string[], drafts: RecoveryDraft[]): Promise<void>;
  deleteDraft(key: string): Promise<void>;
  clearAllDrafts(): Promise<void>;

  getAllDocuments(): Promise<DocumentItem[]>;
  saveDocument(doc: DocumentItem): Promise<void>;
  saveAllDocuments(docs: DocumentItem[]): Promise<void>;
  deleteDocument(id: string): Promise<void>;
  // ES: Retira documento y borrador en una sola transacción solo si ninguno es más reciente que la versión verificada.
  // EN: Retires document and draft in a single transaction only if neither is newer than the verified version.
  retireDocumentIfUnchanged(id: string, draftKey: string, expected: RetireExpectation): Promise<RetireDocumentOutcome>;
  clearAllDocuments(): Promise<void>;

  getAllFolders(): Promise<FolderItem[]>;
  saveFolder(folder: FolderItem): Promise<void>;
  saveAllFolders(folders: FolderItem[]): Promise<void>;
  deleteFolder(id: string): Promise<void>;
  clearAllFolders(): Promise<void>;
}

