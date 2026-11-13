/**
 * ES: Regresiones de seguridad al reintentar la migración y al retirar copias verificadas.
 * EN: Safety regressions for migration retry and verified-copy retirement.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  detectMigrationCandidates,
  inspectMigration,
  executeMigration,
  retireLegacyDocuments,
  candidateForFolderDrop,
} from "../src/features/vault/migrationService.ts";
import { workspaceFixture } from "./workspaceFixtures.ts";
import { deferred } from "./helpers.ts";
import type { WorkspaceFileHandle } from "../src/core/storage/workspacePort.ts";
import { createFileWithoutOverwrite } from "../src/features/vault/migrationFileWriter.ts";

test("dropping one browser document targets the chosen disk folder without moving other documents", async () => {
  const f = workspaceFixture();
  await f.documents.initialize();
  const localFolder = f.documents.createFolder("origen-local");
  const dragged = f.documents.createDocument("arrastrado.md", "# Arrastrado", localFolder.id, true);
  f.documents.createDocument("otro.md", "# Otro", null, true);
  const candidate = candidateForFolderDrop(f.documents, dragged.id);
  assert.ok(candidate);
  assert.equal(candidate.folderName, null);
  assert.equal(candidate.folderId, null);
  const target = await f.root.getDirectoryHandle("destino", { create: true });
  const plan = await inspectMigration([candidate], target);
  assert.equal(plan[0].targetPath, "arrastrado.md");
  const result = await executeMigration(plan, target, f.documents);
  assert.equal(result.succeeded.length, 1);
  assert.equal(await (await (await target.getFileHandle("arrastrado.md")).getFile()).text(), "# Arrastrado");
  assert.equal(f.documents.documents.some((doc) => doc.id === dragged.id), true);
  assert.equal(f.root.entries.has("otro.md"), false);
  assert.equal(candidateForFolderDrop(f.documents, "no-existe"), null);
});

test("migration refuses native move when the selected filesystem replaces occupied names", async () => {
  const f = workspaceFixture({ overwriteOnMoveCollision: true });
  let claimed = false;
  await assert.rejects(
    () => createFileWithoutOverwrite(f.root, "nuevo.md", "# Nuevo", () => { claimed = true; }),
    /native move.*replace|unsafe.*move/i,
  );
  assert.equal(claimed, false);
  assert.equal(f.root.entries.has("nuevo.md"), false);
  assert.equal([...f.root.entries.keys()].some((name) => name.startsWith(".kallosmd-migration-")), false);
  assert.equal([...f.root.entries.keys()].some((name) => name.startsWith(".kallosmd-move-check-")), false);
});

test("filesystem with replacing move saves the requested name and verifies it before retirement", async () => {
  const f = workspaceFixture({ overwriteOnMoveCollision: true });
  await f.documents.initialize();
  const original = f.documents.createDocument("legado.md", "# Original", null, true);
  const plan = await inspectMigration(detectMigrationCandidates(f.documents), f.root);

  const result = await executeMigration(plan, f.root, f.documents);
  assert.equal(result.ok, true);
  assert.equal(result.succeeded.length, 1);
  assert.equal(result.succeeded[0].targetPath, "legado.md");
  assert.equal(f.root.entries.has("legado.md"), true);
  const saved = await f.root.getFileHandle(result.succeeded[0].targetPath);
  assert.equal(await (await saved.getFile()).text(), "# Original");
  assert.equal(f.documents.documents.some((doc) => doc.id === original.id), true);
  const retired = await retireLegacyDocuments(f.documents, result.succeeded);
  assert.equal(retired.retiredCount, 1);
  assert.equal(f.documents.documents.some((doc) => doc.id === original.id), false);
  assert.equal(await (await saved.getFile()).text(), "# Original");
});

test("a disk name conflict requires a choice and replaces only the inspected version", async () => {
  const f = workspaceFixture({ overwriteOnMoveCollision: true });
  await f.documents.initialize();
  f.documents.createDocument("documento-7.md", "# Nueva versión", null, true);
  const existing = await f.root.getFileHandle("documento-7.md", { create: true });
  const writer = await existing.createWritable();
  await writer.write("# Versión anterior");
  await writer.close();
  const plan = await inspectMigration(detectMigrationCandidates(f.documents), f.root);
  assert.equal(plan[0].resolution, "ask");

  const unresolved = await executeMigration(plan, f.root, f.documents);
  assert.equal(unresolved.succeeded.length, 0);
  assert.equal(await (await existing.getFile()).text(), "# Versión anterior");

  const replaced = await executeMigration([{ ...plan[0], resolution: "overwrite" }], f.root, f.documents);
  assert.equal(replaced.succeeded.length, 1);
  assert.equal(replaced.succeeded[0].targetPath, "documento-7.md");
  assert.equal(await (await existing.getFile()).text(), "# Nueva versión");
});

test("an explicit extra copy uses a readable suffix and preserves the original disk file", async () => {
  const f = workspaceFixture({ overwriteOnMoveCollision: true });
  await f.documents.initialize();
  f.documents.createDocument("documento-7.md", "# Copia nueva", null, true);
  const existing = await f.root.getFileHandle("documento-7.md", { create: true });
  const writer = await existing.createWritable();
  await writer.write("# Original en disco");
  await writer.close();
  const plan = await inspectMigration(detectMigrationCandidates(f.documents), f.root);
  const copied = await executeMigration([{ ...plan[0], resolution: "rename" }], f.root, f.documents);
  assert.equal(copied.succeeded[0].targetPath, "documento-7 (1).md");
  assert.equal(await (await existing.getFile()).text(), "# Original en disco");
  assert.equal(await (await (await f.root.getFileHandle("documento-7 (1).md")).getFile()).text(), "# Copia nueva");
});

test("replacement is refused if the disk file changed after conflict review", async () => {
  const f = workspaceFixture({ overwriteOnMoveCollision: true });
  await f.documents.initialize();
  f.documents.createDocument("documento-7.md", "# Navegador", null, true);
  const existing = await f.root.getFileHandle("documento-7.md", { create: true });
  let writer = await existing.createWritable();
  await writer.write("# Disco antes");
  await writer.close();
  const plan = await inspectMigration(detectMigrationCandidates(f.documents), f.root);
  writer = await existing.createWritable();
  await writer.write("# Disco editado");
  await writer.close();

  const result = await executeMigration([{ ...plan[0], resolution: "overwrite" }], f.root, f.documents);
  assert.equal(result.succeeded.length, 0);
  assert.equal(result.failed.length, 1);
  assert.equal(await (await existing.getFile()).text(), "# Disco editado");
});

test("regression 6: retry never replaces a foreign file because it did not create that destination", async () => {
  const f = workspaceFixture();
  await f.documents.initialize();

  f.documents.createDocument("ajeno.md", "# Contenido de la migración", null, true);
  const candidates = detectMigrationCandidates(f.documents);
  const plan = await inspectMigration(candidates, f.root);

  // ES: Un archivo ajeno aparece tras la inspección, antes del primer intento
  // EN: A foreign file appears after inspection, before the first attempt
  const foreignContent = "# Documento ajeno que no debe tocarse";
  const foreignFile = {
    kind: "file" as const,
    name: "ajeno.md",
    getFile: async () => ({ name: "ajeno.md", text: async () => foreignContent } as unknown as File),
    createWritable: async () => { throw new Error("Must not be called"); },
    isSameEntry: async () => false,
  };
  (f.root as unknown as { entries: Map<string, unknown> }).entries.set("ajeno.md", foreignFile);

  const firstResult = await executeMigration(plan, f.root, f.documents);
  assert.equal(firstResult.failed.length, 1);
  // ES: Un conflicto ajeno no deja parcial propio que autorice sustitución
  // EN: A foreign collision leaves no owned partial authorizing replacement
  assert.equal(firstResult.failed[0].partialContent, undefined);

  // ES: El reintento del modal autoriza solo los parciales propios (ninguno en este caso)
  // EN: The modal retry only authorizes owned partials (none here)
  const authorizedPartials: Record<string, string> = {};
  for (const failure of firstResult.failed) {
    if (failure.partialContent !== undefined) authorizedPartials[failure.id] = failure.partialContent;
  }
  const retryResult = await executeMigration(plan, f.root, f.documents, { authorizedPartials });
  assert.equal(retryResult.ok, false);
  assert.equal(retryResult.failed.length, 1);
  assert.match(retryResult.failed[0].error, /already exists/i);

  const current = (f.root as unknown as { entries: Map<string, WorkspaceFileHandle> }).entries.get("ajeno.md");
  assert.ok(current);
  assert.equal(await (await current.getFile()).text(), foreignContent);
});

test("regression 7: an edit during the durable retirement wait is preserved and never reported as retired", async () => {
  const f = workspaceFixture();
  await f.documents.initialize();

  const doc = f.documents.createDocument("vivo.md", "# Versión verificada", null, true);
  const candidates = detectMigrationCandidates(f.documents);
  const plan = await inspectMigration(candidates, f.root);
  const result = await executeMigration(plan, f.root, f.documents);
  assert.equal(result.succeeded.length, 1);

  // ES: Retener la operación durable para simular una edición en plena espera
  // EN: Hold the durable operation to simulate an edit during the wait
  const entered = deferred();
  const gate = deferred();
  const originalRetire = f.storage.retireDocumentIfUnchanged.bind(f.storage);
  f.storage.retireDocumentIfUnchanged = async (id, draftKey, expected) => {
    entered.resolve();
    await gate.promise;
    return originalRetire(id, draftKey, expected);
  };

  const retirePromise = retireLegacyDocuments(f.documents, result.succeeded);
  await entered.promise;

  f.documents.selectDocument(doc.id);
  f.documents.updateActiveContent("# Edición durante el retiro");
  gate.resolve();

  const retireRes = await retirePromise;
  assert.equal(retireRes.retiredCount, 0);
  assert.equal(retireRes.preservedCount, 1);
  assert.equal(retireRes.backupPresent, true);

  // ES: La edición sigue en la sesión y también quedó durable en IndexedDB
  // EN: The edit remains in the session and is also durable in IndexedDB
  const surviving = f.documents.documents.find(d => d.id === doc.id);
  assert.ok(surviving);
  assert.equal(surviving.content, "# Edición durante el retiro");
  const persisted = [...f.storage.drafts.values()].find(d => d.document.id === doc.id);
  assert.ok(persisted);
  assert.equal(persisted.document.content, "# Edición durante el retiro");
});

test("regression 8: durable retirement refuses to delete a newer draft persisted by another context", async () => {
  const f = workspaceFixture();
  await f.documents.initialize();

  const doc = f.documents.createDocument("remoto.md", "# Versión verificada", null, true);
  const sourceUpdatedAt = doc.updatedAt;
  const candidates = detectMigrationCandidates(f.documents);
  const plan = await inspectMigration(candidates, f.root);
  const result = await executeMigration(plan, f.root, f.documents);
  assert.equal(result.succeeded.length, 1);

  // ES: Otra pestaña guarda una versión más reciente solo en IndexedDB; la sesión aún no la ve
  // EN: Another tab persists a newer version only in IndexedDB; the session has not seen it yet
  const draftKey = JSON.stringify(["local", doc.id]);
  await f.storage.saveDraft({
    key: draftKey,
    identity: { kind: "local", id: doc.id },
    confirmedContent: "# Versión verificada",
    document: { ...doc, content: "# Edición de otra pestaña", updatedAt: sourceUpdatedAt + 1000 },
  });

  const retireRes = await retireLegacyDocuments(f.documents, result.succeeded);
  assert.equal(retireRes.retiredCount, 0);
  assert.equal(retireRes.preservedCount, 1);
  assert.equal(retireRes.backupPresent, true);

  // ES: La operación durable no borró el borrador más reciente
  // EN: The durable operation did not delete the newer draft
  assert.equal(f.storage.drafts.has(draftKey), true);
  assert.equal(f.storage.drafts.get(draftKey)?.document.content, "# Edición de otra pestaña");
  assert.equal(f.documents.documents.some(d => d.id === doc.id), true);
});

test("regression 9: a prefix-looking foreign file is not authorized by the removed allowOverwrite path", async () => {
  const f = workspaceFixture();
  await f.documents.initialize();

  f.documents.createDocument("prefijo.md", "# Origen completo", null, true);
  const plan = await inspectMigration(detectMigrationCandidates(f.documents), f.root);

  // ES: El contenido ajeno es prefijo del origen, pero el archivo no lo creó esta migración
  // EN: The foreign content is a prefix of the source, but this migration did not create the file
  const foreignContent = "# Origen";
  (f.root as unknown as { entries: Map<string, unknown> }).entries.set("prefijo.md", {
    kind: "file" as const,
    name: "prefijo.md",
    getFile: async () => ({ name: "prefijo.md", text: async () => foreignContent } as unknown as File),
    createWritable: async () => { throw new Error("Must not be called"); },
    isSameEntry: async () => false,
  });

  const firstResult = await executeMigration(plan, f.root, f.documents);
  assert.equal(firstResult.failed.length, 1);
  assert.equal(firstResult.failed[0].partialContent, undefined);

  // ES: La opción heredada ya no existe; si se cuela en tiempo de ejecución, no autoriza nada
  // EN: The legacy option no longer exists; if it sneaks in at runtime, it authorizes nothing
  const legacyRetry = await executeMigration(
    plan,
    f.root,
    f.documents,
    { allowOverwrite: true } as unknown as Parameters<typeof executeMigration>[3],
  );
  assert.equal(legacyRetry.ok, false);
  assert.match(legacyRetry.failed[0].error, /already exists/i);

  const current = (f.root as unknown as { entries: Map<string, WorkspaceFileHandle> }).entries.get("prefijo.md");
  assert.ok(current);
  assert.equal(await (await current.getFile()).text(), foreignContent);
});

/**
 * ES: Reproduce la carrera: otro proceso crea el archivo final justo después de la comprobación de
 * existencia y antes del renombrado. Comprueba que nunca se sobrescribe, esté vacío o no.
 * EN: Reproduces the race: another process creates the final file right after the existence check and
 * before the rename. Verifies it is never overwritten, whether empty or not.
 */
