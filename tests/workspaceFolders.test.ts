/** ES: Creación explícita y no destructiva de carpetas reales.
 * EN: Explicit, non-destructive creation of real directories. */
import test from "node:test";
import assert from "node:assert/strict";
import { WorkspaceStore } from "../src/features/vault/workspaceStore.svelte.ts";
import { DocumentStore } from "../src/features/vault/vaultStore.svelte.ts";
import type { DirectoryHandle, WorkspaceFileHandle } from "../src/core/storage/workspacePort.ts";
import { memoryStorage, deferred } from "./helpers.ts";

function fixture() {
  let permission: PermissionState = "granted";
  let writeRequests = 0;
  let creations = 0;
  function directory(name: string): DirectoryHandle & { entries: Map<string, DirectoryHandle | WorkspaceFileHandle> } {
    const entries = new Map<string, DirectoryHandle | WorkspaceFileHandle>();
    const handle = {
      kind: "directory" as const, name, entries,
      async *values() { yield* entries.values(); },
      async getDirectoryHandle(childName: string, options?: { create?: boolean }) {
        const found = entries.get(childName);
        if (found?.kind === "file") throw new DOMException("File exists", "TypeMismatchError");
        if (found) return found;
        if (!options?.create) throw new DOMException("Missing directory", "NotFoundError");
        creations++;
        const child = directory(childName);
        entries.set(childName, child);
        return child;
      },
      getFileHandle: async () => { throw new Error("No files"); },
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
  const parent = directory("Existing");
  root.entries.set(parent.name, parent);
  const storage = memoryStorage();
  const documents = new DocumentStore(storage);
  const workspace = new WorkspaceStore(documents, {
    getWorkspaces: async () => [], saveWorkspace: async () => {},
  }, () => Promise.resolve(root));
  return { workspace, documents, storage, root, parent,
    writeRequests: () => writeRequests, creations: () => creations,
    deny: () => { permission = "denied"; } };
}

test("choosing and browsing never requests write permission or creates folders", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  await f.workspace.list("Existing");
  assert.equal(f.creations(), 0);
  assert.equal(f.writeRequests(), 0);
});

test("explicit creation adds exactly one named folder without importing or changing the editor", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  const draft = f.documents.createDocument("draft.md", "pending work");
  assert.equal(await f.workspace.createFolder("", "Álgebra 🧮"), true);
  assert.equal(f.root.entries.has("Álgebra 🧮"), true);
  assert.equal(f.workspace.createdFolder, "Álgebra 🧮");
  assert.equal(f.creations(), 1);
  assert.equal(f.workspace.entries.some(e => e.name === "Álgebra 🧮"), true);
  assert.equal(f.documents.activeId, draft.id);
  await f.documents.flushPendingSave();
  assert.equal(f.storage.docs.size, 0);
  assert.equal(f.storage.drafts.size, 1);
});

test("a subfolder is created only within the explicit existing parent", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  assert.equal(await f.workspace.createFolder("Existing", "Child"), true);
  assert.equal(f.parent.entries.has("Child"), true);
  assert.equal(f.root.entries.has("Child"), false);
  assert.equal(f.workspace.createdFolder, "Existing/Child");
  assert.equal(f.creations(), 1);
});

test("invalid names and paths are rejected before permission or disk mutation", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  for (const name of ["", " ", ".", "..", "../escape", "a/b", "a\\b", "bad\u0000", "trailing.", " padded", "CON", "lpt1.txt", "a".repeat(256)]) {
    assert.equal(await f.workspace.createFolder("", name), false, name);
    assert.equal(f.workspace.error, "invalidName");
  }
  assert.equal(await f.workspace.createFolder("../outside", "Child"), false);
  assert.equal(f.creations(), 0);
  assert.equal(f.writeRequests(), 0);
});

test("existing names are rejected without changing folders, including case collisions", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  for (const name of ["Existing", "existing", "EXISTING"]) {
    assert.equal(await f.workspace.createFolder("", name), false);
    assert.equal(f.workspace.error, "collision");
  }
  assert.equal(f.creations(), 0);
  assert.equal(f.root.entries.get("Existing"), f.parent);
});

test("permission request starts synchronously from confirmation and denial preserves all content", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  f.deny();
  const creating = f.workspace.createFolder("", "Denied");
  assert.equal(f.writeRequests(), 1);
  assert.equal(await creating, false);
  assert.equal(f.workspace.error, "permission");
  assert.equal(f.creations(), 0);
});

test("missing parents are never implicitly created", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  assert.equal(await f.workspace.createFolder("Missing/Parent", "Child"), false);
  assert.equal(f.creations(), 0);
  assert.equal(f.workspace.error, "write");
});

test("failed native creation preserves the tree and reports failure without success", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  f.root.getDirectoryHandle = async () => { throw new Error("Disk full"); };
  assert.equal(await f.workspace.createFolder("", "Child"), false);
  assert.equal(f.workspace.createdFolder, "");
  assert.equal(f.workspace.error, "write");
  assert.equal(f.root.entries.size, 1);
});

test("a refresh failure after creation still reports the confirmed folder separately", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  const create = f.root.getDirectoryHandle;
  f.root.getDirectoryHandle = async (name, options) => {
    const result = await create(name, options);
    f.root.values = async function* () { throw new Error("Cannot refresh"); };
    return result;
  };
  assert.equal(await f.workspace.createFolder("", "Created"), true);
  assert.equal(f.root.entries.has("Created"), true);
  assert.equal(f.workspace.createdFolder, "Created");
  assert.equal(f.workspace.error, "read");
});

test("concurrent confirmation cannot duplicate work or change workspace during creation", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  const release = deferred();
  f.root.requestPermission = async () => { await release.promise; return "granted"; };
  const creating = f.workspace.createFolder("", "Only once");
  assert.equal(await f.workspace.createFolder("", "Other"), false);
  const current = f.workspace.current;
  f.workspace.close();
  assert.equal(f.workspace.current, current);
  release.resolve();
  assert.equal(await creating, true);
  assert.equal(f.creations(), 1);
});

test("a file with the requested name is preserved without reading or overwriting its content", async () => {
  const f = fixture();
  const file: WorkspaceFileHandle = {
    kind: "file", name: "report.md",
    getFile: async () => { throw new Error("Must not read files"); },
    createWritable: async () => { throw new Error("Must not write files"); },
    isSameEntry: async () => false,
  };
  f.root.entries.set(file.name, file);
  await f.documents.initialize();
  await f.workspace.choose();
  assert.equal(await f.workspace.createFolder("", "REPORT.MD"), false);
  assert.equal(f.workspace.error, "collision");
  assert.equal(f.root.entries.get(file.name), file);
  assert.equal(f.creations(), 0);
});

test("a rejected permission prompt is reported without creating anything", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  f.root.requestPermission = async () => { throw new DOMException("Denied", "NotAllowedError"); };
  assert.equal(await f.workspace.createFolder("", "Child"), false);
  assert.equal(f.workspace.error, "permission");
  assert.equal(f.creations(), 0);
});
