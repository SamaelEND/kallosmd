/**
 * ES: Adaptador en memoria y señales controlables para pruebas de persistencia.
 * EN: In-memory adapter and controllable signals for persistence tests.
 */
import type { StorageAdapter } from "../src/core/storage/storagePort.ts";
import type { DocumentItem, RecoveryDraft } from "../src/core/types/index.ts";

// ES: Los dobles de handles contienen métodos; el navegador clona los handles nativos, no sus métodos.
// EN: Handle test doubles contain methods; the browser clones native handles rather than their methods.
function cloneDraft(draft: RecoveryDraft): RecoveryDraft {
  const { fileHandle, ...record } = draft;
  return { ...structuredClone(record), ...(fileHandle ? { fileHandle } : {}) };
}

export function memoryStorage() {
  const docs = new Map<string, DocumentItem>();
  const drafts = new Map<string, RecoveryDraft>();
  const storage: StorageAdapter = {
    getAllDocuments: async () => [...docs.values()].map(d => ({ ...d })),
    getAllFolders: async () => [],
    saveDocument: async doc => { docs.set(doc.id, { ...doc }); },
    saveAllDocuments: async items => { for (const doc of items) docs.set(doc.id, { ...doc }); },
    deleteDocument: async id => { docs.delete(id); },
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
    saveFolder: async () => {}, saveAllFolders: async () => {},
    deleteFolder: async () => {}, clearAllFolders: async () => {},
  };
  return Object.assign(storage, { docs, drafts });
}

export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
