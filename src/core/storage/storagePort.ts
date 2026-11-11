/**
 * ES: Contrato común (Puerto) para los adaptadores de almacenamiento local (IndexedDB o File System Access API).
 * EN: Common contract (Port) for local storage adapters (IndexedDB or File System Access API).
 */

import type { DocumentItem, FolderItem, RecoveryDraft } from "../types";
import type { BackupRestore } from "./backupFormat";

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
  clearAllDocuments(): Promise<void>;

  getAllFolders(): Promise<FolderItem[]>;
  saveFolder(folder: FolderItem): Promise<void>;
  saveAllFolders(folders: FolderItem[]): Promise<void>;
  deleteFolder(id: string): Promise<void>;
  clearAllFolders(): Promise<void>;
}

