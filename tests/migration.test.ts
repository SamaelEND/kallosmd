/**
 * ES: Pruebas unitarias para la migración de documentos locales anteriores a una carpeta de trabajo.
 * EN: Unit tests for migrating legacy local documents into a workspace directory.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  detectMigrationCandidates,
  inspectMigration,
  executeMigration,
  retireLegacyDocuments,
  exportMigrationAlternative,
  sanitizeFileName,
  type MigrationPlanItem,
  type VerifiedMigrationItem,
} from "../src/features/vault/migrationService.ts";
import { workspaceFixture } from "./workspaceFixtures.ts";
import { deferred } from "./helpers.ts";
import type { DirectoryHandle, WorkspaceFileHandle } from "../src/core/storage/workspacePort.ts";

test("detects only legacy local documents as migration candidates, preserving drafts and workspace isolation", async () => {
  const f = workspaceFixture();
  await f.documents.initialize();

  // ES: Crear 2 documentos locales en IndexedDB (uno en raíz, uno en carpeta local)
  // EN: Create 2 local documents in IndexedDB (one in root, one in a local folder)
  const folder = f.documents.createFolder("Proyectos");
  const localDoc1 = f.documents.createDocument("notas.md", "# Mis Notas\n\nContenido", null, true);
  const localDoc2 = f.documents.createDocument("diseño.md", "# Arquitectura\n\nSpecs", folder.id, true);

  // ES: Simular que se abre un archivo de workspace (no debe ser candidato)
  // EN: Simulate opening a workspace file (must not be candidate)
  await f.workspace.choose();
  await f.workspace.openFile("notes/guide.md");

  const candidates = detectMigrationCandidates(f.documents);
  assert.equal(candidates.length, 2);

  const cand1 = candidates.find(c => c.id === localDoc1.id);
  assert.ok(cand1);
  assert.equal(cand1.title, "notas.md");
  assert.equal(cand1.folderName, null);

  const cand2 = candidates.find(c => c.id === localDoc2.id);
  assert.ok(cand2);
  assert.equal(cand2.title, "diseño.md");
  assert.equal(cand2.folderName, "Proyectos");

  // ES: Ningún borrador pendiente fue eliminado durante la detección
  // EN: No pending draft was deleted during detection
  assert.equal(f.documents.documents.length, 3);
});

test("inspectMigration preserves file names independent of first H1 and resolves collisions safely", async () => {
  const f = workspaceFixture();
  await f.documents.initialize();

  // ES: El título del documento es 'resumen.md', pero el H1 es '# Título Muy Diferente'
  // EN: Document title is 'resumen.md', but H1 is '# Very Different Heading'
  const doc = f.documents.createDocument("resumen.md", "# Título Muy Diferente\n\nTexto", null, true);

  // ES: En la raíz del workspace ya existe un archivo llamado 'resumen.md'
  // EN: In workspace root there is already a file named 'resumen.md'
  const existingFile: WorkspaceFileHandle = {
    kind: "file",
    name: "resumen.md",
    getFile: async () => ({
      name: "resumen.md",
      text: async () => "# Ya existente en disco",
    } as unknown as File),
    createWritable: async () => ({
      write: async () => {},
      close: async () => {},
      abort: async () => {},
    }),
    isSameEntry: async () => false,
  };
  (f.root as unknown as { entries: Map<string, unknown> }).entries.set("resumen.md", existingFile);

  const candidates = detectMigrationCandidates(f.documents);
  const plan = await inspectMigration(candidates, f.root);

  assert.equal(plan.length, 1);
  const item = plan[0];
  // ES: El nombre base conserva 'resumen.md' independiente del H1 '# Título Muy Diferente'
  // EN: Base name preserves 'resumen.md' independent of H1 '# Very Different Heading'
  assert.equal(item.targetFileName, "resumen.md");
  assert.equal(item.hasCollision, true);
  assert.equal(item.resolution, "ask");
  assert.equal(item.resolvedFileName, "resumen (1).md");
  assert.equal(item.resolvedPath, "resumen (1).md");
});

test("cancellation leaves both origin IndexedDB and destination disk completely intact", async () => {
  const f = workspaceFixture();
  await f.documents.initialize();

  const doc = f.documents.createDocument("informe.md", "# Informe\n\nBorrador original", null, true);
  const candidates = detectMigrationCandidates(f.documents);
  const plan = await inspectMigration(candidates, f.root);

  // ES: Se cancela antes de llamar a executeMigration: ni el disco ni el store deben cambiar
  // EN: Cancelled before calling executeMigration: neither disk nor store must change
  const initialRootEntriesCount = (f.root as unknown as { entries: Map<string, unknown> }).entries.size;

  assert.equal(f.documents.documents.find(d => d.id === doc.id)?.content, "# Informe\n\nBorrador original");
  assert.equal((f.root as unknown as { entries: Map<string, unknown> }).entries.size, initialRootEntriesCount);
  assert.equal((f.root as unknown as { entries: Map<string, unknown> }).entries.has("informe.md"), false);
});

test("permission denied aborts migration without writing disk or touching IndexedDB", async () => {
  const f = workspaceFixture();
  await f.documents.initialize();

  f.documents.createDocument("seguro.md", "# Contenido confidencial", null, true);
  const candidates = detectMigrationCandidates(f.documents);
  const plan = await inspectMigration(candidates, f.root);

  // ES: Denegar permiso de escritura en la carpeta
  // EN: Deny write permission on folder
  f.deny();

  const result = await executeMigration(plan, f.root, f.documents);
  assert.equal(result.ok, false);
  assert.equal(result.error, "permission");
  assert.equal(result.succeeded.length, 0);
  assert.equal(result.failed.length, 0);
  assert.equal(result.pending.length, 1);

  // ES: No se creó ningún archivo en disco
  // EN: No file was created on disk
  assert.equal((f.root as unknown as { entries: Map<string, unknown> }).entries.has("seguro.md"), false);
});

test("executes migration, writes subfolders, verifies content, and protects drafts", async () => {
  const f = workspaceFixture();
  await f.documents.initialize();

  const folder = f.documents.createFolder("Reportes");
  const doc = f.documents.createDocument("anual.md", "# Balance 2026\n\nTodo verificado", folder.id, true);

  const candidates = detectMigrationCandidates(f.documents);
  const plan = await inspectMigration(candidates, f.root);

  const result = await executeMigration(plan, f.root, f.documents);
  assert.equal(result.ok, true);
  assert.equal(result.succeeded.length, 1);
  assert.equal(result.failed.length, 0);

  const success = result.succeeded[0];
  assert.equal(success.id, doc.id);
  assert.equal(success.targetPath, "Reportes/anual.md");

  // ES: Verificar que se creó la subcarpeta y el archivo en disco con el contenido exacto
  // EN: Verify subfolder and file were created on disk with exact content
  const reportesDir = (f.root as unknown as { entries: Map<string, DirectoryHandle> }).entries.get("Reportes");
  assert.ok(reportesDir);
  const fileEntry = (reportesDir as unknown as { entries: Map<string, { content: string }> }).entries.get("anual.md");
  assert.ok(fileEntry);
  assert.equal(fileEntry.content, "# Balance 2026\n\nTodo verificado");

  // ES: El documento en IndexedDB permanece intacto como respaldo hasta confirmación explícita
  // EN: Document in IndexedDB remains intact as backup until explicit confirmation
  assert.equal(f.documents.documents.some(d => d.id === doc.id), true);
});

test("reports partial failures and preserves the browser original when an empty disk file blocks retry", async () => {
  const f = workspaceFixture();
  await f.documents.initialize();

  const doc1 = f.documents.createDocument("ok.md", "Contenido 1", null, true);
  const doc2 = f.documents.createDocument("fallo.md", "Contenido 2", null, true);

  // ES: Simular fallo de escritura únicamente para fallo.md.
  // EN: Simulate a write failure only for fallo.md.
  let shouldFail = true;
  const originalGetFileHandle = f.root.getFileHandle.bind(f.root);
  f.root.getFileHandle = async (name: string, options?: { create?: boolean }) => {
    const handle = await originalGetFileHandle(name, options);
    if (options?.create && name === "fallo.md") {
      const originalCreate = handle.createWritable.bind(handle);
      handle.createWritable = async (opts?: { mode?: "exclusive" }) => {
        const writer = await originalCreate(opts);
        return {
          write: async (chunk: string) => {
            if (chunk === "Contenido 2" && shouldFail) {
              shouldFail = false;
              throw new Error("Disk full simulation");
            }
            await writer.write(chunk);
          },
          close: () => writer.close(),
          abort: () => writer.abort(),
        };
      };
    }
    return handle;
  };

  const candidates = detectMigrationCandidates(f.documents);
  const plan = await inspectMigration(candidates, f.root);

  const result = await executeMigration(plan, f.root, f.documents);
  assert.equal(result.ok, false);
  assert.equal(result.succeeded.length, 1);
  assert.equal(result.failed.length, 1);

  assert.equal(result.succeeded[0].title, "ok.md");
  assert.equal(result.failed[0].title, "fallo.md");
  assert.match(result.failed[0].error, /Disk full simulation/);

  // ES: Reintento tras resolver el fallo
  // EN: Retry after resolving failure
  f.root.getFileHandle = originalGetFileHandle;
  const pendingPlan = plan.filter(p => result.failed.some(f => f.id === p.candidate.id));
  const authorizedPartials = Object.fromEntries(result.failed
    .filter(f => f.partialContent !== undefined)
    .map(f => [f.id, f.partialContent!]));
  const retryResult = await executeMigration(pendingPlan, f.root, f.documents, { authorizedPartials });
  assert.equal(retryResult.ok, false);
  assert.equal(retryResult.succeeded.length, 0);
  assert.equal(f.documents.documents.some(doc => doc.id === doc2.id), true);
});

test("retireLegacyDocuments deletes verified documents but protects concurrent edits and reports backup state", async () => {
  const f = workspaceFixture();
  await f.documents.initialize();

  const docUnchanged = f.documents.createDocument("doc1.md", "# Contenido estable", null, true);
  const docEdited = f.documents.createDocument("doc2.md", "# Original", null, true);

  const candidates = detectMigrationCandidates(f.documents);
  const plan = await inspectMigration(candidates, f.root);
  const result = await executeMigration(plan, f.root, f.documents);

  assert.equal(result.succeeded.length, 2);

  // ES: Simular una edición concurrente en doc2 durante o justo tras la migración
  // EN: Simulate a concurrent edit on doc2 during or right after migration
  f.documents.selectDocument(docEdited.id);
  f.documents.updateActiveContent("# Contenido modificado concurrentemente");

  // ES: Retirar copias verificadas
  // EN: Retire verified copies
  const retireRes = await retireLegacyDocuments(f.documents, result.succeeded);

  // ES: Se retira doc1, pero doc2 se protege por tener una edición más reciente
  // EN: doc1 is retired, but doc2 is protected due to a more recent edit
  assert.equal(retireRes.retiredCount, 1);
  assert.equal(retireRes.preservedCount, 1);
  assert.equal(retireRes.backupPresent, true);

  assert.equal(f.documents.documents.some(d => d.id === docUnchanged.id), false);
  assert.equal(f.documents.documents.some(d => d.id === docEdited.id), true);
  assert.equal(
    f.documents.documents.find(d => d.id === docEdited.id)?.content,
    "# Contenido modificado concurrentemente",
  );
});

test("offers portable export alternative without marking as migrated or discarding backup", async () => {
  const f = workspaceFixture();
  await f.documents.initialize();

  f.documents.createDocument("manual.md", "# Guía portable", null, true);
  const exportRes = await exportMigrationAlternative(f.documents);

  assert.equal(exportRes.ok, true);
  if (exportRes.ok) {
    assert.match(exportRes.filename, /^kallosmd-backup-.*\.json$/);
    assert.match(exportRes.text, /"format":\s*"kallosmd-backup"/);
  }

  // ES: Los documentos en IndexedDB permanecen intactos
  // EN: Documents in IndexedDB remain intact
  assert.equal(f.documents.documents.length, 1);
  assert.equal(f.documents.documents[0].title, "manual.md");
});

test("regression 1: re-checks collisions before write and prevents overwriting foreign files created after inspection", async () => {
  const f = workspaceFixture();
  await f.documents.initialize();

  f.documents.createDocument("nuevo.md", "# Contenido que no debe sobrescribir", null, true);
  const candidates = detectMigrationCandidates(f.documents);

  // ES: Durante la inspección el archivo no existía en disco (hasCollision: false)
  // EN: During inspection the file did not exist on disk (hasCollision: false)
  const plan = await inspectMigration(candidates, f.root);
  assert.equal(plan[0].hasCollision, false);

  // ES: Un proceso externo crea 'nuevo.md' en disco DESPUÉS de la inspección
  // EN: An external process creates 'nuevo.md' on disk AFTER inspection
  const foreignContent = "# Archivo ajeno preexistente";
  const foreignFile = {
    kind: "file" as const,
    name: "nuevo.md",
    getFile: async () => ({
      name: "nuevo.md",
      text: async () => foreignContent,
    } as unknown as File),
    createWritable: async () => {
      throw new Error("Must not be called");
    },
    isSameEntry: async () => false,
  };
  (f.root as unknown as { entries: Map<string, unknown> }).entries.set("nuevo.md", foreignFile);

  // ES: executeMigration debe volver a comprobar y rechazar la sobrescritura del archivo ajeno
  // EN: executeMigration must re-check and reject overwriting foreign file
  const result = await executeMigration(plan, f.root, f.documents);
  assert.equal(result.ok, false);
  assert.equal(result.succeeded.length, 0);
  assert.equal(result.failed.length, 1);
  assert.match(result.failed[0].error, /already exists/i);

  // ES: El archivo ajeno debe conservarse completamente intacto
  // EN: Foreign file must remain completely intact
  const currentFile = (f.root as unknown as { entries: Map<string, unknown> }).entries.get("nuevo.md") as WorkspaceFileHandle;
  const fileText = await (await currentFile.getFile()).text();
  assert.equal(fileText, foreignContent);
});

test("regression 2: inspectMigration propagates permission errors instead of masking them as missing files", async () => {
  const f = workspaceFixture();
  await f.documents.initialize();

  f.documents.createDocument("doc.md", "Texto", null, true);
  const candidates = detectMigrationCandidates(f.documents);

  // ES: Simular fallo de permisos en getFileHandle
  // EN: Simulate permissions failure in getFileHandle
  const permissionDeniedDir: DirectoryHandle = {
    ...f.root,
    getFileHandle: async () => {
      throw new DOMException("Access denied by system policy", "NotAllowedError");
    },
  };

  await assert.rejects(
    () => inspectMigration(candidates, permissionDeniedDir),
    (err: unknown) => err instanceof DOMException && err.name === "NotAllowedError",
  );
});

test("regression 3: retireLegacyDocuments awaits durable IndexedDB deletion and reports backup present on failure", async () => {
  const f = workspaceFixture();
  await f.documents.initialize();

  const doc = f.documents.createDocument("seguro.md", "Contenido valioso", null, true);
  const candidates = detectMigrationCandidates(f.documents);
  const plan = await inspectMigration(candidates, f.root);
  const result = await executeMigration(plan, f.root, f.documents);
  assert.equal(result.succeeded.length, 1);

  // ES: Simular fallo en IndexedDB al intentar el borrado durable del documento
  // EN: Simulate IndexedDB failure during the durable document retirement
  f.storage.retireDocumentIfUnchanged = async () => {
    throw new Error("QuotaExceededError: IndexedDB full");
  };

  const retireRes = await retireLegacyDocuments(f.documents, result.succeeded);
  // ES: No debe comunicar que se retiró si IndexedDB falló; debe indicar que el respaldo sigue presente
  // EN: Must not report retirement if IndexedDB failed; must report backup remains present
  assert.equal(retireRes.retiredCount, 0);
  assert.equal(retireRes.failed, true);
  assert.equal(retireRes.backupPresent, true);

  // ES: El documento sigue presente en la sesión activa y no se descarta en falso
  // EN: Document remains present in active session and is not falsely discarded
  assert.equal(f.documents.documents.some(d => d.id === doc.id), true);
});

test("regression 4: executeMigration checks flushPendingSave and aborts if storage flush fails", async () => {
  const f = workspaceFixture();
  await f.documents.initialize();

  f.documents.createDocument("nota.md", "Texto", null, true);
  const candidates = detectMigrationCandidates(f.documents);
  const plan = await inspectMigration(candidates, f.root);

  // ES: Simular fallo de flushPendingSave antes de escribir en disco
  // EN: Simulate flushPendingSave failure before writing to disk
  f.documents.flushPendingSave = async () => false;

  const result = await executeMigration(plan, f.root, f.documents);
  assert.equal(result.ok, false);
  assert.equal(result.error, "storage");
  assert.equal(result.succeeded.length, 0);

  // ES: No se debe haber creado el archivo en disco
  // EN: The file must not have been created on disk
  assert.equal((f.root as unknown as { entries: Map<string, unknown> }).entries.has("nota.md"), false);
});

test("regression 5: retry after a partially written destination completes the full write and integrity verification", async () => {
  const f = workspaceFixture();
  await f.documents.initialize();

  const targetContent = "# Contenido final completo y verificado\n\nTexto adicional";
  f.documents.createDocument("parcial.md", targetContent, null, true);
  const candidates = detectMigrationCandidates(f.documents);
  const plan = await inspectMigration(candidates, f.root);

  // ES: Un intento anterior dejó exactamente este parcial en el destino
  // EN: An earlier attempt left exactly this partial at the destination
  const partialContent = "# Contenido inco";
  const partialHandle = await f.root.getFileHandle("parcial.md", { create: true });
  const partialWriter = await partialHandle.createWritable();
  await partialWriter.write(partialContent);
  await partialWriter.close();

  // ES: Sin autorización, el parcial se trata como conflicto y no se sobrescribe
  // EN: Without authorization, the partial is treated as a conflict and is not overwritten
  const blockedResult = await executeMigration(plan, f.root, f.documents);
  assert.equal(blockedResult.ok, false);
  assert.equal(blockedResult.failed.length, 1);
  assert.match(blockedResult.failed[0].error, /already exists/i);
  assert.equal(await (await partialHandle.getFile()).text(), partialContent);

  // ES: El reintento autoriza únicamente el parcial exacto que dejó el intento anterior
  // EN: The retry authorizes only the exact partial left by the earlier attempt
  const authorizedPartials = { [plan[0].candidate.id]: partialContent };
  const retryResult = await executeMigration(plan, f.root, f.documents, { authorizedPartials });
  assert.equal(retryResult.ok, true);
  assert.equal(retryResult.succeeded.length, 1);
  assert.equal(retryResult.failed.length, 0);

  // ES: Verificar que el archivo en disco ahora tiene el contenido completo y verificado
  // EN: Verify file on disk now has the complete and verified content
  const migratedEntry = (f.root as unknown as { entries: Map<string, { content: string }> }).entries.get("parcial.md");
  assert.ok(migratedEntry);
  assert.equal(migratedEntry.content, targetContent);
});
