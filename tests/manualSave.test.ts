/**
 * ES: Guardado manual, cancelación, conflictos y protección de ediciones concurrentes.
 * EN: Manual saving, cancellation, conflicts, and protection of concurrent edits.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { DocumentStore } from "../src/features/vault/vaultStore.svelte.ts";
import { memoryStorage, deferred } from "./helpers.ts";

function diskFile(name = "saved.md", initial = "") {
  const file = {
    token: crypto.randomUUID(),
    name, content: initial, permission: "granted", writes: 0, aborted: false,
    failWrite: false, failClose: false, onCreate: () => {},
    onWrite: async () => {},
    async getFile() { return { text: async () => file.content }; },
    async requestPermission() { return file.permission; },
    async isSameEntry(other: unknown) { return !!other && (other as { token: string }).token === file.token; },
    async createWritable() {
      file.onCreate();
      let staged = "";
      return {
        async write(content: string) {
          file.writes++;
          await file.onWrite();
          if (file.failWrite) throw new Error("write failed");
          staged = content;
        },
        async close() {
          if (file.failClose) throw new Error("close failed");
          file.content = staged;
        },
        async abort() { file.aborted = true; },
      };
    },
  };
  return file;
}

function setup(file = diskFile()) {
  const storage = memoryStorage();
  const downloads: Array<{ name: string; content: string }> = [];
  const env = {
    pickFile: (_title: string): Promise<ReturnType<typeof diskFile>> | null => Promise.resolve(file),
    download: (name: string, content: string) => { downloads.push({ name, content }); },
  };
  return { file, storage, env, downloads, store: new DocumentStore(storage, env) };
}

test("only manual Save writes the chosen file and resolves its matching draft", async () => {
  const { store, storage, file } = setup();
  await store.initialize();
  const doc = store.createDocument("draft.md", "# First");
  await store.flushPendingSave();
  assert.equal(file.content, "");
  assert.equal(storage.drafts.size, 1);
  await store.fileSave.save(doc.id);
  assert.equal(file.content, "# First");
  assert.equal(store.fileSave.state, "fileSaved");
  assert.equal(store.hasUnsavedChanges, false);
  assert.equal(storage.drafts.size, 0);
  assert.equal(store.activeDocument?.title, "saved.md");
  store.updateActiveContent("# Different heading");
  await store.flushPendingSave();
  assert.equal(store.activeDocument?.title, "saved.md");
  assert.equal(file.content, "# First");
  await store.fileSave.save(doc.id);
  assert.equal(file.content, "# Different heading");
  assert.equal(store.hasUnsavedChanges, false);
});

test("canceling the picker keeps content, pending state, and recovery draft", async () => {
  const { store, storage, env, file } = setup();
  env.pickFile = () => Promise.reject(new DOMException("cancelled", "AbortError"));
  await store.initialize();
  const doc = store.createDocument("draft.md", "keep");
  await store.fileSave.save(doc.id);
  assert.equal(store.fileSave.state, "idle");
  assert.equal(file.content, "");
  assert.equal(store.activeDocument?.content, "keep");
  assert.equal(store.hasUnsavedChanges, true);
  assert.equal(storage.drafts.size, 1);
});

test("permission rejection and stream write or close errors never clear drafts", async () => {
  for (const failure of ["permission", "write", "close"]) {
    const { store, storage, file } = setup();
    if (failure === "permission") file.permission = "denied";
    if (failure === "write") file.failWrite = true;
    if (failure === "close") file.failClose = true;
    await store.initialize();
    const doc = store.createDocument("draft.md", "keep");
    await store.fileSave.save(doc.id);
    assert.equal(store.fileSave.state, "error", failure);
    assert.equal(store.hasUnsavedChanges, true, failure);
    assert.equal(storage.drafts.size, 1, failure);
    assert.equal(file.content, "", failure);
  }
});

test("download fallback keeps the original unconfirmed and the recovery draft", async () => {
  const { store, storage, env, downloads, file } = setup();
  env.pickFile = () => null;
  await store.initialize();
  const doc = store.createDocument("draft.md", "download me");
  await store.fileSave.save(doc.id);
  assert.deepEqual(downloads, [{ name: "draft.md", content: "download me" }]);
  assert.equal(store.fileSave.state, "downloaded");
  assert.equal(store.hasUnsavedChanges, true);
  assert.equal(storage.drafts.size, 1);
  assert.equal(file.content, "");
});

test("external changes produce a conflict without overwriting or discarding work", async () => {
  const { store, storage, file } = setup();
  await store.initialize();
  const doc = store.createDocument("draft.md", "base");
  await store.fileSave.save(doc.id);
  file.content = "external";
  store.updateActiveContent("my edits");
  await store.fileSave.save(doc.id);
  assert.equal(file.content, "external");
  assert.equal(store.fileSave.state, "conflict");
  assert.equal(store.fileSave.conflict?.documentId, doc.id);
  assert.equal(storage.drafts.size, 1);
  store.fileSave.resolveConflict(store.fileSave.conflict!, false);
  assert.equal(store.activeDocument?.content, "my edits");
  assert.equal(storage.drafts.size, 1);
});

test("saving a conflict copy preserves the original file and its pending draft", async () => {
  const { store, storage, file, env } = setup();
  await store.initialize();
  const doc = store.createDocument("draft.md", "base");
  await store.fileSave.save(doc.id);
  file.content = "external";
  store.updateActiveContent("copy me");
  await store.fileSave.save(doc.id);
  const copy = diskFile("copy.md");
  env.pickFile = () => Promise.resolve(copy);
  await store.fileSave.resolveConflict(store.fileSave.conflict!, true);
  assert.equal(copy.content, "copy me");
  assert.equal(file.content, "external");
  assert.equal(store.fileSave.state, "copySaved");
  assert.equal(store.hasUnsavedChanges, true);
  assert.equal(storage.drafts.size, 1);
});

test("Save copy rejects selecting the same original file", async () => {
  const { store, file } = setup();
  await store.initialize();
  const doc = store.createDocument("draft.md", "base");
  await store.fileSave.save(doc.id);
  file.content = "external";
  store.updateActiveContent("my changes");
  await store.fileSave.save(doc.id);
  await store.fileSave.resolveConflict(store.fileSave.conflict!, true);
  assert.equal(file.content, "external");
  assert.equal(store.fileSave.state, "conflict");
});

test("edits during writing remain pending against the version actually written", async () => {
  const { store, storage, file } = setup();
  await store.initialize();
  const doc = store.createDocument("draft.md", "snapshot");
  const started = deferred();
  const release = deferred();
  file.onWrite = async () => { started.resolve(); await release.promise; };
  const saving = store.fileSave.save(doc.id);
  await started.promise;
  store.updateActiveContent("later edits");
  release.resolve();
  await saving;
  assert.equal(file.content, "snapshot");
  assert.equal(store.activeDocument?.content, "later edits");
  assert.equal(store.hasUnsavedChanges, true);
  const draft = [...storage.drafts.values()][0];
  assert.equal(draft.document.content, "later edits");
  assert.equal(draft.confirmedContent, "snapshot");
});

test("an external change while opening the stream aborts before writing", async () => {
  const { store, file } = setup();
  await store.initialize();
  const doc = store.createDocument("draft.md", "base");
  await store.fileSave.save(doc.id);
  const writes = file.writes;
  file.onCreate = () => { file.content = "changed during createWritable"; };
  store.updateActiveContent("pending");
  await store.fileSave.save(doc.id);
  assert.equal(store.fileSave.state, "conflict");
  assert.equal(file.content, "changed during createWritable");
  assert.equal(file.writes, writes);
  assert.equal(file.aborted, true);
});

test("repeated Save during one write does not launch another operation", async () => {
  const { store, file } = setup();
  await store.initialize();
  const doc = store.createDocument("draft.md", "snapshot");
  const started = deferred();
  const release = deferred();
  file.onWrite = async () => { started.resolve(); await release.promise; };
  const saving = store.fileSave.save(doc.id);
  await started.promise;
  await store.fileSave.save(doc.id);
  release.resolve();
  await saving;
  assert.equal(file.writes, 1);
});

test("a draft flush during confirmed cleanup cannot resurrect a resolved draft", async () => {
  const { store, storage } = setup();
  await store.initialize();
  const doc = store.createDocument("draft.md", "saved content");
  const started = deferred();
  const release = deferred();
  const originalDelete = storage.deleteDraft;
  storage.deleteDraft = async key => { started.resolve(); await release.promise; await originalDelete(key); };
  const saving = store.fileSave.save(doc.id);
  await started.promise;
  const flushing = store.flushPendingSave();
  release.resolve();
  await saving;
  await flushing;
  assert.equal(storage.drafts.size, 0);
});

test("typing during cleanup preserves the newer text and rebased confirmed version", async () => {
  const { store, storage } = setup();
  await store.initialize();
  const doc = store.createDocument("draft.md", "saved content");
  const started = deferred();
  const release = deferred();
  const originalDelete = storage.deleteDraft;
  storage.deleteDraft = async key => { started.resolve(); await release.promise; await originalDelete(key); };
  const saving = store.fileSave.save(doc.id);
  await started.promise;
  store.updateActiveContent("typed during cleanup");
  const flushing = store.flushPendingSave();
  release.resolve();
  await saving;
  await flushing;
  const draft = [...storage.drafts.values()][0];
  assert.equal(draft.document.content, "typed during cleanup");
  assert.equal(draft.confirmedContent, "saved content");
  assert.equal(store.hasUnsavedChanges, true);
});

test("cleanup failure reports storage error while retaining the recovery draft", async () => {
  const { store, storage, file } = setup();
  await store.initialize();
  const doc = store.createDocument("draft.md", "saved content");
  storage.deleteDraft = async () => { throw new Error("cleanup failed"); };
  await store.fileSave.save(doc.id);
  assert.equal(file.content, "saved content");
  assert.equal(store.fileSave.state, "fileSaved");
  assert.equal(store.persistenceState, "error");
  assert.equal(storage.drafts.size, 1);
  await store.flushPendingSave();
  assert.equal([...storage.drafts.values()][0].confirmedContent, "saved content");
});

test("conflict actions become available only after saving the recovery draft", async () => {
  const { store, file, storage } = setup();
  await store.initialize();
  const doc = store.createDocument("draft.md", "base");
  await store.fileSave.save(doc.id);
  file.content = "external";
  store.updateActiveContent("pending");
  const started = deferred();
  const release = deferred();
  const saveDraft = storage.saveDraft;
  storage.saveDraft = async draft => { started.resolve(); await release.promise; await saveDraft(draft); };
  const saving = store.fileSave.save(doc.id);
  await started.promise;
  await new Promise(resolve => setImmediate(resolve));
  const earlyConflict = store.fileSave.conflict;
  release.resolve();
  await saving;
  assert.equal(earlyConflict, null);
  assert.equal(store.fileSave.busy, false);
  assert.equal(store.fileSave.conflict?.documentId, doc.id);
});

test("reopening retains the file reference and detects external changes before overwriting", async () => {
  const { store, storage, env, file } = setup();
  await store.initialize();
  const doc = store.createDocument("draft.md", "base");
  await store.fileSave.save(doc.id);
  store.updateActiveContent("recovery edits");
  await store.flushPendingSave();
  file.content = "changed while closed";
  env.pickFile = () => { throw new Error("Should use the recovered reference"); };
  const reopened = new DocumentStore(storage, env);
  await reopened.initialize();
  reopened.selectDocument(doc.id);
  reopened.resolveRecovery(reopened.recoveryCandidate!, true);
  await reopened.fileSave.save(doc.id);
  assert.equal(reopened.fileSave.state, "conflict");
  assert.equal(file.content, "changed while closed");
  assert.equal(reopened.activeDocument?.content, "recovery edits");
  assert.equal(storage.drafts.size, 1);
});

test("an unchanged editor notification cannot recreate a draft after successful Save", async () => {
  const { store, storage } = setup();
  await store.initialize();
  const doc = store.createDocument("draft.md", "unchanged");
  await store.fileSave.save(doc.id);
  store.updateActiveContent("unchanged");
  await store.flushPendingSave();
  assert.equal(storage.drafts.size, 0);
  assert.equal(store.fileSave.state, "fileSaved");
});
