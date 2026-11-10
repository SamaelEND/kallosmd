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
