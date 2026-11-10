/**
 * ES: Regresiones de persistencia, importación y protección de documentos existentes.
 * EN: Regressions for persistence, import, and protection of existing documents.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { DocumentStore } from "../src/features/vault/vaultStore.svelte.ts";
import { i18n } from "../src/shared/i18n/i18n.svelte.ts";
import * as db from "../src/core/storage/db.ts";
import { memoryStorage, deferred } from "./helpers.ts";

test("IndexedDB read and write failures reject instead of reporting empty or success", async () => {
  await assert.rejects(db.getAllDocumentsFromDb());
  await assert.rejects(db.getAllFoldersFromDb());
  await assert.rejects(db.saveDocumentToDb({ id: "x", title: "x.md", content: "keep", updatedAt: 1 }));
  await assert.rejects(db.deleteDocumentFromDb("x"));
});

test("failed initialization never generates or persists a replacement document", async () => {
  const storage = memoryStorage();
  storage.getAllDocuments = async () => { throw new Error("unreadable"); };
  const store = new DocumentStore(storage);
  await store.initialize();
  assert.equal(store.isReady, false);
  assert.equal(store.persistenceState, "error");
  assert.equal(store.documents.length, 0);
  assert.equal(storage.docs.size, 0);
});

test("a clean database starts empty", async () => {
  const store = new DocumentStore(memoryStorage());
  await store.initialize();
  assert.equal(store.isReady, true);
  assert.equal(store.activeDocument, undefined);
  assert.equal(store.documents.length, 0);
});

test("duplicate imports keep originals and preserve imported filenames despite headings", async () => {
  const storage = memoryStorage();
  const store = new DocumentStore(storage);
  await store.initialize();
  const first = store.importDocument("Notes.md", "# Original");
  const second = store.importDocument("notes.md", "# Incoming");
  const third = store.importDocument("NOTES.md", "# Third");
  assert.equal(first.content, "# Original");
  assert.equal(first.title, "Notes.md");
  assert.equal(second.title, "notes (2).md");
  assert.equal(third.title, "NOTES (3).md");
  assert.notEqual(first.id, second.id);
  assert.equal(await store.flushPendingSave(), true);
  assert.equal(storage.drafts.size, 3);
});

test("language changes preserve edited legacy guide content and title", async () => {
  const storage = memoryStorage();
  const doc = { id: "legacy", title: "Simulación Astrodinámica y Plasma MHD (Ejemplo).md", content: "# Trabajo propio\n\nMHD", updatedAt: 1 };
  storage.docs.set(doc.id, { ...doc });
  const store = new DocumentStore(storage);
  await store.initialize();
  i18n.toggleLocale();
  assert.equal(store.documents[0].content, doc.content);
  assert.equal(store.documents[0].title, doc.title);
  assert.deepEqual(storage.docs.get(doc.id), doc);
});

test("failed autosave keeps the latest draft available for retry", async () => {
  const storage = memoryStorage();
  const store = new DocumentStore(storage);
  await store.initialize();
  const doc = store.createDocument("draft.md", "first");
  const originalSave = storage.saveDraft;
  storage.saveDraft = async () => { throw new Error("quota"); };
  assert.equal(await store.flushPendingSave(), false);
  assert.equal(store.persistenceState, "error");
  assert.equal(doc.content, "first");
  store.updateActiveContent("latest");
  storage.saveDraft = originalSave;
  assert.equal(await store.flushPendingSave(), true);
  assert.equal([...storage.drafts.values()].find(d => d.document.id === doc.id)?.document.content, "latest");
  assert.equal(store.persistenceState, "saved");
});

test("edits during a write and switching documents retain both latest drafts", async () => {
  const storage = memoryStorage();
  const store = new DocumentStore(storage);
  await store.initialize();
  const doc = store.createDocument("one.md", "version 1");
  const started = deferred();
  const release = deferred();
  const originalSave = storage.saveDraft;
  storage.saveDraft = async snapshot => {
    started.resolve();
    await release.promise;
    await originalSave(snapshot);
  };
  const saving = store.flushPendingSave();
  await started.promise;
  store.updateActiveContent("version 2");
  const other = store.createDocument("two.md", "other");
  release.resolve();
  await saving;
  assert.equal(await store.flushPendingSave(), true);
  assert.equal([...storage.drafts.values()].find(d => d.document.id === doc.id)?.document.content, "version 2");
  assert.equal([...storage.drafts.values()].find(d => d.document.id === other.id)?.document.content, "other");
});

test("deleting or clearing during a write cannot resurrect documents", async () => {
  const storage = memoryStorage();
  const store = new DocumentStore(storage);
  await store.initialize();
  const doc = store.createDocument("one.md", "version 1");
  const started = deferred();
  const release = deferred();
  const originalSave = storage.saveDraft;
  storage.saveDraft = async snapshot => {
    started.resolve();
    await release.promise;
    await originalSave(snapshot);
  };
  const saving = store.flushPendingSave();
  await started.promise;
  store.deleteDocument(doc.id);
  release.resolve();
  await saving;
  await store.flushPendingSave();
  assert.equal([...storage.drafts.values()].some(d => d.document.id === doc.id), false);
  store.clearAllDocuments();
  await store.flushPendingSave();
  assert.equal(storage.docs.size, 0);
  assert.equal(storage.drafts.size, 0);
  assert.equal(store.activeDocument, undefined);
});

test("creating a draft during database startup preserves it when reading completes", async () => {
  const storage = memoryStorage();
  const release = deferred();
  storage.getAllDocuments = async () => { await release.promise; return []; };
  const store = new DocumentStore(storage);
  const loading = store.initialize();
  const draft = store.createDocument("early.md", "keep my work");
  release.resolve();
  await loading;
  await store.flushPendingSave();
  assert.equal(store.activeDocument?.id, draft.id);
  assert.equal(store.activeDocument?.content, "keep my work");
  assert.equal([...storage.drafts.values()].find(d => d.document.id === draft.id)?.document.content, "keep my work");
});

test("a completed older write does not mark newer edits as saved", async () => {
  const storage = memoryStorage();
  const store = new DocumentStore(storage);
  await store.initialize();
  const draft = store.createDocument("draft.md", "old");
  const started = deferred();
  const release = deferred();
  storage.saveDraft = async snapshot => {
    started.resolve();
    await release.promise;
    storage.drafts.set(snapshot.key, structuredClone(snapshot));
  };
  const saving = store.flushPendingSave();
  await started.promise;
  store.updateActiveContent("new");
  release.resolve();
  await saving;
  assert.equal(store.persistenceState, "pending");
  assert.equal([...storage.drafts.values()].find(d => d.document.id === draft.id)?.document.content, "old");
  await store.flushPendingSave();
  assert.equal([...storage.drafts.values()].find(d => d.document.id === draft.id)?.document.content, "new");
});

test("importing an existing filename keeps every stored document intact", async () => {
  const storage = memoryStorage();
  storage.docs.set("first", { id: "first", title: "Other.md", content: "first", updatedAt: 1, hasCustomTitle: true });
  storage.docs.set("match", { id: "match", title: "Notes.md", content: "original", updatedAt: 1, hasCustomTitle: true });
  const store = new DocumentStore(storage);
  await store.initialize();
  const imported = store.importDocument("Notes.md", "incoming");
  await store.flushPendingSave();
  assert.equal(imported.title, "Notes (2).md");
  assert.equal(storage.docs.get("first")?.content, "first");
  assert.equal(storage.docs.get("match")?.content, "original");
  assert.equal([...storage.drafts.values()].find(d => d.document.id === imported.id)?.document.content, "incoming");
});

test("stored documents remain available without opening one automatically", async () => {
  const storage = memoryStorage();
  storage.docs.set("stored", { id: "stored", title: "Keep.md", content: "saved content", updatedAt: 1, hasCustomTitle: true });
  const store = new DocumentStore(storage);
  await store.initialize();
  assert.equal(store.activeDocument, undefined);
  assert.equal(store.documents.length, 1);
  store.selectDocument("stored");
  assert.equal(store.activeDocument?.content, "saved content");
  await store.flushPendingSave();
});
