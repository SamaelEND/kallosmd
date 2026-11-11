/**
 * ES: Adaptador en memoria y señales controlables para pruebas de persistencia.
 * EN: In-memory adapter and controllable signals for persistence tests.
 */
import type { StorageAdapter } from "../src/core/storage/storagePort.ts";
import { BackupChangedError, BackupCollisionError } from "../src/core/storage/backupFormat.ts";
import type { DocumentItem, FolderItem, RecoveryDraft } from "../src/core/types/index.ts";

// ES: Los dobles de handles contienen métodos; el navegador clona los handles nativos, no sus métodos.
// EN: Handle test doubles contain methods; the browser clones native handles rather than their methods.
function cloneDraft(draft: RecoveryDraft): RecoveryDraft {
  const { fileHandle, ...record } = draft;
  return { ...structuredClone(record), ...(fileHandle ? { fileHandle } : {}) };
}

export function memoryStorage() {
  const docs = new Map<string, DocumentItem>();
  const folders = new Map<string, FolderItem>();
  const drafts = new Map<string, RecoveryDraft>();
  const storage: StorageAdapter = {
    getAllDocuments: async () => [...docs.values()].map(d => ({ ...d })),
    getAllFolders: async () => [...folders.values()].map(f => ({ ...f })),
    saveDocument: async doc => { docs.set(doc.id, { ...doc }); },
    saveAllDocuments: async items => { for (const doc of items) docs.set(doc.id, { ...doc }); },
    deleteDocument: async id => { docs.delete(id); },
    retireDocumentIfUnchanged: async (id, draftKey, expected) => {
      const doc = docs.get(id);
      const draft = drafts.get(draftKey);
      const isNewer = (record: { content: string; updatedAt: number } | undefined) =>
        Boolean(record) && (
          record!.updatedAt > expected.updatedAt
          || (record!.updatedAt === expected.updatedAt && record!.content !== expected.content)
        );
      if (isNewer(doc) || isNewer(draft?.document)) return "edited";
      if (!doc && !draft) return "missing";
      docs.delete(id);
      drafts.delete(draftKey);
      return "retired";
    },
    clearAllDocuments: async () => { docs.clear(); },
    getAllDrafts: async () => [...drafts.values()].map(cloneDraft),
    saveDraft: async draft => { drafts.set(draft.key, cloneDraft(draft)); },
    replaceDrafts: async (keys, records) => {
      const next = new Map(drafts);
      for (const key of keys) next.delete(key);
      for (const record of records) next.set(record.key, cloneDraft(record));
      drafts.clear();
      for (const [key, record] of next) drafts.set(key, record);
    },
    deleteDraft: async key => { drafts.delete(key); },
    clearAllDrafts: async () => { drafts.clear(); },
    restoreBackup: async (plan) => {
      const documentIds = new Set([
        ...plan.documents.map(document => document.id),
        ...plan.drafts.map(draft => draft.document.id),
      ]);
      const folderIds = new Set(plan.folders.map(folder => folder.id));
      const draftKeys = new Set(plan.drafts.map(draft => draft.key));
      const collides = [...docs.keys()].some(id => documentIds.has(id))
        || [...folders.keys()].some(id => folderIds.has(id))
        || [...drafts.values()].some(draft => draftKeys.has(draft.key)
          || documentIds.has(draft.document.id));
      if (!plan.replace && collides) throw new BackupCollisionError();
      if (plan.guard && !plan.guard()) throw new BackupChangedError();
      const nextDocs = new Map(docs);
      const nextFolders = new Map(folders);
      const nextDrafts = new Map(drafts);
      if (plan.replace) {
        for (const id of documentIds) nextDocs.delete(id);
        for (const id of folderIds) nextFolders.delete(id);
        for (const draft of drafts.values()) {
          if (draftKeys.has(draft.key) || documentIds.has(draft.document.id)) nextDrafts.delete(draft.key);
        }
      }
      for (const document of plan.documents) nextDocs.set(document.id, { ...document });
      for (const folder of plan.folders) nextFolders.set(folder.id, { ...folder });
      for (const draft of plan.drafts) nextDrafts.set(draft.key, cloneDraft(draft as RecoveryDraft));
      if (plan.guard && !plan.guard()) throw new BackupChangedError();
      docs.clear(); for (const [id, document] of nextDocs) docs.set(id, document);
      folders.clear(); for (const [id, folder] of nextFolders) folders.set(id, folder);
      drafts.clear(); for (const [key, draft] of nextDrafts) drafts.set(key, draft);
    },
    saveFolder: async folder => { folders.set(folder.id, { ...folder }); },
    saveAllFolders: async items => { for (const folder of items) folders.set(folder.id, { ...folder }); },
    deleteFolder: async id => { folders.delete(id); },
    clearAllFolders: async () => { folders.clear(); },
  };
  return Object.assign(storage, { docs, folders, drafts });
}

export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
