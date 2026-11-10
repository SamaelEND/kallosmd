/**
 * ES: Identidad aislada, borradores separados y recuperación explícita sin perder versiones.
 * EN: Isolated identity, separate drafts, and explicit recovery without losing versions.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { DocumentStore } from "../src/features/vault/vaultStore.svelte.ts";
import { getDraftKey } from "../src/core/storage/documentRecords.ts";
import { memoryStorage, deferred } from "./helpers.ts";

function seedDocument(storage: ReturnType<typeof memoryStorage>) {
  storage.docs.set("legacy", { id: "legacy", title: "original.md", content: "confirmed", updatedAt: 1, hasCustomTitle: true });
}

test("autosave keeps the previous document version and stores edits separately", async () => {
  const storage = memoryStorage();
  seedDocument(storage);
  const store = new DocumentStore(storage);
  await store.initialize();
  store.selectDocument("legacy");
  store.updateActiveContent("edited");
  await store.flushPendingSave();
  assert.equal(storage.docs.get("legacy")?.content, "confirmed");
  const draft = [...storage.drafts.values()][0];
  assert.equal(draft.document.content, "edited");
  assert.equal(draft.confirmedContent, "confirmed");
  assert.equal(store.hasUnsavedChanges, true);
});

test("new documents only create recovery drafts, without populating the old collection", async () => {
  const storage = memoryStorage();
  const store = new DocumentStore(storage);
  await store.initialize();
  const doc = store.createDocument("new.md", "new content");
  await store.flushPendingSave();
  assert.equal(storage.docs.size, 0);
  assert.equal(storage.drafts.size, 1);
  assert.equal([...storage.drafts.values()][0].document.id, doc.id);
  assert.equal([...storage.drafts.values()][0].confirmedContent, null);
});

test("reopening offers recovery without opening or discarding it automatically", async () => {
  const storage = memoryStorage();
  seedDocument(storage);
  const first = new DocumentStore(storage);
  await first.initialize();
  first.selectDocument("legacy");
  first.updateActiveContent("recover me");
  await first.flushPendingSave();
  const reopened = new DocumentStore(storage);
  await reopened.initialize();
  assert.equal(reopened.activeDocument, undefined);
  reopened.selectDocument("legacy");
  assert.equal(reopened.activeDocument, undefined);
  assert.equal(reopened.recoveryCandidate?.document.content, "recover me");
  reopened.resolveRecovery(reopened.recoveryCandidate!, false);
  assert.equal(reopened.activeDocument, undefined);
  assert.equal(storage.drafts.size, 1);
  reopened.selectDocument("legacy");
  reopened.resolveRecovery(reopened.recoveryCandidate!, true);
  assert.equal(reopened.activeDocument?.content, "recover me");
  assert.equal(reopened.hasUnsavedChanges, true);
  assert.equal(storage.drafts.size, 1);
  assert.equal(storage.docs.get("legacy")?.content, "confirmed");
});

test("a recovered new draft remains discoverable after another restart", async () => {
  const storage = memoryStorage();
  const first = new DocumentStore(storage);
  await first.initialize();
  const doc = first.createDocument("new.md", "important");
  await first.flushPendingSave();
  const reopened = new DocumentStore(storage);
  await reopened.initialize();
  assert.equal(reopened.documents.length, 1);
  reopened.selectDocument(doc.id);
  reopened.resolveRecovery(reopened.recoveryCandidate!, true);
  assert.equal(reopened.activeDocument?.content, "important");
  reopened.updateActiveContent("more important");
  await reopened.flushPendingSave();
  const again = new DocumentStore(storage);
  await again.initialize();
  again.selectDocument(doc.id);
  assert.equal(again.recoveryCandidate?.document.content, "more important");
});

test("file draft keys isolate workspaces, subfolders, and new local documents", () => {
  const a = getDraftKey({ kind: "file", workspaceId: "A", path: "notes/readme.md" });
  const b = getDraftKey({ kind: "file", workspaceId: "B", path: "notes/readme.md" });
  const c = getDraftKey({ kind: "file", workspaceId: "A", path: "other/readme.md" });
  const d = getDraftKey({ kind: "local", id: "notes/readme.md" });
  assert.equal(new Set([a, b, c, d]).size, 4);
  for (const path of ["/absolute.md", "../outside.md", "a/../b.md", "a//b.md", "a\\b.md", "./note.md", ""]) {
    assert.throws(() => getDraftKey({ kind: "file", workspaceId: "A", path }));
  }
});

test("draft write failure preserves both confirmed version and pending edits for retry", async () => {
  const storage = memoryStorage();
  seedDocument(storage);
  const store = new DocumentStore(storage);
  await store.initialize();
  store.selectDocument("legacy");
  store.updateActiveContent("pending");
  const originalSave = storage.saveDraft;
  storage.saveDraft = async () => { throw new Error("quota"); };
  assert.equal(await store.flushPendingSave(), false);
  assert.equal(store.persistenceState, "error");
  assert.equal(storage.docs.get("legacy")?.content, "confirmed");
  assert.equal(store.activeDocument?.content, "pending");
  storage.saveDraft = originalSave;
  await store.flushPendingSave();
  assert.equal([...storage.drafts.values()][0].document.content, "pending");
});

test("an older draft write cannot clear newer changes", async () => {
  const storage = memoryStorage();
  const store = new DocumentStore(storage);
  await store.initialize();
  store.createDocument("draft.md", "old");
  const started = deferred();
  const release = deferred();
  const originalSave = storage.saveDraft;
  storage.saveDraft = async draft => {
    started.resolve();
    await release.promise;
    await originalSave(draft);
  };
  const saving = store.flushPendingSave();
  await started.promise;
  store.updateActiveContent("new");
  release.resolve();
  await saving;
  assert.equal(store.persistenceState, "pending");
  await store.flushPendingSave();
  assert.equal([...storage.drafts.values()][0].document.content, "new");
});

test("renaming or moving an unrecovered draft preserves its full edited content", async () => {
  const storage = memoryStorage();
  seedDocument(storage);
  const first = new DocumentStore(storage);
  await first.initialize();
  first.selectDocument("legacy");
  first.updateActiveContent("unrecovered writing");
  await first.flushPendingSave();
  const reopened = new DocumentStore(storage);
  await reopened.initialize();
  reopened.updateDocumentTitle("legacy", "renamed.md");
  reopened.moveDocumentToFolder("legacy", "folder");
  await reopened.flushPendingSave();
  const draft = [...storage.drafts.values()][0];
  assert.equal(draft.document.content, "unrecovered writing");
  assert.equal(draft.document.title, "renamed.md");
  assert.equal(draft.document.folderId, "folder");
  reopened.selectDocument("legacy");
  reopened.resolveRecovery(reopened.recoveryCandidate!, true);
  assert.equal(reopened.activeDocument?.content, "unrecovered writing");
  assert.equal(reopened.activeDocument?.title, "renamed.md");
});

test("deleting the active note cannot open another draft without asking", async () => {
  const storage = memoryStorage();
  const first = new DocumentStore(storage);
  await first.initialize();
  const draft = first.createDocument("recover.md", "pending text");
  await first.flushPendingSave();
  const reopened = new DocumentStore(storage);
  await reopened.initialize();
  const active = reopened.createDocument("active.md", "temporary");
  reopened.deleteDocument(active.id);
  assert.equal(reopened.activeDocument, undefined);
  assert.equal(reopened.recoveryCandidate?.document.id, draft.id);
  await reopened.flushPendingSave();
});

test("file recovery isolates workspaces and keeps filenames independent of headings", async () => {
  const storage = memoryStorage();
  for (const workspaceId of ["one", "two"]) {
    const identity = { kind: "file" as const, workspaceId, path: "notes/readme.md" };
    const key = getDraftKey(identity);
    storage.drafts.set(key, {
      key, identity, confirmedContent: `base ${workspaceId}`,
      document: { id: key, title: "readme.md", content: `# Heading ${workspaceId}`, updatedAt: 1, hasCustomTitle: false },
    });
  }
  const store = new DocumentStore(storage);
  await store.initialize();
  assert.equal(store.documents.length, 2);
  for (const workspaceId of ["one", "two"]) {
    const key = getDraftKey({ kind: "file", workspaceId, path: "notes/readme.md" });
    store.selectDocument(key);
    store.resolveRecovery(store.recoveryCandidate!, true);
    assert.equal(store.activeDocument?.title, "readme.md");
    assert.equal(store.activeDocument?.content, `# Heading ${workspaceId}`);
    store.updateActiveContent(`changed ${workspaceId}`);
    await store.flushPendingSave();
    assert.equal(storage.drafts.get(key)?.document.content, `changed ${workspaceId}`);
    assert.equal(storage.drafts.get(key)?.confirmedContent, `base ${workspaceId}`);
  }
});

test("imported files use their read version as baseline for pending changes", async () => {
  const store = new DocumentStore(memoryStorage());
  await store.initialize();
  store.importDocument("file.md", "original");
  assert.equal(store.hasUnsavedChanges, false);
  store.updateActiveContent("changed");
  await store.flushPendingSave();
  assert.equal(store.hasUnsavedChanges, true);
  store.updateActiveContent("original");
  assert.equal(store.hasUnsavedChanges, false);
  await store.flushPendingSave();
});

test("recovery keeps existing tags and favorite metadata in serializable snapshots", async () => {
  const storage = memoryStorage();
  storage.docs.set("meta", { id: "meta", title: "metadata.md", content: "original", updatedAt: 1,
    hasCustomTitle: true, tags: ["español", "work"], isFavorite: true });
  const first = new DocumentStore(storage);
  await first.initialize();
  first.selectDocument("meta");
  first.updateActiveContent("edited");
  await first.flushPendingSave();
  const reopened = new DocumentStore(storage);
  await reopened.initialize();
  reopened.selectDocument("meta");
  reopened.resolveRecovery(reopened.recoveryCandidate!, true);
  assert.deepEqual(Array.from(reopened.activeDocument!.tags ?? []), ["español", "work"]);
  assert.equal(reopened.activeDocument?.isFavorite, true);
});
