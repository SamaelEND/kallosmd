/**
 * ES: Pruebas de renombrado, movimiento y borrado en disco con protección de borradores e identidades.
 * EN: Tests for disk rename, move, and delete with protection of drafts and identities.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { WorkspaceStore } from "../src/features/vault/workspaceStore.svelte.ts";
import { DocumentStore } from "../src/features/vault/vaultStore.svelte.ts";
import type { DirectoryHandle, WorkspaceFileHandle } from "../src/core/storage/workspacePort.ts";

import { workspaceFixture as fixture } from "./workspaceFixtures.ts";

test("renaming a file on disk migrates identity and preserves live edits in drafts", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  await f.workspace.openFile("notes/guide.md");

  f.documents.updateActiveContent("# Live Unsaved Edits");
  await f.documents.flushPendingSave();

  assert.equal(f.storage.drafts.size, 1);
  assert.equal(await f.workspace.renameEntry("notes/guide.md", "handbook.md"), true);

  assert.equal(f.notesDir.entries.has("handbook.md"), true);
  assert.equal(f.documents.activeDocument?.title, "handbook.md");
  assert.equal(f.documents.activeDocument?.content, "# Live Unsaved Edits");

  await f.documents.flushPendingSave();
  assert.equal(f.storage.drafts.size, 1);
  const draft = [...f.storage.drafts.values()][0];
  assert.equal(draft.document.title, "handbook.md");
  assert.equal(draft.document.content, "# Live Unsaved Edits");
  assert.equal(draft.identity.path, "notes/handbook.md");
});

test("renaming a directory on disk migrates all nested drafts to new paths", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  await f.workspace.openFile("notes/guide.md");

  f.documents.updateActiveContent("# Nested Edits");
  await f.documents.flushPendingSave();

  assert.equal(await f.workspace.renameEntry("notes", "docs"), true);
  assert.equal(f.documents.activeDocument?.content, "# Nested Edits");

  await f.documents.flushPendingSave();
  const draft = [...f.storage.drafts.values()][0];
  assert.equal(draft.identity.path, "docs/guide.md");
});

test("moving a file to another directory migrates its draft and handle", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  await f.workspace.createFolder("", "archive");
  await f.workspace.openFile("notes/guide.md");

  f.documents.updateActiveContent("# Moved Content");
  await f.documents.flushPendingSave();

  assert.equal(await f.workspace.moveEntry("notes/guide.md", "archive"), true);
  assert.equal(f.documents.activeDocument?.title, "guide.md");
  assert.equal(f.documents.activeDocument?.content, "# Moved Content");

  await f.documents.flushPendingSave();
  const draft = [...f.storage.drafts.values()][0];
  assert.equal(draft.identity.path, "archive/guide.md");
});

test("moving a directory into itself or a subfolder is rejected without touching disk or drafts", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  await f.workspace.createFolder("notes", "sub");
  await f.workspace.openFile("notes/guide.md");

  f.documents.updateActiveContent("# Protected");
  await f.documents.flushPendingSave();

  assert.equal(await f.workspace.moveEntry("notes", "notes"), false);
  assert.equal(await f.workspace.moveEntry("notes", "notes/sub"), false);

  assert.equal(f.documents.activeDocument?.content, "# Protected");
  assert.equal(f.storage.drafts.size, 1);
});

test("collision on rename or move prevents change and preserves original entries and drafts", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  await f.workspace.createFolder("", "archive");
  const targetFile = await f.notesDir.getFileHandle("other.md", { create: true });
  await (await targetFile.createWritable()).close();

  await f.workspace.openFile("notes/guide.md");
  f.documents.updateActiveContent("# Pending Collision Test");
  await f.documents.flushPendingSave();

  assert.equal(await f.workspace.renameEntry("notes/guide.md", "OTHER.md"), false);
  assert.equal(f.workspace.error, "collision");

  assert.equal(f.documents.activeDocument?.title, "guide.md");
  assert.equal(f.documents.activeDocument?.content, "# Pending Collision Test");
});

test("invalid entry names are rejected before permission requests or disk mutation", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();

  for (const bad of ["", "a/b", "a\\b", "bad\u0000", "CON", "aux.md", "trailing.", " padded"]) {
    assert.equal(await f.workspace.renameEntry("notes/guide.md", bad), false);
    assert.equal(f.workspace.error, "invalidName");
  }
  assert.equal(f.writeRequests(), 0);
});

test("deleting a file on disk removes it and cleans up its draft without opening another draft", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  await f.workspace.openFile("notes/guide.md");
  f.documents.updateActiveContent("# Will be deleted");
  await f.documents.flushPendingSave();

  assert.equal(f.storage.drafts.size, 1);
  assert.equal(await f.workspace.deleteEntry("notes/guide.md"), true);

  assert.equal(f.notesDir.entries.has("guide.md"), false);
  assert.equal(f.documents.activeDocument, undefined);
  assert.equal(f.documents.activeId, "");
  assert.equal(f.storage.drafts.size, 0);
});

test("deleting a directory on disk removes it recursively and cleans up all nested drafts", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  await f.workspace.openFile("notes/guide.md");
  f.documents.updateActiveContent("# Directory content");
  await f.documents.flushPendingSave();

  assert.equal(await f.workspace.deleteEntry("notes"), true);

  assert.equal(f.root.entries.has("notes"), false);
  assert.equal(f.documents.activeDocument, undefined);
  assert.equal(f.storage.drafts.size, 0);
});

test("permission rejection on rename, move, or delete keeps disk and drafts completely intact", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  await f.workspace.openFile("notes/guide.md");
  f.documents.updateActiveContent("# Intact Edits");
  await f.documents.flushPendingSave();

  f.deny();
  assert.equal(await f.workspace.renameEntry("notes/guide.md", "new.md"), false);
  assert.equal(f.workspace.error, "permission");
  assert.equal(f.notesDir.entries.has("guide.md"), true);
  assert.equal(f.documents.activeDocument?.content, "# Intact Edits");

  assert.equal(await f.workspace.deleteEntry("notes/guide.md"), false);
  assert.equal(f.workspace.error, "permission");
  assert.equal(f.notesDir.entries.has("guide.md"), true);
  assert.equal(f.documents.activeDocument?.content, "# Intact Edits");
  assert.equal(f.storage.drafts.size, 1);
});

test("session close and clear never deletes files or directories from disk", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  await f.workspace.openFile("notes/guide.md");

  f.workspace.close();
  assert.equal(f.notesDir.entries.has("guide.md"), true);

  f.documents.clearAllDocuments();
  assert.equal(f.notesDir.entries.has("guide.md"), true);
  assert.equal(f.root.entries.has("notes"), true);
});

test("file rename is rejected without native move, preserving the original and draft", async () => {
  const f = fixture();
  delete (f.initialFile as Partial<WorkspaceFileHandle>).move;
  await f.documents.initialize();
  await f.workspace.choose();
  await f.workspace.openFile("notes/guide.md");

  f.documents.updateActiveContent("# Fallback Content");
  await f.documents.flushPendingSave();

  assert.equal(await f.workspace.renameEntry("notes/guide.md", "fallback.md"), false);
  assert.equal(f.workspace.error, "unsupported");
  assert.equal(f.notesDir.entries.has("fallback.md"), false);
  assert.equal(f.notesDir.entries.has("guide.md"), true);
  assert.equal(f.documents.activeDocument?.title, "guide.md");
  assert.equal(f.documents.activeDocument?.content, "# Fallback Content");
});

test("directory rename reports unsupported when handle.move is not available", async () => {
  const f = fixture();
  delete (f.notesDir as Partial<DirectoryHandle>).move;
  await f.documents.initialize();
  await f.workspace.choose();

  assert.equal(await f.workspace.renameEntry("notes", "renamed_notes"), false);
  assert.equal(f.workspace.error, "unsupported");
  assert.equal(f.root.entries.has("notes"), true);
});

test("renaming a file with unrecovered draft migrates persistent storage draft", async () => {
  const f = fixture();
  await f.documents.initialize();
  await f.workspace.choose();
  await f.workspace.openFile("notes/guide.md");
  f.documents.updateActiveContent("# Stored Unrecovered Draft");
  await f.documents.flushPendingSave();

  // ES: Simula recarga sin abrir el documento / EN: Simulate reload without opening the document
  const reopenedDocs = new DocumentStore(f.storage);
  await reopenedDocs.initialize();
  const reopenedWs = new WorkspaceStore(reopenedDocs, f.port, () => Promise.resolve(f.root));
  await reopenedWs.initialize();
  await reopenedWs.choose();

  assert.equal(reopenedDocs.activeDocument, undefined);
  assert.equal(await reopenedWs.renameEntry("notes/guide.md", "stored.md"), true);

  await reopenedDocs.flushPendingSave();
  assert.equal(f.storage.drafts.size, 1);
  const draft = [...f.storage.drafts.values()][0];
  assert.equal(draft.identity.path, "notes/stored.md");
  assert.equal(draft.document.title, "stored.md");
  assert.equal(draft.document.content, "# Stored Unrecovered Draft");
});
