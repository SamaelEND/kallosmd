/** ES: Carpeta real, permisos y apertura sin importación masiva.
 * EN: Real directory, permissions, and opening without bulk import. */
import test from "node:test";
import assert from "node:assert/strict";
import { WorkspaceStore } from "../src/features/vault/workspaceStore.svelte.ts";
import { DocumentStore } from "../src/features/vault/vaultStore.svelte.ts";
import type { DirectoryHandle, WorkspaceReference } from "../src/core/storage/workspacePort.ts";
import { memoryStorage } from "./helpers.ts";

function fixture() {
  let content = "# Original";
  let reads = 0;
  let permission: PermissionState = "granted";
  const file = {
    kind: "file" as const, name: "Name.MD",
    getFile: async () => ({ text: async () => { reads++; return content; } }),
    isSameEntry: async (other: unknown) => other === file,
    createWritable: async () => {
      let next = content;
      return { write: async (text: string) => { next = text; },
        close: async () => { content = next; }, abort: async () => {} };
    },
  };
  const child: DirectoryHandle = {
    kind: "directory", name: "Nested",
    async *values() { yield file; },
    getDirectoryHandle: async () => { throw new Error("Missing"); },
    getFileHandle: async () => file,
    isSameEntry: async other => other === child,
    queryPermission: async () => permission,
    requestPermission: async () => permission,
  };
  const root: DirectoryHandle = {
    ...child, name: "Workspace",
    async *values() { yield child; },
    getDirectoryHandle: async () => child,
    isSameEntry: async other => other === root,
  };
  const records: WorkspaceReference[] = [];
  const port = {
    getWorkspaces: async () => [...records],
    saveWorkspace: async (record: WorkspaceReference) => {
      const index = records.findIndex(r => r.id === record.id);
      if (index < 0) records.push(record); else records[index] = record;
    },
  };
  const storage = memoryStorage();
  const documents = new DocumentStore(storage);
  const workspace = new WorkspaceStore(documents, port, () => Promise.resolve(root));
  return { workspace, documents, storage, port, root, records, file,
    reads: () => reads, content: () => content,
    deny: () => { permission = "denied"; },
    externalEdit: () => { content = "external"; } };
}

test("choosing and browsing folders preserves names without reading or importing files", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  assert.equal(f.workspace.entries[0]?.name, "Nested");
  const entries = await f.workspace.list("Nested");
  assert.equal(entries[0]?.name, "Name.MD");
  assert.equal(f.reads(), 0);
  assert.equal(f.documents.activeDocument, undefined);
  assert.equal(f.storage.docs.size, 0);
  assert.equal(f.storage.drafts.size, 0);
});

test("explicit opening uses native identity and handle, then manual save writes the original", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  await f.workspace.openFile("Nested/Name.MD");
  assert.equal(f.documents.activeDocument?.title, "Name.MD");
  assert.equal(f.documents.hasUnsavedChanges, false);
  assert.equal(f.storage.drafts.size, 0);
  f.documents.updateActiveContent("# Different heading");
  await f.documents.flushPendingSave();
  assert.equal(f.content(), "# Original");
  assert.equal(f.documents.activeDocument?.title, "Name.MD");
  await f.documents.fileSave.save(f.documents.activeId);
  assert.equal(f.content(), "# Different heading");
  assert.equal(f.documents.hasUnsavedChanges, false);
});

test("reload offers reopening but never opens files, and finds the pending recovery by path", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  const workspaceId = f.workspace.current!.id;
  await f.workspace.openFile("Nested/Name.MD");
  f.documents.updateActiveContent("recover me");
  await f.documents.flushPendingSave();
  f.externalEdit();
  const documents = new DocumentStore(f.storage);
  await documents.initialize();
  const workspace = new WorkspaceStore(documents, f.port, () => Promise.resolve(f.root));
  await workspace.initialize();
  assert.equal(workspace.last?.id, workspaceId);
  assert.equal(workspace.current, null);
  assert.equal(documents.activeDocument, undefined);
  await workspace.reopen();
  assert.equal(documents.activeDocument, undefined);
  await workspace.openFile("Nested/Name.MD");
  assert.equal(documents.recoveryCandidate?.document.content, "recover me");
  documents.resolveRecovery(documents.recoveryCandidate!, true);
  await documents.fileSave.save(documents.activeId);
  assert.equal(documents.fileSave.state, "conflict");
  assert.equal(f.content(), "external");
});

