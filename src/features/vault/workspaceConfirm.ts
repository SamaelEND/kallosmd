/**
 * ES: Migración durable del primer guardado a una identidad de archivo.
 * EN: Durable migration of the first save to a file identity.
 */
import { getDraftKey, toPlainDoc, toPlainDraft } from "../../core/storage/documentRecords";
import { writeActiveDocumentCache, writeActiveDocumentId } from "../../core/storage/localCache";
import type { StorageAdapter } from "../../core/storage/storagePort";
import type { DocumentItem, DocumentVersion, RecoveryDraft, SaveFileHandle } from "../../core/types";
import type { ManualSave, WorkspaceSaveTarget } from "./manualSave.svelte";
import type { VaultPersistence } from "./vaultPersistence.svelte";

export interface WorkspaceConfirmStore {
  documents: DocumentItem[];
  versions: Record<string, DocumentVersion>;
  recoveries: Record<string, RecoveryDraft>;
  activeId: string;
  recoveryCandidate: RecoveryDraft | null;
  storage: StorageAdapter;
  persistence: VaultPersistence;
  fileSave: ManualSave;
}

/** ES: La identidad solo cambia cuando la migración durable confirma.
 * EN: Identity changes only after the durable migration succeeds. */
export function confirmWorkspaceSave(
  store: WorkspaceConfirmStore,
  snapshot: DocumentItem,
  handle: SaveFileHandle,
  target: WorkspaceSaveTarget,
): Promise<boolean> {
  const doc = store.documents.find(d => d.id === snapshot.id);
  const oldVersion = store.versions[snapshot.id];
  if (!doc || !oldVersion) return Promise.resolve(true);
  const identity = { kind: "file" as const, workspaceId: target.workspaceId, path: target.path };
  const newId = getDraftKey(identity);
  const oldKey = getDraftKey(oldVersion.identity);
  if (newId !== snapshot.id && store.versions[newId]) return Promise.resolve(false);

  const newVersion: DocumentVersion = { identity, confirmedContent: snapshot.content, fileHandle: handle };

  return store.persistence.run(async () => {
    const current = store.documents.find(d => d.id === snapshot.id);
    const needsDraft = !!current && current.content !== newVersion.confirmedContent;
    // ES: El borrador migrado ya usa la identidad de archivo, también en su documento interno.
    // EN: The migrated draft already uses the file identity, including its inner document.
    const migratedDoc = current
      ? { ...toPlainDoc(current), id: newId, title: handle.name, hasCustomTitle: true }
      : null;
    const draft = needsDraft && migratedDoc
      ? toPlainDraft({ key: newId, ...newVersion, document: migratedDoc }) : null;
    await store.storage.replaceDrafts([oldKey], draft ? [draft] : []);
  }, true).then(async migrated => {
    if (!migrated) {
      const current = store.documents.find(d => d.id === snapshot.id);
      if (current) {
        store.persistence.schedule(current, oldVersion);
        // ES: Intenta dejar durable la última edición antes de informar del fallo.
        // EN: Attempts to make the latest edit durable before reporting failure.
        await store.persistence.flush();
        store.persistence.state = "error";
      }
      return false;
    }

    store.persistence.forgetPending(oldKey);
    delete store.versions[snapshot.id];
    store.versions[newId] = newVersion;
    const recovery = store.recoveries[snapshot.id];
    if (recovery) {
      const migratedDraft = toPlainDraft({ ...recovery, ...newVersion, key: newId,
        document: { ...recovery.document, id: newId, title: handle.name, hasCustomTitle: true } });
      store.recoveries[newId] = migratedDraft;
      delete store.recoveries[snapshot.id];
      if (store.recoveryCandidate?.key === oldKey) store.recoveryCandidate = migratedDraft;
    }
    doc.id = newId;
    doc.title = handle.name;
    doc.hasCustomTitle = true;
    if (store.activeId === snapshot.id) {
      store.activeId = newId;
      writeActiveDocumentId(newId);
    }
    store.fileSave.reidentify(snapshot.id, newId);
    writeActiveDocumentCache(doc);

    // ES: Las ediciones posteriores a la migración deben quedar protegidas bajo la nueva identidad.
    // EN: Edits after migration must be protected under the new identity.
    const latest = store.documents.find(d => d.id === newId);
    if (latest && latest.content !== newVersion.confirmedContent) {
      const protectedLatest = await store.persistence.confirmWrite(newVersion, () => store.documents.find(d => d.id === newId));
      if (!protectedLatest) {
        await store.persistence.flush();
        return false;
      }
    }
    return true;
  });
}
