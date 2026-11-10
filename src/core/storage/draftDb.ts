/**
 * ES: Persistencia de borradores separada de la colección anterior de documentos.
 * EN: Draft persistence kept separate from the previous document collection.
 */
import type { RecoveryDraft } from "../types";
import { getDb } from "./db";
import { toPlainDraft } from "./documentRecords";

export async function getAllDraftsFromDb(): Promise<RecoveryDraft[]> {
  const db = await getDb();
  return (await db.getAll("recoveryDrafts")).map(toPlainDraft);
}

export async function saveDraftToDb(draft: RecoveryDraft): Promise<void> {
  const db = await getDb();
  await db.put("recoveryDrafts", toPlainDraft(draft));
}

export async function deleteDraftFromDb(key: string): Promise<void> {
  const db = await getDb();
  await db.delete("recoveryDrafts", key);
}

export async function clearAllDraftsFromDb(): Promise<void> {
  const db = await getDb();
  await db.clear("recoveryDrafts");
}

/** ES: Sustituye todas las claves de una migración en una transacción, o conserva todas las anteriores.
 * EN: Replaces all migration keys in one transaction, or retains all previous keys. */
export async function replaceDraftsInDb(oldKeys: string[], drafts: RecoveryDraft[]): Promise<void> {
  const records = drafts.map(toPlainDraft);
  const tx = (await getDb()).transaction("recoveryDrafts", "readwrite");
  try {
    for (const key of oldKeys) await tx.store.delete(key);
    for (const record of records) await tx.store.put(record);
    await tx.done;
  } catch (error) {
    try { tx.abort(); } catch { /* ES: Puede estar abortada. EN: May already be aborted. */ }
    await tx.done.catch(() => {});
    throw error;
  }
}
