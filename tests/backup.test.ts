/**
 * ES: Regresiones del respaldo versionado: formato, validación, restauración y colisiones.
 * EN: Versioned backup regressions: format, validation, restore, and collisions.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { DocumentStore } from "../src/features/vault/vaultStore.svelte.ts";
import { getDraftKey } from "../src/core/storage/documentRecords.ts";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupValidationError,
  createBackupText,
  parseBackup,
} from "../src/core/storage/backupFormat.ts";
import {
  exportBackup,
  importBackup,
  inspectBackup,
} from "../src/features/vault/backupService.ts";
import type { DocumentItem, FolderItem, RecoveryDraft, SaveFileHandle } from "../src/core/types/index.ts";
import { memoryStorage } from "./helpers.ts";

function folder(id: string, name: string): FolderItem {
  return { id, name, createdAt: 1, updatedAt: 2, isExpanded: true };
}

function documentRecord(id: string, overrides: Partial<DocumentItem> = {}): DocumentItem {
  return {
    id, title: `${id}.md`, content: `# ${id}`, createdAt: 1, updatedAt: 2,
    folderId: null, hasCustomTitle: true, ...overrides,
  };
}

function localDraft(id: string, overrides: Partial<DocumentItem> = {}): RecoveryDraft {
  return {
    key: getDraftKey({ kind: "local", id }),
    identity: { kind: "local", id },
    confirmedContent: null,
    document: documentRecord(id, overrides),
  };
}

function fileDraft(path: string, content: string): RecoveryDraft {
  const identity = { kind: "file" as const, workspaceId: "w1", path };
  const key = getDraftKey(identity);
  return {
    key, identity, confirmedContent: "confirmed",
    document: documentRecord(key, { title: path.split("/").pop() ?? path, content }),
  };
}

function handle(name: string): SaveFileHandle {
  return {
    name,
    getFile: async () => ({ text: async () => "confirmed" }),
    createWritable: async () => ({ write: async () => {}, close: async () => {}, abort: async () => {} }),
    isSameEntry: async () => false,
  };
}

function validBackup() {
  return createBackupText({
    documents: [documentRecord("d1", { folderId: "f1", tags: ["uno"], isFavorite: true })],
    folders: [folder("f1", "Notas ñ")],
    drafts: [localDraft("d2", { folderId: "f1" })],
  }, 1000);
}

function expectCode(value: string, code: BackupValidationError["code"]): void {
  assert.throws(() => parseBackup(value), (error: unknown) => {
    return error instanceof BackupValidationError && error.code === code;
  });
}

test("export uses the versioned format and never serializes handles or absolute paths", () => {
  const draft = fileDraft("notas/á.md", "contenido ñ 🚀");
  const text = createBackupText({
    documents: [documentRecord("d1", {
      title: "Guía.md", content: "texto", folderId: "f1", tags: ["ñ"], isFavorite: true,
    })],
    folders: [folder("f1", "Notas ñ")],
    drafts: [{ ...draft, fileHandle: handle("á.md") }],
  }, 1234);

  const parsed = JSON.parse(text);
  assert.equal(parsed.format, BACKUP_FORMAT);
  assert.equal(parsed.version, BACKUP_VERSION);
  assert.equal(parsed.exportedAt, 1234);
  assert.equal(parsed.documents[0].title, "Guía.md");
  assert.deepEqual(parsed.documents[0].tags, ["ñ"]);
  assert.equal(parsed.documents[0].isFavorite, true);
  assert.equal(parsed.drafts[0].identity.path, "notas/á.md");
  assert.equal(parsed.drafts[0].document.content, "contenido ñ 🚀");
  assert.equal("fileHandle" in parsed.drafts[0], false);
  assert.equal(text.includes("fileHandle"), false);
});

test("the parser rejects malformed, incompatible, and unsafe backups", () => {
  const parsed = JSON.parse(validBackup());
  const change = (mutate: (copy: typeof parsed) => void): string => {
    const copy = structuredClone(parsed);
    mutate(copy);
    return JSON.stringify(copy);
  };

  expectCode("{", "malformed");
  expectCode(String(change(copy => { copy.format = "otro"; })), "invalidFormat");
  expectCode(String(change(copy => { copy.version = 2; })), "unsupportedVersion");
  expectCode(String(change(copy => { copy.exportedAt = "ayer"; })), "malformed");
  expectCode(String(change(copy => { copy.folders.push(copy.folders[0]); })), "malformed");
  expectCode(String(change(copy => { copy.documents[0].folderId = "missing"; })), "malformed");
  expectCode(String(change(copy => { copy.documents.push(copy.documents[0]); })), "malformed");
  expectCode(String(change(copy => { copy.drafts[0].key = "otra"; })), "malformed");
  expectCode(String(change(copy => { copy.drafts[0].fileHandle = {}; })), "malformed");
  expectCode(String(change(copy => { delete copy.documents[0].folderId; })), "malformed");
  expectCode(String(change(copy => { copy.documents[0].hasCustomTitle = "wrong"; })), "malformed");
  expectCode(String(change(copy => { copy.folders[0].isExpanded = "yes"; })), "malformed");
  expectCode(String(change(copy => {
    copy.drafts[0].identity = { kind: "file", workspaceId: "w1", path: "/etc/passwd" };
    copy.drafts[0].key = getDraftKey({ kind: "file", workspaceId: "w1", path: "notes/ok.md" });
  })), "malformed");
  expectCode(String(change(copy => {
    copy.drafts[0].identity = { kind: "file", workspaceId: "w1", path: "C:\\notes\\a.md" };
  })), "malformed");
  expectCode(String(change(copy => {
    copy.drafts[0].identity = { kind: "file", workspaceId: "w1", path: "../escape.md" };
  })), "malformed");
});

test("export and import restore documents, folders, names, Unicode, and drafts", async () => {
  const source = memoryStorage();
  source.folders.set("f1", folder("f1", "Proyecto ñ"));
  source.folders.set("f2", folder("f2", "Proyecto ñ"));
  source.folders.set("f3", folder("f3", "日本語 📁"));
  source.docs.set("d1", documentRecord("d1", {
    title: "Guía.md", content: "texto ñandú 🚀", folderId: "f1", tags: ["uno", "dos"], isFavorite: true,
  }));
  const pending = localDraft("d2", {
    title: "borrador.md", content: "# Borrador\n\nñ", folderId: "f3",
  });
  source.drafts.set(pending.key, pending);
  const workspaceDraft = fileDraft("notas/á.md", "edición pendiente");
  source.drafts.set(workspaceDraft.key, { ...workspaceDraft, fileHandle: handle("á.md") });

  const first = new DocumentStore(source);
  await first.initialize();
  const exported = await exportBackup(first);
  assert.equal(exported.ok, true);
  if (!exported.ok) return;

  const target = memoryStorage();
  const second = new DocumentStore(target);
  await second.initialize();
  const inspected = await inspectBackup(second, exported.text);
  assert.equal(inspected.ok, true);
  if (!inspected.ok) return;
  assert.equal(inspected.conflicts, 0);

  const imported = await importBackup(second, inspected.backup, false);
  assert.equal(imported.ok, true);
  assert.equal(target.docs.get("d1")?.content, "texto ñandú 🚀");
  assert.equal(target.docs.get("d1")?.folderId, "f1");
  assert.deepEqual(target.docs.get("d1")?.tags, ["uno", "dos"]);
  assert.equal(target.folders.get("f3")?.name, "日本語 📁");
  assert.equal([...target.folders.values()].filter(f => f.name === "Proyecto ñ").length, 2);
  assert.equal(target.drafts.get(pending.key)?.document.content, "# Borrador\n\nñ");
  assert.equal(target.drafts.get(workspaceDraft.key)?.identity.kind, "file");
  assert.equal(target.drafts.get(workspaceDraft.key)?.document.content, "edición pendiente");
  assert.equal("fileHandle" in (target.drafts.get(workspaceDraft.key) ?? {}), false);
  assert.equal(second.folders.length, 3);
  assert.equal(second.documents.some(d => d.title === "Guía.md"), true);
  assert.equal(second.documents.some(d => d.title === "borrador.md"), true);
});

test("collisions require explicit replacement and keep unrelated data", async () => {
  const current = memoryStorage();
  current.folders.set("f1", folder("f1", "Actual"));
  current.docs.set("d1", documentRecord("d1", { content: "actual" }));
  current.docs.set("d9", documentRecord("d9", { content: "intacto" }));
  const oldDraft = localDraft("d2", { content: "borrador actual" });
  current.drafts.set(oldDraft.key, oldDraft);

  const incoming = memoryStorage();
  incoming.folders.set("f1", folder("f1", "Respaldo"));
  incoming.docs.set("d1", documentRecord("d1", { content: "respaldo" }));
  incoming.docs.set("d3", documentRecord("d3", { content: "nuevo" }));
  const newDraft = localDraft("d2", { content: "borrador del respaldo" });
  incoming.drafts.set(newDraft.key, newDraft);
  const source = new DocumentStore(incoming);
  await source.initialize();
  const exported = await exportBackup(source);
  assert.equal(exported.ok, true);
  if (!exported.ok) return;

  const target = new DocumentStore(current);
  await target.initialize();
  const inspected = await inspectBackup(target, exported.text);
  assert.equal(inspected.ok, true);
  if (!inspected.ok) return;
  assert.equal(inspected.conflicts, 3);

  const refused = await importBackup(target, inspected.backup, false);
  assert.deepEqual(refused, { ok: false, error: "conflict" });
  assert.equal(current.docs.get("d1")?.content, "actual");
  assert.equal(current.folders.get("f1")?.name, "Actual");
  assert.equal(current.drafts.get(oldDraft.key)?.document.content, "borrador actual");
  assert.equal(current.docs.has("d3"), false);

  const replaced = await importBackup(target, inspected.backup, true);
  assert.equal(replaced.ok, true);
  assert.equal(current.docs.get("d1")?.content, "respaldo");
  assert.equal(current.folders.get("f1")?.name, "Respaldo");
  assert.equal(current.drafts.get(oldDraft.key)?.document.content, "borrador del respaldo");
  assert.equal(current.docs.get("d3")?.content, "nuevo");
  assert.equal(current.docs.get("d9")?.content, "intacto");
});

test("an edit during restoration aborts the import without losing it", async () => {
  const storage = memoryStorage();
  storage.docs.set("d1", documentRecord("d1", { content: "actual" }));
  const store = new DocumentStore(storage);
  await store.initialize();
  store.selectDocument("d1");

  const text = createBackupText({
    documents: [documentRecord("d1", { content: "respaldo" })],
    folders: [],
    drafts: [],
  });
  const inspected = await inspectBackup(store, text);
  assert.equal(inspected.ok, true);
  if (!inspected.ok) return;
  assert.equal(inspected.conflicts, 1);

  const original = storage.restoreBackup;
  let entered!: () => void;
  let release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  storage.restoreBackup = async (plan) => {
    entered();
    await gate;
    return original(plan);
  };

  const importing = importBackup(store, inspected.backup, true);
  await started;
  store.updateActiveContent("edición durante la importación");
  release();

  assert.deepEqual(await importing, { ok: false, error: "changed" });
  assert.equal(store.activeDocument?.content, "edición durante la importación");
  assert.equal(storage.docs.get("d1")?.content, "actual");
  assert.equal(await store.flushPendingSave(), true);
  const draft = [...storage.drafts.values()].find(d => d.document.id === "d1");
  assert.equal(draft?.document.content, "edición durante la importación");
});

test("an edit after the restore commit survives the session reload", async () => {
  const storage = memoryStorage();
  storage.docs.set("d1", documentRecord("d1", { content: "actual" }));
  const store = new DocumentStore(storage);
  await store.initialize();
  store.selectDocument("d1");

  const text = createBackupText({
    documents: [
      documentRecord("d1", { content: "respaldo" }),
      documentRecord("d2", { content: "nuevo" }),
    ],
    folders: [],
    drafts: [],
  });
  const inspected = await inspectBackup(store, text);
  assert.equal(inspected.ok, true);
  if (!inspected.ok) return;
  assert.equal(inspected.conflicts, 1);

  const original = storage.restoreBackup;
  let committed!: () => void;
  let release!: () => void;
  const confirmed = new Promise<void>(resolve => { committed = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  storage.restoreBackup = async (plan) => {
    await original(plan);
    committed();
    await gate;
  };

  const importing = importBackup(store, inspected.backup, true);
  await confirmed;
  store.updateActiveContent("edición después del commit");
  release();

  assert.equal((await importing).ok, true);
  assert.equal(storage.docs.get("d1")?.content, "respaldo");
  assert.equal(store.documents.some(doc => doc.id === "d2"), true);
  assert.equal(store.activeDocument?.content, "edición después del commit");
  assert.equal(await store.flushPendingSave(), true);
  const draft = [...storage.drafts.values()].find(d => d.document.id === "d1");
  assert.equal(draft?.document.content, "edición después del commit");
});

test("persistence failures never report a complete backup or modify existing data", async () => {
  const storage = memoryStorage();
  storage.docs.set("d1", documentRecord("d1", { content: "original" }));
  const store = new DocumentStore(storage);
  await store.initialize();
  store.selectDocument("d1");
  store.updateActiveContent("pendiente");

  const saveDraft = storage.saveDraft;
  storage.saveDraft = async () => { throw new Error("quota"); };
  const failedExport = await exportBackup(store);
  assert.deepEqual(failedExport, { ok: false, error: "flush" });
  storage.saveDraft = saveDraft;

  const valid = validBackup();
  storage.getAllDocuments = async () => { throw new Error("unreadable"); };
  const failedRead = await inspectBackup(store, valid);
  assert.deepEqual(failedRead, { ok: false, error: "storage" });

  storage.getAllDocuments = async () => [...storage.docs.values()].map(d => ({ ...d }));
  const inspected = await inspectBackup(store, valid);
  assert.equal(inspected.ok, true);
  if (!inspected.ok) return;
  storage.restoreBackup = async () => { throw new Error("write failed"); };
  const failedRestore = await importBackup(store, inspected.backup, true);
  assert.deepEqual(failedRestore, { ok: false, error: "restore" });
  assert.equal(storage.docs.get("d1")?.content, "original");
  assert.equal(storage.drafts.size, 1);
});
