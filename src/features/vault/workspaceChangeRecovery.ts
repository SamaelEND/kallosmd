/** ES: Retoma cambios explícitos ya registrados sin repetir escrituras ni borrados en disco.
 * EN: Resumes recorded explicit changes without repeating disk writes or deletions. */
import { directoryAt } from "../../core/storage/fileSystemAdapter";
import { splitWorkspacePath } from "../../core/storage/workspaceOperations";
import type { DirectoryHandle, WorkspaceReference } from "../../core/storage/workspacePort";
import type { DocumentStore } from "./vaultStore.svelte";

export class WorkspaceStorageError extends Error {}
export class PendingWorkspaceChangeError extends Error {}

/** ES: La comparación exacta evita confundir variantes de mayúsculas en el sistema de archivos.
 * EN: Exact comparison avoids confusing case variants in the filesystem. */
export async function workspaceEntryAt(root: DirectoryHandle, path: string) {
  const { parentPath, name } = splitWorkspacePath(path);
  try {
    const parent = await directoryAt(root, parentPath);
    for await (const entry of parent.values()) if (entry.name === name) return entry;
    return null;
  } catch (error) {
    if (error instanceof Error && error.name === "NotFoundError") return null;
    throw error;
  }
}

export async function protectWorkspaceDrafts(documents: DocumentStore): Promise<void> {
  await documents.initialize();
  const protectedDrafts = await documents.flushPendingSave();
  if (!documents.isReady || (!protectedDrafts && documents.persistence.hasPendingWrites)) throw new WorkspaceStorageError();
}

export async function resumeWorkspaceChange(documents: DocumentStore, reference: WorkspaceReference): Promise<void> {
  const change = reference.pendingChange;
  if (!change) return;
  await protectWorkspaceDrafts(documents);
  const oldEntry = await workspaceEntryAt(reference.handle, change.path);
  const newEntry = change.newPath ? await workspaceEntryAt(reference.handle, change.newPath) : null;
  let synced = true;
  if (change.newPath === null) {
    if (!oldEntry) synced = await documents.deleteWorkspacePath(reference.id, change.path);
  } else if (!oldEntry && newEntry) {
    synced = await documents.renameWorkspacePath(reference.id, change.path, change.newPath,
      newEntry.kind === "file" ? newEntry : undefined, reference.handle);
  } else if (!(oldEntry && !newEntry)) {
    // ES: Una situación ambigua conserva la intención y todos los borradores para revisión explícita.
    // EN: Ambiguous states retain the intent and every draft for explicit review.
    throw new PendingWorkspaceChangeError();
  }
  if (!synced) throw new WorkspaceStorageError();
}