async function assertRaceFilePreserved(foreignContent: string): Promise<void> {
  const f = workspaceFixture();
  await f.documents.initialize();

  f.documents.createDocument("carrera.md", "# Contenido de la migración", null, true);
  const plan = await inspectMigration(detectMigrationCandidates(f.documents), f.root);
  assert.equal(plan[0].hasCollision, false);

  const entries = (f.root as unknown as { entries: Map<string, WorkspaceFileHandle> }).entries;
  const foreignFile: WorkspaceFileHandle = {
    kind: "file",
    name: "carrera.md",
    getFile: async () => ({ name: "carrera.md", text: async () => foreignContent } as unknown as File),
    createWritable: async () => { throw new Error("Must not be called"); },
    isSameEntry: async () => false,
  };

  const originalGetFileHandle = f.root.getFileHandle.bind(f.root);
  let injected = false;
  f.root.getFileHandle = async (name: string, options?: { create?: boolean }) => {
    const handle = await originalGetFileHandle(name, options);
    // ES: El archivo ajeno aparece después de la comprobación de existencia, durante el temporal
    // EN: The foreign file appears after the existence check, during the temp-file phase
    if (options?.create && name.startsWith(".kallosmd-migration-") && !injected) {
      injected = true;
      entries.set("carrera.md", foreignFile);
    }
    return handle;
  };

  const result = await executeMigration(plan, f.root, f.documents);
  assert.equal(result.ok, false);
  assert.equal(result.succeeded.length, 0);
  assert.equal(result.failed.length, 1);
  assert.match(result.failed[0].error, /already exists/i);
  assert.equal(result.failed[0].partialContent, undefined);

  // ES: El reintento tampoco sustituye el archivo ajeno
  // EN: The retry does not replace the foreign file either
  f.root.getFileHandle = originalGetFileHandle;
  const retryResult = await executeMigration(plan, f.root, f.documents, { authorizedPartials: {} });
  assert.equal(retryResult.ok, false);
  assert.match(retryResult.failed[0].error, /already exists/i);

  const current = entries.get("carrera.md");
  assert.ok(current);
  assert.equal(await (await current.getFile()).text(), foreignContent);
  // ES: No quedan temporales de la migración en el destino
  // EN: No migration temp files are left behind in the destination
  assert.equal([...entries.keys()].some(key => key.startsWith(".kallosmd-migration-")), false);
}

