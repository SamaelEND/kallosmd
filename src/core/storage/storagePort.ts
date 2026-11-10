/**
 * ES: Contrato común (Puerto) para los adaptadores de almacenamiento local (IndexedDB o File System Access API).
 * EN: Common contract (Port) for local storage adapters (IndexedDB or File System Access API).
 */

import type { DocumentItem, FolderItem, RecoveryDraft } from "../types";

export interface StorageAdapter {
  getAllDrafts(): Promise<RecoveryDraft[]>;
  saveDraft(draft: RecoveryDraft): Promise<void>;
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

