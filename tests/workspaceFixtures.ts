/** ES: Sistema de archivos sintético para regresiones de operaciones explícitas.
 * EN: Synthetic filesystem for explicit-operation regressions. */
import { WorkspaceStore } from "../src/features/vault/workspaceStore.svelte.ts";
import { DocumentStore } from "../src/features/vault/vaultStore.svelte.ts";
import type { DirectoryHandle, WorkspaceFileHandle, WorkspaceReference } from "../src/core/storage/workspacePort.ts";
import { memoryStorage } from "./helpers.ts";

export function workspaceFixture(options: { overwriteOnMoveCollision?: boolean } = {}) {
  let permission: PermissionState = "granted";
  let writeRequests = 0;

  function file(
    name: string,
    initialContent = "# Note",
    getParentEntries?: () => Map<string, DirectoryHandle | (WorkspaceFileHandle & { content: string })>,
  ): WorkspaceFileHandle & { content: string } {
    let currentContent = initialContent;
    let fileName = name;
    const handle: WorkspaceFileHandle & { content: string } = {
      kind: "file" as const,
      get name() { return fileName; },
      get content() { return currentContent; },
      set content(val: string) { currentContent = val; },
      getFile: async () => ({
        name: fileName,
        text: async () => currentContent,
      }),
      createWritable: async () => {
        let buffer = currentContent;
        return {
          write: async (chunk: string) => { buffer = chunk; },
          close: async () => { currentContent = buffer; },
          abort: async () => {},
        };
      },
      isSameEntry: async (other: unknown) => other === handle,
      move: async (destOrName: DirectoryHandle | string, newName?: string) => {
        const parentEntries = getParentEntries?.();
        if (typeof destOrName === "string") {
          if (!options.overwriteOnMoveCollision && parentEntries?.has(destOrName) && parentEntries.get(destOrName) !== handle) {
            throw new DOMException("Destination exists", "InvalidModificationError");
          }
          parentEntries?.delete(fileName);
          fileName = destOrName;
          parentEntries?.set(fileName, handle);
        } else {
          const targetName = newName ?? fileName;
          const targetEntries = (destOrName as ReturnType<typeof directory>).entries;
          if (!options.overwriteOnMoveCollision && targetEntries?.has(targetName) && targetEntries.get(targetName) !== handle) {
            throw new DOMException("Destination exists", "InvalidModificationError");
          }
          parentEntries?.delete(fileName);
          fileName = targetName;
          targetEntries?.set(fileName, handle);
        }
      },
    };
    return handle;
  }

  function directory(
    name: string,
    getParentEntries?: () => Map<string, DirectoryHandle | (WorkspaceFileHandle & { content: string })>,
  ): DirectoryHandle & {
    entries: Map<string, DirectoryHandle | (WorkspaceFileHandle & { content: string })>;
    dirName: string;
  } {
    let dirName = name;
    const entries = new Map<string, DirectoryHandle | (WorkspaceFileHandle & { content: string })>();
    const handle = {
      kind: "directory" as const,
      get name() { return dirName; },
      entries,
      get dirName() { return dirName; },
      set dirName(val: string) { dirName = val; },
      async *values() { yield* entries.values(); },
      async getDirectoryHandle(childName: string, options?: { create?: boolean }) {
        const found = entries.get(childName);
        if (found?.kind === "file") throw new DOMException("File exists", "TypeMismatchError");
        if (found) return found as DirectoryHandle;
        if (!options?.create) throw new DOMException("Missing directory", "NotFoundError");
        const child = directory(childName, () => entries);
        entries.set(childName, child);
        return child;
      },
      async getFileHandle(childName: string, options?: { create?: boolean }) {
        const found = entries.get(childName);
        if (found?.kind === "directory") throw new DOMException("Directory exists", "TypeMismatchError");
        if (found) return found as WorkspaceFileHandle;
        if (!options?.create) throw new DOMException("Missing file", "NotFoundError");
        const newFile = file(childName, "", () => entries);
        entries.set(childName, newFile);
        return newFile;
      },
      async removeEntry(childName: string, _options?: { recursive?: boolean }) {
        if (!entries.has(childName)) throw new DOMException("Entry not found", "NotFoundError");
        entries.delete(childName);
      },
      move: async (destOrName: DirectoryHandle | string, newName?: string) => {
        const parentEntries = getParentEntries?.();
        if (typeof destOrName === "string") {
          if (!options.overwriteOnMoveCollision && parentEntries?.has(destOrName) && parentEntries.get(destOrName) !== handle) {
            throw new DOMException("Destination exists", "InvalidModificationError");
          }
          parentEntries?.delete(dirName);
          dirName = destOrName;
          parentEntries?.set(dirName, handle);
        } else {
          const targetName = newName ?? dirName;
          if (!options.overwriteOnMoveCollision && (destOrName as ReturnType<typeof directory>).entries?.has(targetName)) {
            throw new DOMException("Destination exists", "InvalidModificationError");
          }
          parentEntries?.delete(dirName);
          dirName = targetName;
          (destOrName as ReturnType<typeof directory>).entries?.set(dirName, handle);
        }
      },
      isSameEntry: async (other: DirectoryHandle) => other === handle,
      queryPermission: async () => "granted" as const,
      requestPermission: (options: { mode: "read" | "readwrite" }) => {
        if (options.mode === "readwrite") writeRequests++;
        return Promise.resolve(permission);
      },
    };
    return handle;
  }

  const root = directory("Workspace");
  const notesDir = directory("notes", () => root.entries);
  const initialFile = file("guide.md", "# Original Content", () => notesDir.entries);
  notesDir.entries.set(initialFile.name, initialFile);
  root.entries.set(notesDir.name, notesDir);

  const records: WorkspaceReference[] = [];
  const port = {
    getWorkspaces: async () => [...records],
    saveWorkspace: async (record: WorkspaceReference) => {
      const index = records.findIndex((r) => r.id === record.id);
      if (index < 0) records.push(record); else records[index] = record;
    },
  };

  const storage = memoryStorage();
  const documents = new DocumentStore(storage);
  const workspace = new WorkspaceStore(documents, port, () => Promise.resolve(root));

  return {
    workspace,
    documents,
    storage,
    port,
    records,
    root,
    notesDir,
    initialFile,
    writeRequests: () => writeRequests,
    deny: () => { permission = "denied"; },
  };
}
