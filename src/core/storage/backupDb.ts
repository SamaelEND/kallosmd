/**
 * ES: Restauración atómica de un respaldo local en IndexedDB.
 * EN: Atomic restoration of a local backup into IndexedDB.
 */
import { getDb } from "./db";
import { toPlainDraft, toPlainDoc, toPlainFolder } from "./documentRecords";
import { BackupChangedError, BackupCollisionError, type BackupRestore } from "./backupFormat";
import type { RecoveryDraft } from "../types";

export async function restoreBackupToDb(plan: BackupRestore): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["documents", "folders", "recoveryDrafts"], "readwrite");
  try {
    const documentsStore = tx.objectStore("documents");
    const foldersStore = tx.objectStore("folders");
    const draftsStore = tx.objectStore("recoveryDrafts");
    const [documents, folders, drafts] = await Promise.all([
      documentsStore.getAll(), foldersStore.getAll(), draftsStore.getAll(),
    ]);

    const documentIds = new Set([
      ...plan.documents.map(document => document.id),
      ...plan.drafts.map(draft => draft.document.id),
    ]);
    const folderIds = new Set(plan.folders.map(folder => folder.id));
    const draftKeys = new Set(plan.drafts.map(draft => draft.key));
    const collides = documents.some(document => documentIds.has(document.id))
      || folders.some(folder => folderIds.has(folder.id))
      || drafts.some(draft => draftKeys.has(draft.key) || documentIds.has(draft.document.id));
    if (!plan.replace && collides) throw new BackupCollisionError();
    if (plan.guard && !plan.guard()) throw new BackupChangedError();

    if (plan.replace) {
      for (const document of documents) {
        if (documentIds.has(document.id)) await documentsStore.delete(document.id);
      }
      for (const folder of folders) {
        if (folderIds.has(folder.id)) await foldersStore.delete(folder.id);
      }
      for (const draft of drafts) {
        if (draftKeys.has(draft.key) || documentIds.has(draft.document.id)) {
          await draftsStore.delete(draft.key);
        }
      }
    }

    for (const document of plan.documents) await documentsStore.put(toPlainDoc(document));
    for (const folder of plan.folders) await foldersStore.put(toPlainFolder(folder));
    for (const draft of plan.drafts) {
      await draftsStore.put(toPlainDraft(draft as RecoveryDraft));
    }
    // ES: Una edición durante las escrituras aborta todo antes de confirmar.
    // EN: An edit during writes aborts everything before committing.
    if (plan.guard && !plan.guard()) throw new BackupChangedError();
    await tx.done;
  } catch (error) {
    try { tx.abort(); } catch { /* ES: Puede estar abortada. EN: May already be aborted. */ }
    await tx.done.catch(() => {});
    throw error;
  }
}
