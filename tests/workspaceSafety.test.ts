/** ES: Regresiones de conservación, reinicio y capacidades de cambios estructurales.
 * EN: Preservation, restart, and capability regressions for structural changes. */
import test from "node:test";
import assert from "node:assert/strict";
import { workspaceFixture as fixture } from "./workspaceFixtures.ts";
import { DocumentStore } from "../src/features/vault/vaultStore.svelte.ts";
import { WorkspaceStore } from "../src/features/vault/workspaceStore.svelte.ts";
import { deferred } from "./helpers.ts";
import type { DirectoryHandle } from "../src/core/storage/workspacePort.ts";

async function opened() {
  const f = fixture();
  await f.documents.initialize(); await f.workspace.choose();
  await f.workspace.openFile("notes/guide.md");
  f.documents.updateActiveContent("recoverable edits");
  await f.documents.flushPendingSave();
  return f;
}

test("moving to the same path preserves version, recovery and dirty calculation", async () => {
  const f = await opened();
  const id = f.documents.activeId;
  assert.equal(await f.workspace.moveEntry("notes/guide.md", "notes"), true);
  assert.equal(f.documents.activeId, id);
  assert.equal(f.documents.hasUnsavedChanges, true);
  assert.equal(f.storage.drafts.size, 1);
});

test("rename selects the exact source when case variants coexist", async () => {
  const f = await opened();
  const other = await f.notesDir.getFileHandle("GUIDE.md", { create: true });
  const writer = await other.createWritable(); await writer.write("different file"); await writer.close();
  assert.equal(await f.workspace.renameEntry("notes/guide.md", "new.md"), true);
  assert.equal(await (await (await f.notesDir.getFileHandle("new.md")).getFile()).text(), "# Original Content");
  assert.equal(await (await other.getFile()).text(), "different file");
});

test("missing native move never copies or deletes binary resources", async () => {
  const f = await opened(); delete f.initialFile.move;
  const bytes = new Uint8Array([0, 255, 128, 137, 80, 78, 71]);
  f.initialFile.getFile = async () => new File([bytes], "guide.md");
  f.initialFile.createWritable = async () => { throw new Error("Must never copy"); };
  assert.equal(await f.workspace.renameEntry("notes/guide.md", "new.png"), false);
  assert.equal(f.workspace.error, "unsupported");
  assert.equal(f.notesDir.entries.has("new.png"), false);
  assert.deepEqual(new Uint8Array(await (await f.initialFile.getFile() as File).arrayBuffer()), bytes);
});

test("missing move and remove capabilities cannot report a successful copy as movement", async () => {
  const f = await opened(); delete f.initialFile.move; delete f.notesDir.removeEntry;
  assert.equal(await f.workspace.moveEntry("notes/guide.md", "", "new.md"), false);
  assert.equal(f.workspace.error, "unsupported");
  assert.equal(f.root.entries.has("new.md"), false);
  assert.equal(f.notesDir.entries.has("guide.md"), true);
});

test("failed draft migration preserves the old durable draft and replays after reopening", async () => {
  const f = await opened();
  const replace = f.storage.replaceDrafts;
  f.storage.replaceDrafts = async () => { throw new Error("quota"); };
  assert.equal(await f.workspace.renameEntry("notes/guide.md", "new.md"), false);
  assert.equal(f.workspace.error, "storage");
  assert.equal([...f.storage.drafts.values()][0]?.document.content, "recoverable edits");
  assert.ok(f.records[0]?.pendingChange);
  assert.equal(await f.workspace.createFolder("", "Blocked during reconciliation"), false);
  assert.equal(f.workspace.error, "pendingChange");
  f.storage.replaceDrafts = replace;
  const documents = new DocumentStore(f.storage); await documents.initialize();
  const workspace = new WorkspaceStore(documents, f.port, () => Promise.resolve(f.root));
  await workspace.initialize(); await workspace.reopen();
  assert.equal(workspace.error, null);
  const draft = [...f.storage.drafts.values()][0]!;
  assert.equal(draft.identity.kind === "file" && draft.identity.path, "notes/new.md");
  assert.equal(draft.document.content, "recoverable edits");
  assert.equal(f.records[0]?.pendingChange, undefined);
});

test("failure to persist the intent prevents any disk change", async () => {
  const f = await opened();
  f.port.saveWorkspace = async () => { throw new Error("quota"); };
  assert.equal(await f.workspace.renameEntry("notes/guide.md", "new.md"), false);
  assert.equal(f.workspace.error, "storage");
  assert.equal(f.notesDir.entries.has("guide.md"), true);
  assert.equal(f.notesDir.entries.has("new.md"), false);
});

test("an unrecovered draft persists the replacement handle and saves after reload", async () => {
  const f = await opened();
  const documents = new DocumentStore(f.storage); await documents.initialize();
  await f.initialFile.move!("new.md");
  const replacement = { ...f.initialFile, name: "new.md" };
  f.notesDir.entries.set("new.md", replacement);
  assert.equal(await documents.renameWorkspacePath(f.records[0]!.id, "notes/guide.md", "notes/new.md", replacement), true);
  assert.equal([...f.storage.drafts.values()][0]!.fileHandle, replacement);
  const reloaded = new DocumentStore(f.storage); await reloaded.initialize();
  reloaded.selectDocument([...f.storage.drafts.values()][0]!.document.id);
  reloaded.resolveRecovery(reloaded.recoveryCandidate!, true);
  await reloaded.fileSave.save(reloaded.activeId);
  assert.equal(reloaded.fileSave.state, "fileSaved");
});

