/** ES: Migración transaccional de identidades sin descartar la copia durable anterior ante fallos.
 * EN: Transactional identity migration without dropping the previous durable copy on failure. */
import { getDraftKey, toPlainDraft } from "../../core/storage/documentRecords";
import { directoryAt } from "../../core/storage/fileSystemAdapter";
import { EntryCollisionError, splitWorkspacePath } from "../../core/storage/workspaceOperations";
import type { DirectoryHandle } from "../../core/storage/workspacePort";
import { writeActiveDocumentCache, writeActiveDocumentId } from "../../core/storage/localCache";
import type { DocumentIdentity, RecoveryDraft, SaveFileHandle } from "../../core/types";
import type { DocumentStore } from "./vaultStore.svelte";

function affected(store: DocumentStore, workspaceId: string, path: string) {
  return Object.entries(store.versions).filter(([, version]) => version.identity.kind === "file"
    && version.identity.workspaceId === workspaceId
    && (version.identity.path === path || version.identity.path.startsWith(path + "/")));
}

/** ES: No reemplaza un borrador que ya ocupaba el destino aunque el archivo no exista en disco.
 * EN: Never replaces a draft already occupying the target even if its disk file is missing. */
export function assertWorkspaceDestination(store: DocumentStore, workspaceId: string, path: string, newPath: string): void {
  const entries = affected(store, workspaceId, path);
  const moving = new Set(entries.map(([key]) => key));
  for (const [, version] of entries) {
    if (version.identity.kind !== "file") continue;
    const key = getDraftKey({ kind: "file", workspaceId, path: newPath + version.identity.path.slice(path.length) });
    if (store.versions[key] && !moving.has(key)) throw new EntryCollisionError();
  }
}

export async function renameWorkspaceDrafts(
  store: DocumentStore, workspaceId: string, oldPath: string, newPath: string,
  newHandle?: SaveFileHandle, root?: DirectoryHandle,
): Promise<boolean> {
  if (oldPath === newPath) return true;
  await store.initialize();
  if (!await store.flushPendingSave() && store.persistence.hasPendingWrites) return false;
  return store.persistence.run(async () => {
    assertWorkspaceDestination(store, workspaceId, oldPath, newPath);
    const moves = [];
    for (const [oldKey, version] of affected(store, workspaceId, oldPath)) {
      if (version.identity.kind !== "file") continue;
      const path = newPath + version.identity.path.slice(oldPath.length);
      const identity: DocumentIdentity = { kind: "file", workspaceId, path };
      let handle = version.identity.path === oldPath ? newHandle ?? version.fileHandle : version.fileHandle;
      if (root) {
        const { parentPath, name } = splitWorkspacePath(path);
        handle = await (await directoryAt(root, parentPath)).getFileHandle(name);
      }
      const newKey = getDraftKey(identity);
      moves.push({ oldKey, newKey, identity, version, handle, title: path.split("/").pop()! });
    }
    const drafts: RecoveryDraft[] = [];
    for (const move of moves) {
      const document = store.recoveries[move.oldKey]?.document ?? store.documents.find(d => d.id === move.oldKey);
      if (document && (store.recoveries[move.oldKey] || document.content !== move.version.confirmedContent)) {
        drafts.push(toPlainDraft({ ...move.version, identity: move.identity, key: move.newKey,
          document: { ...document, id: move.newKey, title: move.title, hasCustomTitle: true },
          ...(move.handle ? { fileHandle: move.handle } : {}) }));
      }
    }
    // ES: No publica nuevas identidades ni elimina borradores hasta confirmar toda la transacción.
    // EN: Never publish new identities or drop drafts before the entire transaction is confirmed.
    if (moves.length) await store.storage.replaceDrafts(moves.map(m => m.oldKey), drafts);
    for (const move of moves) {
      store.persistence.forgetPending(move.oldKey);
      if (!store.versions[move.oldKey]) continue;
      const version = { ...store.versions[move.oldKey], identity: move.identity,
        ...(move.handle ? { fileHandle: move.handle } : {}) };
      store.versions[move.newKey] = version;
      delete store.versions[move.oldKey];
      store.fileSave.forget(move.oldKey);
      const doc = store.documents.find(d => d.id === move.oldKey);
      if (doc) { doc.id = move.newKey; doc.title = move.title; doc.hasCustomTitle = true; }
      const recovery = store.recoveries[move.oldKey];
      if (recovery) {
        const migrated = toPlainDraft({ ...recovery, ...version, key: move.newKey,
          document: { ...recovery.document, id: move.newKey, title: move.title, hasCustomTitle: true } });
        store.recoveries[move.newKey] = migrated;
        delete store.recoveries[move.oldKey];
        if (store.recoveryCandidate?.key === move.oldKey) store.recoveryCandidate = migrated;
      }
      if (store.activeId === move.oldKey) { store.activeId = move.newKey; writeActiveDocumentId(move.newKey); }
      // ES: Reprograma la versión más reciente; invalida flush obsoletos de la identidad anterior.
      // EN: Reschedule the latest version; invalidate stale flushes for the previous identity.
      const latest = store.recoveries[move.newKey]?.document ?? doc;
      if (latest && (recovery || latest.content !== version.confirmedContent)) store.persistence.schedule(latest, version);
    }
    writeActiveDocumentCache(store.activeDocument);
    store.persistence.settleDraftMutation();
  }, true);
}

export async function deleteWorkspaceDrafts(store: DocumentStore, workspaceId: string, path: string): Promise<boolean> {
  await store.initialize();
  if (!await store.flushPendingSave() && store.persistence.hasPendingWrites) return false;
  return store.persistence.run(async () => {
    const keys = affected(store, workspaceId, path).map(([key]) => key);
    if (keys.length) await store.storage.replaceDrafts(keys, []);
    for (const key of keys) {
      store.persistence.forgetPending(key);
      store.fileSave.forget(key);
      store.documents = store.documents.filter(d => d.id !== key);
      delete store.versions[key]; delete store.recoveries[key];
      if (store.recoveryCandidate?.key === key) store.recoveryCandidate = null;
      if (store.activeId === key) store.closeActiveDocument();
    }
    store.persistence.settleDraftMutation();
  }, true);
}