test("reopening denied permissions keeps the existing session and its draft", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  const draft = f.documents.createDocument("draft.md", "keep");
  f.deny();
  await f.workspace.reopen();
  assert.equal(f.workspace.error, "permission");
  assert.equal(f.documents.activeId, draft.id);
  await f.documents.flushPendingSave();
});

test("reselecting a directory reuses its identity and cancellation preserves the session", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  const id = f.workspace.current!.id;
  await f.workspace.choose();
  assert.equal(f.workspace.current!.id, id);
  assert.equal(f.records.length, 1);
  const workspace = new WorkspaceStore(f.documents, f.port, () => Promise.reject(new DOMException("cancel", "AbortError")));
  await workspace.choose();
  assert.equal(workspace.error, null);
  assert.equal(f.workspace.current!.id, id);
});

test("opening again preserves live edits; clean files refresh from disk", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  await f.workspace.openFile("Nested/Name.MD");
  f.documents.updateActiveContent("live edits");
  await f.workspace.openFile("Nested/Name.MD");
  assert.equal(f.documents.activeDocument?.content, "live edits");
  await f.documents.fileSave.save(f.documents.activeId);
  f.externalEdit();
  await f.workspace.openFile("Nested/Name.MD");
  assert.equal(f.documents.activeDocument?.content, "external");
  await f.documents.flushPendingSave();
});

test("invalid resource paths cannot escape the workspace", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  await assert.rejects(f.workspace.readFile("../outside.md"));
  await assert.rejects(f.workspace.readFile("/absolute.md"));
  await assert.rejects(f.workspace.readFile("a\\b.md"));
});

test("failed reference persistence preserves the current editor instead of opening a partial session", async () => {
  const f = fixture();
  await f.documents.initialize();
  const draft = f.documents.createDocument("keep.md", "unsaved");
  f.port.saveWorkspace = async () => { throw new Error("quota"); };
  await f.workspace.choose();
  assert.equal(f.workspace.error, "storage");
  assert.equal(f.workspace.current, null);
  assert.equal(f.documents.activeId, draft.id);
  await f.documents.flushPendingSave();
});

test("closing and refreshing the folder preserve pending drafts and never delete disk files", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  await f.workspace.openFile("Nested/Name.MD");
  f.documents.updateActiveContent("pending");
  const id = f.documents.activeId;
  await f.workspace.refresh();
  assert.equal(f.documents.activeId, id);
  assert.equal(f.documents.activeDocument?.content, "pending");
  f.workspace.close();
  await f.documents.flushPendingSave();
  assert.equal(f.workspace.current, null);
  assert.equal(f.documents.activeDocument, undefined);
  assert.equal(f.storage.drafts.size, 1);
  assert.equal(f.content(), "# Original");
  await f.workspace.reopen();
  await f.workspace.openFile("Nested/Name.MD");
  assert.equal(f.documents.activeDocument?.content, "pending");
});

test("identical names in distinct workspace folders keep separate recovery identities", async () => {
  const a = fixture();
  const b = fixture();
  await a.documents.initialize();
  await a.workspace.choose();
  await a.workspace.openFile("Nested/Name.MD");
  a.documents.updateActiveContent("workspace a");
  const idA = a.documents.activeId;
  const other = new WorkspaceStore(a.documents, a.port, () => Promise.resolve(b.root));
  await other.choose();
  await other.openFile("Nested/Name.MD");
  assert.notEqual(a.documents.activeId, idA);
  a.documents.updateActiveContent("workspace b");
  await a.documents.flushPendingSave();
  assert.equal(a.storage.drafts.size, 2);
  assert.deepEqual([...a.storage.drafts.values()].map(d => d.document.content).sort(), ["workspace a", "workspace b"]);
  await a.workspace.choose();
  await a.workspace.openFile("Nested/Name.MD");
  assert.equal(a.documents.activeDocument?.content, "workspace a");
});

test("folder enumeration errors retain the previous tree and report a read failure", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  const entries = f.workspace.entries;
  f.root.values = async function* () { throw new Error("removed"); };
  await f.workspace.refresh();
  assert.equal(f.workspace.error, "read");
  assert.equal(f.workspace.entries, entries);
});