test("edits during migration are retained under the new identity only", async () => {
  const f = await opened();
  const start = deferred(), release = deferred();
  const replace = f.storage.replaceDrafts;
  f.storage.replaceDrafts = async (keys, drafts) => { start.resolve(); await release.promise; await replace(keys, drafts); };
  const moving = f.workspace.renameEntry("notes/guide.md", "new.md");
  await start.promise;
  f.documents.updateActiveContent("later edits");
  release.resolve(); await moving; await f.documents.flushPendingSave();
  assert.equal(f.storage.drafts.size, 1);
  assert.equal([...f.storage.drafts.values()][0]!.document.content, "later edits");
  assert.equal(f.documents.activeDocument?.content, "later edits");
});

test("failed draft protection stops the operation before intent or disk mutation", async () => {
  const f = await opened();
  f.storage.saveDraft = async () => { throw new Error("quota"); };
  f.documents.updateActiveContent("latest protected in memory");
  assert.equal(await f.workspace.renameEntry("notes/guide.md", "new.md"), false);
  assert.equal(f.workspace.error, "storage");
  assert.equal(f.records[0]?.pendingChange, undefined);
  assert.equal(f.notesDir.entries.has("guide.md"), true);
  assert.equal(f.documents.activeDocument?.content, "latest protected in memory");
  f.storage.saveDraft = async draft => { f.storage.drafts.set(draft.key, draft); };
  await f.documents.flushPendingSave();
});

test("manual save and structural mutation cannot write concurrently", async () => {
  const f = await opened();
  f.documents.fileSave.busy = true;
  assert.equal(await f.workspace.renameEntry("notes/guide.md", "new.md"), false);
  assert.equal(f.workspace.error, "saving");
  f.documents.fileSave.busy = false;
  const release = deferred();
  f.root.requestPermission = async () => { await release.promise; return "granted"; };
  const changing = f.workspace.renameEntry("notes/guide.md", "new.md");
  assert.equal(f.documents.workspaceMutation, true);
  await f.documents.fileSave.save(f.documents.activeId);
  assert.equal(f.initialFile.content, "# Original Content");
  release.resolve(); await changing;
  assert.equal(f.documents.workspaceMutation, false);
});

test("a recorded intent interrupted before moving cancels without changing either identity", async () => {
  const f = await opened();
  await f.port.saveWorkspace({ ...f.records[0]!, pendingChange: { path: "notes/guide.md", newPath: "notes/new.md" } });
  const documents = new DocumentStore(f.storage); await documents.initialize();
  const workspace = new WorkspaceStore(documents, f.port, () => Promise.resolve(f.root));
  await workspace.initialize(); await workspace.reopen();
  assert.equal(f.records[0]?.pendingChange, undefined);
  assert.equal(f.notesDir.entries.has("guide.md"), true);
  assert.equal([...f.storage.drafts.values()][0]!.identity.path, "notes/guide.md");
});

test("intent cleanup can be retried after disk and draft migration already completed", async () => {
  const f = await opened();
  const save = f.port.saveWorkspace;
  f.port.saveWorkspace = async record => {
    if (!record.pendingChange) throw new Error("reference quota");
    await save(record);
  };
  assert.equal(await f.workspace.renameEntry("notes/guide.md", "new.md"), false);
  assert.equal(f.workspace.error, "storage");
  f.port.saveWorkspace = save;
  await f.documents.flushPendingSave();
  await f.workspace.reopen();
  assert.equal(f.workspace.error, null);
  assert.equal(f.records[0]?.pendingChange, undefined);
  assert.equal(f.storage.drafts.size, 1);
  assert.equal([...f.storage.drafts.values()][0]!.identity.path, "notes/new.md");
});

test("native failures preserve source, pending content and original recovery identity", async () => {
  const f = await opened();
  f.initialFile.move = async () => { throw new Error("disk refused"); };
  assert.equal(await f.workspace.renameEntry("notes/guide.md", "new.md"), false);
  assert.equal(f.workspace.error, "write");
  assert.equal(f.notesDir.entries.has("guide.md"), true);
  assert.equal([...f.storage.drafts.values()][0]!.document.content, "recoverable edits");
  assert.equal(f.records[0]?.pendingChange, undefined);
});

test("a native move preserves external source edits without copying an obsolete snapshot", async () => {
  const f = await opened();
  const move = f.initialFile.move!;
  f.initialFile.move = async (destination: string | DirectoryHandle, name?: string) => {
    f.initialFile.content = "latest external update";
    if (typeof destination === "string") await move(destination);
    else await move(destination, name);
  };
  assert.equal(await f.workspace.renameEntry("notes/guide.md", "new.md"), true);
  assert.equal(f.initialFile.content, "latest external update");
  await f.documents.fileSave.save(f.documents.activeId);
  assert.equal(f.documents.fileSave.state, "conflict");
});

test("draft removal failure after explicit deletion resumes without discarding other documents", async () => {
  const f = await opened();
  const other = f.documents.createDocument("keep.md", "keep this");
  await f.documents.flushPendingSave();
  const replace = f.storage.replaceDrafts;
  f.storage.replaceDrafts = async () => { throw new Error("quota"); };
  assert.equal(await f.workspace.deleteEntry("notes/guide.md"), false);
  assert.equal(f.storage.drafts.size, 2);
  assert.ok(f.records[0]?.pendingChange);
  f.storage.replaceDrafts = replace;
  await f.workspace.reopen();
  assert.equal(f.workspace.error, null);
  assert.equal(f.storage.drafts.size, 1);
  assert.equal([...f.storage.drafts.values()][0]!.document.id, other.id);
});