test("regression 10: a non-empty file created during the race window is never overwritten", async () => {
  await assertRaceFilePreserved("# Archivo ajeno creado en carrera");
});

test("regression 12: an empty file created during the race window is never treated as our own", async () => {
  await assertRaceFilePreserved("");
});

test("regression 11: permission errors while searching a collision suffix are propagated", async () => {
  const f = workspaceFixture();
  await f.documents.initialize();

  f.documents.createDocument("colision.md", "# Nuevo contenido", null, true);

  // ES: Un archivo existente obliga a buscar el sufijo colision (1).md
  // EN: An existing file forces the search for the colision (1).md suffix
  (f.root as unknown as { entries: Map<string, unknown> }).entries.set("colision.md", {
    kind: "file" as const,
    name: "colision.md",
    getFile: async () => ({ name: "colision.md", text: async () => "# Existente" } as unknown as File),
    createWritable: async () => { throw new Error("Must not be called"); },
    isSameEntry: async () => false,
  });

  const originalGetFileHandle = f.root.getFileHandle.bind(f.root);
  f.root.getFileHandle = async (name: string, options?: { create?: boolean }) => {
    if (name === "colision (1).md") {
      throw new DOMException("Access denied by system policy", "NotAllowedError");
    }
    return originalGetFileHandle(name, options);
  };

  await assert.rejects(
    () => inspectMigration(detectMigrationCandidates(f.documents), f.root),
    (err: unknown) => err instanceof DOMException && err.name === "NotAllowedError",
  );
});

