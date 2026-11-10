/**
 * ES: Primer guardado en la carpeta de trabajo: borrador, nombre, ubicación, colisiones y fallos.
 * EN: First save into the workspace: draft, name, location, collisions, and failures.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getDraftKey } from "../src/core/storage/documentRecords.ts";
import { DocumentStore } from "../src/features/vault/vaultStore.svelte.ts";
import { deferred } from "./helpers.ts";
import { workspaceFixture } from "./workspaceFixtures.ts";

type FixtureFile = { content: string };

async function ready() {
  const fixture = workspaceFixture();
  await fixture.documents.initialize();
  await fixture.workspace.choose();
  return fixture;
}

test("a new document stays a draft until the first save confirms name and location", async () => {
  const f = await ready();
  const doc = f.documents.createDocument("draft.md", "# First", null, true);
  await f.documents.flushPendingSave();
  assert.equal(f.notesDir.entries.has("notes.md"), false);
  assert.equal(f.storage.drafts.size, 1);

  const saving = f.documents.fileSave.save(doc.id);
  assert.equal(f.documents.fileSave.firstSave?.suggestedName, "draft.md");
  const target = await f.workspace.prepareDocumentSave("notes", "notes.md");
  assert.ok(target);
  assert.equal(f.notesDir.entries.has("notes.md"), true);
  f.documents.fileSave.resolveFirstSave(target);
  await saving;

  const newId = getDraftKey({ kind: "file", workspaceId: f.workspace.current!.id, path: "notes/notes.md" });
  assert.equal(f.documents.fileSave.state, "fileSaved");
  assert.equal(f.documents.activeId, newId);
  assert.equal(f.documents.activeDocument?.title, "notes.md");
  assert.equal(f.documents.isWorkspaceDocument(newId), true);
  assert.equal((f.notesDir.entries.get("notes.md") as FixtureFile).content, "# First");
  assert.equal(f.storage.drafts.size, 0);
  assert.equal(f.storage.docs.size, 0);
});

test("canceling the first save keeps the draft and reports no success", async () => {
  const f = await ready();
  const doc = f.documents.createDocument("draft.md", "keep me");
  const saving = f.documents.fileSave.save(doc.id);
  f.documents.fileSave.resolveFirstSave(null);
  await saving;

  assert.equal(f.documents.fileSave.state, "idle");
  assert.equal(f.documents.activeDocument?.content, "keep me");
  assert.equal(f.documents.activeId, doc.id);
  assert.equal(f.storage.drafts.size, 1);
  assert.equal(f.root.entries.has("draft.md"), false);
});

test("denied write permission keeps the draft and creates no file", async () => {
  const f = await ready();
  const doc = f.documents.createDocument("draft.md", "keep me");
  f.deny();
  const saving = f.documents.fileSave.save(doc.id);
  assert.equal(await f.workspace.prepareDocumentSave("", "denied.md"), null);
  assert.equal(f.workspace.error, "permission");
  f.documents.fileSave.resolveFirstSave(null);
  await saving;

  assert.equal(f.documents.fileSave.state, "idle");
  assert.equal(f.documents.activeDocument?.content, "keep me");
  assert.equal(f.storage.drafts.size, 1);
  assert.equal(f.root.entries.has("denied.md"), false);
});

test("a write failure keeps the draft and removes the newly created empty file", async () => {
  const f = await ready();
  const doc = f.documents.createDocument("draft.md", "keep me");
  const saving = f.documents.fileSave.save(doc.id);
  const target = await f.workspace.prepareDocumentSave("", "failed.md");
  assert.ok(target);
  (target.handle as unknown as { createWritable: () => Promise<never> }).createWritable =
    async () => { throw new Error("disk full"); };
  f.documents.fileSave.resolveFirstSave(target);
  await saving;

  assert.equal(f.documents.fileSave.state, "error");
  assert.equal(f.documents.activeDocument?.content, "keep me");
  assert.equal(f.documents.activeId, doc.id);
  assert.equal(f.storage.drafts.size, 1);
  assert.equal(f.root.entries.has("failed.md"), false);
});

test("existing names are rejected without overwriting the file", async () => {
  const f = await ready();
  f.documents.createDocument("draft.md", "new");
  assert.equal(await f.workspace.prepareDocumentSave("notes", "guide.md"), null);
  assert.equal(f.workspace.error, "collision");
  assert.equal((f.initialFile as unknown as FixtureFile).content, "# Original Content");
});

test("invalid names and pending drafts at the destination are rejected before creation", async () => {
  const f = await ready();
  f.documents.createDocument("draft.md", "new");
  assert.equal(await f.workspace.prepareDocumentSave("", "bad/name.md"), null);
  assert.equal(f.workspace.error, "invalidName");

  const identity = { kind: "file" as const, workspaceId: f.workspace.current!.id, path: "ghost.md" };
  f.documents.versions[getDraftKey(identity)] = { identity, confirmedContent: "draft only" };
  assert.equal(await f.workspace.prepareDocumentSave("", "ghost.md"), null);
  assert.equal(f.workspace.error, "collision");
  assert.equal(f.root.entries.has("ghost.md"), false);
});

test("edits made during the first write remain a draft against the written snapshot", async () => {
  const f = await ready();
  const doc = f.documents.createDocument("draft.md", "snapshot");
  const started = deferred();
  const release = deferred();
  const saving = f.documents.fileSave.save(doc.id);
  const target = await f.workspace.prepareDocumentSave("", "slow.md");
  assert.ok(target);
  const original = target.handle.createWritable.bind(target.handle);
  target.handle.createWritable = async options => {
    const writer = await original(options);
    return {
      write: async content => { started.resolve(); await release.promise; await writer.write(content); },
      close: () => writer.close(),
      abort: () => writer.abort(),
    };
  };
  f.documents.fileSave.resolveFirstSave(target);
  await started.promise;
  f.documents.updateActiveContent("later edits");
  release.resolve();
  await saving;

  const newId = getDraftKey({ kind: "file", workspaceId: f.workspace.current!.id, path: "slow.md" });
  assert.equal(f.documents.fileSave.state, "fileSaved");
  assert.equal(f.documents.activeId, newId);
  assert.equal((f.root.entries.get("slow.md") as FixtureFile).content, "snapshot");
  assert.equal(f.documents.activeDocument?.content, "later edits");
  assert.equal(f.documents.hasUnsavedChanges, true);
  const draft = [...f.storage.drafts.values()][0];
  assert.equal(draft.key, newId);
  assert.equal(draft.document.content, "later edits");
  assert.equal(draft.confirmedContent, "snapshot");
});

test("a failed draft migration reports an error and keeps the edited local recovery after reload", async () => {
  const f = await ready();
  const doc = f.documents.createDocument("draft.md", "snapshot", null, true);
  const started = deferred();
  const release = deferred();
  const saving = f.documents.fileSave.save(doc.id);
  const target = await f.workspace.prepareDocumentSave("", "migration.md");
  assert.ok(target);
  const original = target.handle.createWritable.bind(target.handle);
  target.handle.createWritable = async options => {
    const writer = await original(options);
    return {
      write: async content => { started.resolve(); await release.promise; await writer.write(content); },
      close: () => writer.close(),
      abort: () => writer.abort(),
    };
  };
  f.storage.replaceDrafts = async () => { throw new Error("IndexedDB unavailable"); };
  f.documents.fileSave.resolveFirstSave(target);
  await started.promise;
  f.documents.updateActiveContent("edited during write");
  release.resolve();
  await saving;

  assert.equal(f.documents.fileSave.state, "error");
  assert.equal(f.documents.activeId, doc.id);
  assert.equal(f.documents.isWorkspaceDocument(doc.id), false);
  assert.equal((f.root.entries.get("migration.md") as FixtureFile).content, "snapshot");

  // ES: La recarga es inmediata: no se fuerza un flush manual tras el fallo.
  // EN: Reload is immediate: no manual flush is forced after the failure.
  const localKey = getDraftKey({ kind: "local", id: doc.id });
  assert.equal(f.storage.drafts.get(localKey)?.document.content, "edited during write");
  assert.equal(f.storage.drafts.get(localKey)?.confirmedContent, null);
  const fileKey = getDraftKey({ kind: "file", workspaceId: f.workspace.current!.id, path: "migration.md" });
  assert.equal(f.storage.drafts.has(fileKey), false);

  const reopened = new DocumentStore(f.storage);
  await reopened.initialize();
  assert.equal(reopened.activeDocument, undefined);
  assert.equal(reopened.recoveries[doc.id]?.document.content, "edited during write");
  assert.equal(reopened.recoveries[doc.id]?.confirmedContent, null);
});

test("a failed post-migration draft write reports an error instead of success", async () => {
  const f = await ready();
  const doc = f.documents.createDocument("draft.md", "snapshot", null, true);
  const started = deferred();
  const releaseWrite = deferred();
  const migrated = deferred();
  const releaseMigration = deferred();
  const saving = f.documents.fileSave.save(doc.id);
  const target = await f.workspace.prepareDocumentSave("", "post-migration.md");
  assert.ok(target);
  const originalCreate = target.handle.createWritable.bind(target.handle);
  target.handle.createWritable = async options => {
    const writer = await originalCreate(options);
    return {
      write: async content => { started.resolve(); await releaseWrite.promise; await writer.write(content); },
      close: () => writer.close(),
      abort: () => writer.abort(),
    };
  };
  const originalReplace = f.storage.replaceDrafts.bind(f.storage);
  f.storage.replaceDrafts = async (keys, records) => {
    await originalReplace(keys, records);
    migrated.resolve();
    await releaseMigration.promise;
  };
  f.documents.fileSave.resolveFirstSave(target);
  await started.promise;
  f.documents.updateActiveContent("durable edit");
  releaseWrite.resolve();
  await migrated.promise;
  f.documents.updateActiveContent("latest edit");
  f.storage.saveDraft = async () => { throw new Error("IndexedDB unavailable"); };
  releaseMigration.resolve();
  await saving;

  const newId = getDraftKey({ kind: "file", workspaceId: f.workspace.current!.id, path: "post-migration.md" });
  assert.equal(f.documents.fileSave.state, "error");
  assert.equal(f.documents.persistenceState, "error");
  assert.equal(f.documents.activeId, newId);
  assert.equal((f.root.entries.get("post-migration.md") as FixtureFile).content, "snapshot");
  // ES: Solo la edición anterior a la confirmación fallida quedó durable.
  // EN: Only the edit before the failed confirmation became durable.
  assert.equal(f.storage.drafts.get(newId)?.document.content, "durable edit");

  const reopened = new DocumentStore(f.storage);
  await reopened.initialize();
  assert.equal(reopened.recoveries[newId]?.document.content, "durable edit");
});

test("later saves reuse the confirmed destination, keep the file name, and detect conflicts", async () => {
  const f = await ready();
  const doc = f.documents.createDocument("draft.md", "# First");
  const saving = f.documents.fileSave.save(doc.id);
  const target = await f.workspace.prepareDocumentSave("notes", "notes.md");
  assert.ok(target);
  f.documents.fileSave.resolveFirstSave(target);
  await saving;
  const file = f.notesDir.entries.get("notes.md") as FixtureFile;

  f.documents.updateActiveContent("# Different heading");
  await f.documents.flushPendingSave();
  assert.equal(f.documents.activeDocument?.title, "notes.md");
  await f.documents.fileSave.save(f.documents.activeId);
  assert.equal(file.content, "# Different heading");
  assert.equal(f.documents.fileSave.state, "fileSaved");

  file.content = "external";
  f.documents.updateActiveContent("my edits");
  await f.documents.fileSave.save(f.documents.activeId);
  assert.equal(f.documents.fileSave.state, "conflict");
  assert.equal(file.content, "external");
  assert.equal(f.documents.activeDocument?.content, "my edits");
  assert.equal(f.storage.drafts.size, 1);
});
