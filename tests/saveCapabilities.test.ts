/**
 * ES: Detección de capacidades y modo de guardado sin escritura directa.
 * EN: Capability detection and save mode without direct disk access.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { pickSaveFile, supportsSaveFilePicker } from "../src/core/storage/fileSystemAdapter.ts";
import { DocumentStore } from "../src/features/vault/vaultStore.svelte.ts";
import type { SaveFileHandle } from "../src/core/types/index.ts";
import { memoryStorage } from "./helpers.ts";
import { workspaceFixture } from "./workspaceFixtures.ts";

type Host = typeof globalThis & { window?: unknown };

function restoreWindow(previous: unknown): void {
  const host = globalThis as Host;
  if (previous === undefined) delete host.window;
  else host.window = previous;
}

function fakeHandle(): SaveFileHandle {
  return {
    name: "draft.md",
    getFile: async () => ({ text: async () => "" }),
    createWritable: async () => ({ write: async () => {}, close: async () => {}, abort: async () => {} }),
    isSameEntry: async () => false,
  } as unknown as SaveFileHandle;
}

test("save capability is detected from the actual host function", async () => {
  const previous = (globalThis as Host).window;
  try {
    delete (globalThis as Host).window;
    assert.equal(supportsSaveFilePicker(), false);
    assert.equal(pickSaveFile("draft.md"), null);

    (globalThis as Host).window = {};
    assert.equal(supportsSaveFilePicker(), false);
    assert.equal(pickSaveFile("draft.md"), null);

    let options: { suggestedName?: string } | undefined;
    const handle = fakeHandle();
    (globalThis as Host).window = {
      addEventListener: () => {},
      showSaveFilePicker: async (value: { suggestedName?: string }) => {
        options = value;
        return handle;
      },
    };
    assert.equal(supportsSaveFilePicker(), true);
    assert.equal(await pickSaveFile("draft.md"), handle);
    assert.equal(options?.suggestedName, "draft.md");
  } finally {
    restoreWindow(previous);
  }
});

test("save mode distinguishes download, save as, and direct save", async () => {
  const previous = (globalThis as Host).window;
  try {
    (globalThis as Host).window = { addEventListener: () => {} };
    const store = new DocumentStore(memoryStorage());
    await store.initialize();
    const doc = store.createDocument("draft.md", "text");
    assert.equal(store.saveMode(doc.id), "download");

    const handle = fakeHandle();
    store.versions[doc.id] = { ...store.versions[doc.id], fileHandle: handle, confirmedContent: "text" };
    assert.equal(store.saveMode(doc.id), "save");

    store.versions[doc.id] = { ...store.versions[doc.id], fileHandle: undefined };
    (globalThis as Host).window = {
      addEventListener: () => {},
      showSaveFilePicker: async () => handle,
    };
    assert.equal(store.saveMode(doc.id), "saveAs");
    await store.flushPendingSave();
  } finally {
    restoreWindow(previous);
  }
});

test("an active workspace offers save as even without the native save picker", async () => {
  const previous = (globalThis as Host).window;
  try {
    (globalThis as Host).window = { addEventListener: () => {} };
    const f = workspaceFixture();
    await f.documents.initialize();
    await f.workspace.choose();
    const doc = f.documents.createDocument("draft.md", "text");
    assert.equal(f.documents.saveMode(doc.id), "saveAs");
    await f.documents.flushPendingSave();
  } finally {
    restoreWindow(previous);
  }
});