test("regression 13: an empty authorized partial does not prove ownership of a foreign empty file", async () => {
  const f = workspaceFixture();
  await f.documents.initialize();

  f.documents.createDocument("vacio.md", "# Contenido propio", null, true);
  const plan = await inspectMigration(detectMigrationCandidates(f.documents), f.root);

  // ES: Un archivo ajeno vacío aparece tras la inspección; su vacío no demuestra pertenencia
  // EN: A foreign empty file appears after inspection; being empty does not prove ownership
  const entries = (f.root as unknown as { entries: Map<string, WorkspaceFileHandle> }).entries;
  const foreignFile: WorkspaceFileHandle = {
    kind: "file",
    name: "vacio.md",
    getFile: async () => ({ name: "vacio.md", text: async () => "" } as unknown as File),
    createWritable: async () => { throw new Error("Must not be called"); },
    isSameEntry: async () => false,
  };
  entries.set("vacio.md", foreignFile);

  const result = await executeMigration(plan, f.root, f.documents, {
    authorizedPartials: { [plan[0].candidate.id]: "" },
  });
  assert.equal(result.ok, false);
  assert.equal(result.succeeded.length, 0);
  assert.match(result.failed[0].error, /already exists/i);
  assert.equal(result.failed[0].partialContent, undefined);

  const current = entries.get("vacio.md");
  assert.ok(current);
  assert.equal(await (await current.getFile()).text(), "");
});
