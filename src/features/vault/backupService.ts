/**
 * ES: Exportación e importación del respaldo del modo local; la validación precede a toda escritura.
 * EN: Local-mode backup export/import; validation happens before any write.
 */
import {
  BackupChangedError,
  BackupCollisionError,
  BackupValidationError,
  countBackupConflicts,
  createBackupText,
  parseBackup,
  toBackupData,
  type BackupData,
  type BackupFile,
} from "../../core/storage/backupFormat";
import type { DocumentStore } from "./vaultStore.svelte";

export type BackupFailure =
  | "malformed" | "invalidFormat" | "unsupportedVersion"
  | "read" | "flush" | "storage" | "restore" | "conflict" | "changed" | "refresh";

export type ExportBackupResult =
  | { ok: true; text: string; filename: string }
  | { ok: false; error: BackupFailure };

export type InspectBackupResult =
  | { ok: true; backup: BackupFile; conflicts: number }
  | { ok: false; error: BackupFailure };

export interface ImportCounts {
  documents: number;
  folders: number;
  drafts: number;
}

export type ImportBackupResult =
  | { ok: true; imported: ImportCounts }
  | { ok: false; error: BackupFailure };

function validationFailure(error: unknown): BackupFailure {
  return error instanceof BackupValidationError ? error.code : "storage";
}

/** ES: Fotografía la sesión para detectar ediciones que ocurran durante la importación.
 * EN: Snapshots the session to detect edits that happen during import. */
function captureSession(store: DocumentStore) {
  return {
    documents: new Map(store.documents.map(doc => [doc.id, JSON.stringify(doc)] as const)),
    folders: new Map(store.folders.map(folder => [folder.id, JSON.stringify(folder)] as const)),
  };
}

/** ES: Los cambios posteriores al commit se reaplican tras recargar; nunca se descartan.
 * EN: Changes made after commit are reapplied after reload; they are never discarded. */
function changedSession(store: DocumentStore, before: ReturnType<typeof captureSession>) {
  const documents = store.documents.filter(doc => before.documents.get(doc.id) !== JSON.stringify(doc));
  const folders = store.folders.filter(folder => before.folders.get(folder.id) !== JSON.stringify(folder));
  const removed = [
    ...[...before.documents.keys()].filter(id => !store.documents.some(doc => doc.id === id)),
    ...[...before.folders.keys()].filter(id => !store.folders.some(folder => folder.id === id)),
  ];
  const versions = Object.fromEntries(documents.flatMap(doc =>
    store.versions[doc.id] ? [[doc.id, store.versions[doc.id]] as const] : []));
  const recoveries = Object.fromEntries(documents.flatMap(doc =>
    store.recoveries[doc.id] ? [[doc.id, store.recoveries[doc.id]] as const] : []));
  return { documents, folders, versions, recoveries, removed };
}

/** ES: Lee el estado durable; un fallo o dato inválido no produce un respaldo parcial.
 * EN: Reads durable state; a failure or invalid data never produces a partial backup. */
async function readCurrent(store: DocumentStore): Promise<BackupData | null> {
  try {
    const [documents, folders, drafts] = await Promise.all([
      store.storage.getAllDocuments(), store.storage.getAllFolders(), store.storage.getAllDrafts(),
    ]);
    return toBackupData({ documents, folders, drafts });
  } catch {
    return null;
  }
}

export function backupFilename(now = new Date()): string {
  return `kallosmd-backup-${now.toISOString().replace(/[:.]/g, "-")}.json`;
}

export async function exportBackup(store: DocumentStore): Promise<ExportBackupResult> {
  if (!(await store.flushPendingSave())) return { ok: false, error: "flush" };
  const data = await readCurrent(store);
  if (!data) return { ok: false, error: "storage" };
  try {
    return { ok: true, text: createBackupText(data), filename: backupFilename() };
  } catch (error) {
    return { ok: false, error: validationFailure(error) };
  }
}

export async function inspectBackup(store: DocumentStore, text: string): Promise<InspectBackupResult> {
  let backup: BackupFile;
  try {
    backup = parseBackup(text);
  } catch (error) {
    return { ok: false, error: validationFailure(error) };
  }
  if (!(await store.flushPendingSave())) return { ok: false, error: "flush" };
  const current = await readCurrent(store);
  if (!current) return { ok: false, error: "storage" };
  return { ok: true, backup, conflicts: countBackupConflicts(current, backup) };
}

/** ES: Solo se llama después de confirmar colisiones; la restauración es atómica.
 * EN: Only called after confirming collisions; restoration is atomic. */
export async function importBackup(
  store: DocumentStore, backup: BackupFile, replace: boolean,
): Promise<ImportBackupResult> {
  // ES: El modal de colisiones puede dejar ediciones pendientes; no se descartan al recargar.
  // EN: The collision dialog may leave pending edits; they are not discarded on reload.
  if (!(await store.flushPendingSave())) return { ok: false, error: "flush" };
  const before = captureSession(store);
  const revision = store.revision;
  try {
    await store.storage.restoreBackup({
      documents: backup.documents,
      folders: backup.folders,
      drafts: backup.drafts,
      replace,
      // ES: Si el usuario edita mientras la restauración espera, se aborta antes de escribir.
      // EN: If the user edits while restoration waits, it aborts before writing.
      guard: () => store.revision === revision,
    });
  } catch (error) {
    if (error instanceof BackupChangedError) return { ok: false, error: "changed" };
    return { ok: false, error: error instanceof BackupCollisionError ? "conflict" : "restore" };
  }
  // ES: El commit ya ocurrió; una edición posterior se conserva al recargar la sesión.
  // EN: The commit already happened; a later edit is preserved when the session reloads.
  await store.reload(changedSession(store, before));
  if (!store.isReady) return { ok: false, error: "refresh" };
  return {
    ok: true,
    imported: {
      documents: backup.documents.length,
      folders: backup.folders.length,
      drafts: backup.drafts.length,
    },
  };
}
