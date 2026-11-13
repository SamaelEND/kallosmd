/**
 * ES: Servicio de migración de documentos locales anteriores a una carpeta de trabajo en disco.
 * La migración solo se inicia por acción explícita del usuario, nunca de forma automática.
 *
 * EN: Migration service for legacy local documents into a disk workspace directory.
 * Migration is only triggered by explicit user action, never automatically.
 */
import type { DocumentItem } from "../../core/types";
import type { DirectoryHandle } from "../../core/storage/workspacePort";
import type { RetireDocumentOutcome } from "../../core/storage/storagePort";
import { directoryAt } from "../../core/storage/fileSystemAdapter";
import {
  EntryCollisionError,
  createWorkspaceFile,
  fileExistsInDirectory,
  isNotFoundError,
  readFileText,
} from "../../core/storage/workspaceOperations";
import { getDraftKey } from "../../core/storage/documentRecords";
import {
  ensureDirectoryHierarchy,
  readHandleText,
  writeAndVerifyHandle,
} from "./migrationFileWriter";
import type { DocumentStore } from "./vaultStore.svelte";
import { exportBackup, type ExportBackupResult } from "./backupService";

export interface MigrationCandidate {
  id: string; title: string; content: string;
  folderId: string | null; folderName: string | null; updatedAt: number;
}

export type CollisionResolution = "ask" | "rename" | "skip" | "overwrite";

export interface MigrationPlanItem {
  candidate: MigrationCandidate;
  targetFolder: string; targetFileName: string; targetPath: string;
  hasCollision: boolean; resolution: CollisionResolution;
  resolvedFileName: string; resolvedPath: string;
  existingContent: string | null;
}

export interface VerifiedMigrationItem {
  id: string; title: string; targetPath: string;
  sourceUpdatedAt: number; sourceContent: string;
}

export interface MigrationFailureItem {
  id: string; title: string; targetPath: string; error: string;
  // ES: Contenido parcial que este intento dejó en disco, solo si el archivo lo creó esta migración.
  // EN: Partial content this attempt left on disk, only when this migration created the file.
  partialContent?: string;
}

export interface MigrationExecutionResult {
  ok: boolean;
  error?: "permission" | "unsupported" | "aborted" | "storage";
  succeeded: VerifiedMigrationItem[];
  failed: MigrationFailureItem[];
  skipped: Array<{ id: string; title: string; reason: string }>;
  pending: MigrationPlanItem[];
}

export interface RetireResult {
  retiredCount: number; preservedCount: number; failed: boolean; backupPresent: boolean;
}

/**
 * ES: Sanitiza un nombre de archivo para el sistema de archivos preservando la extensión .md.
 * EN: Sanitizes a file name for the filesystem preserving the .md extension.
 */
export function sanitizeFileName(rawTitle: string): string {
  let name = rawTitle.trim();
  if (!name.toLowerCase().endsWith(".md")) name = `${name}.md`;
  name = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").replace(/\.+$/, "");
  return (!name || name === ".md") ? "documento.md" : name;
}

export function sanitizeFolderName(folderName: string | null): string {
  if (!folderName) return "";
  const clean = folderName.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").replace(/\.+$/, "");
  return clean || "carpeta";
}

export function detectMigrationCandidates(store: DocumentStore): MigrationCandidate[] {
  const candidates: MigrationCandidate[] = [];
  const foldersMap = new Map(store.folders.map(f => [f.id, f.name]));
  for (const doc of store.documents) {
    if (store.isWorkspaceDocument(doc.id)) continue;
    candidates.push({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      folderId: doc.folderId ?? null,
      folderName: doc.folderId ? (foldersMap.get(doc.folderId) ?? null) : null,
      updatedAt: doc.updatedAt,
    });
  }
  return candidates;
}

export function candidateForFolderDrop(store: DocumentStore, docId: string): MigrationCandidate | null {
  const candidate = detectMigrationCandidates(store).find((doc) => doc.id === docId);
  return candidate ? { ...candidate, folderId: null, folderName: null } : null;
}

export function isPermissionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { name?: string; message?: string };
  return err.name === "NotAllowedError" || err.name === "SecurityError" || Boolean(err.message && /permission|denied|not\s*allowed/i.test(err.message));
}

/**
 * ES: Inspecciona la migración evaluando organización disponible y colisiones antes de escribir.
 * EN: Inspects migration evaluating available organization and collisions before writing.
 */
export async function inspectMigration(
  candidates: MigrationCandidate[],
  targetDirectory: DirectoryHandle,
): Promise<MigrationPlanItem[]> {
  const plan: MigrationPlanItem[] = [];
  const usedPaths = new Set<string>();

  for (const candidate of candidates) {
    const targetFolder = sanitizeFolderName(candidate.folderName);
    const targetFileName = sanitizeFileName(candidate.title);
    const targetPath = targetFolder ? `${targetFolder}/${targetFileName}` : targetFileName;

    let parentDir: DirectoryHandle = targetDirectory;
    let hasCollision = false;
    let existingContent: string | null = null;

    try {
      if (targetFolder) {
        parentDir = await directoryAt(targetDirectory, targetFolder);
      }
      hasCollision = await fileExistsInDirectory(parentDir, targetFileName);
      if (hasCollision) existingContent = await readFileText(parentDir, targetFileName);
    } catch (error: unknown) {
      if (isNotFoundError(error)) {
        // ES: Si la subcarpeta aún no existe en disco, no hay colisión previa allí
        // EN: If subfolder does not exist yet on disk, there is no prior collision there
        hasCollision = false;
      } else {
        // ES: Si hay un error de permisos o I/O, no enmascararlo como inexistente
        // EN: If there is a permissions or I/O error, do not mask it as non-existent
        throw error;
      }
    }

    if (usedPaths.has(targetPath.toLowerCase())) {
      hasCollision = true;
    }

    // ES: Por defecto, resolver colisiones mediante renombrado para no sobrescribir en silencio
    // EN: By default, resolve collisions through renaming to avoid silent overwrites
    let resolvedFileName = targetFileName;
    let resolvedPath = targetPath;

    if (hasCollision) {
      const dotIndex = targetFileName.lastIndexOf(".");
      const baseName = dotIndex !== -1 ? targetFileName.slice(0, dotIndex) : targetFileName;
      const ext = dotIndex !== -1 ? targetFileName.slice(dotIndex) : ".md";
      let suffix = 1;

      while (true) {
        const candidateName = `${baseName} (${suffix})${ext}`;
        const candidatePath = targetFolder ? `${targetFolder}/${candidateName}` : candidateName;
        const existsInDisk = await fileExistsInDirectory(parentDir, candidateName);
        if (!existsInDisk && !usedPaths.has(candidatePath.toLowerCase())) {
          resolvedFileName = candidateName;
          resolvedPath = candidatePath;
          break;
        }
        suffix++;
      }
    }

    usedPaths.add(resolvedPath.toLowerCase());

    plan.push({
      candidate,
      targetFolder,
      targetFileName,
      targetPath,
      hasCollision,
      resolution: hasCollision ? "ask" : "rename",
      resolvedFileName,
      resolvedPath,
      existingContent,
    });
  }

  return plan;
}

export interface MigrationOptions {
  signal?: { aborted: boolean };
  // ES: Contenido parcial exacto que esta migración dejó en disco por candidato; solo eso puede sustituirse.
  // EN: Exact partial content this migration left on disk per candidate; only that may be replaced.
  authorizedPartials?: Record<string, string>;
}

/**
 * ES: Ejecuta el plan de migración escribiendo y verificando cada archivo en disco.
 * No descarta los documentos de IndexedDB; se conservan como respaldo.
 *
 * EN: Executes the migration plan writing and verifying each file to disk.
 * Does not discard IndexedDB documents; they are preserved as backup.
 */
export async function executeMigration(
  plan: MigrationPlanItem[],
  targetDirectory: DirectoryHandle,
  store: DocumentStore,
  options?: MigrationOptions | { aborted: boolean },
): Promise<MigrationExecutionResult> {
  const signal = options && "aborted" in options ? options : (options as MigrationOptions)?.signal;
  const authorizedPartials = (options && "authorizedPartials" in options && options.authorizedPartials) || {};

  // ES: Verificar permisos de escritura en la carpeta destino
  // EN: Verify write permissions in target directory
  if (typeof targetDirectory.requestPermission === "function") {
    let perm: PermissionState = "prompt";
    try {
      perm = await targetDirectory.requestPermission({ mode: "readwrite" });
    } catch {
      perm = "prompt";
    }
    if (perm !== "granted") {
      return {
        ok: false,
        error: "permission",
        succeeded: [],
        failed: [],
        skipped: [],
        pending: [...plan],
      };
    }
  }

  // ES: Asegurar que los borradores pendientes de IndexedDB estén protegidos; abortar si falla el volcado
  // EN: Ensure pending IndexedDB drafts are protected; abort if flush fails
  const flushed = await store.flushPendingSave();
  if (!flushed) {
    return {
      ok: false,
      error: "storage",
      succeeded: [],
      failed: [],
      skipped: [],
      pending: [...plan],
    };
  }

  const succeeded: VerifiedMigrationItem[] = [];
  const failed: MigrationFailureItem[] = [];
  const skipped: Array<{ id: string; title: string; reason: string }> = [];
  const pending: MigrationPlanItem[] = [];

  for (let i = 0; i < plan.length; i++) {
    const item = plan[i];

    if (signal?.aborted) {
      pending.push(...plan.slice(i));
      break;
    }

    if (item.resolution === "skip") {
      skipped.push({
        id: item.candidate.id,
        title: item.candidate.title,
        reason: "Omitido por el usuario",
      });
      continue;
    }
    if (item.resolution === "ask") {
      failed.push({
        id: item.candidate.id,
        title: item.candidate.title,
        targetPath: item.targetPath,
        error: "Destination conflict requires an explicit choice",
      });
      continue;
    }

    const finalFileName = item.resolution === "rename" ? item.resolvedFileName : item.targetFileName;
    const finalPath = item.resolution === "rename" ? item.resolvedPath : item.targetPath;
    const authorizedPartial = authorizedPartials[item.candidate.id];
    let parentDir: DirectoryHandle = targetDirectory;
    let ownsDestination = false;

    try {
      parentDir = await ensureDirectoryHierarchy(targetDirectory, item.targetFolder);

      // ES: Volver a comprobar colisiones en destino antes de escribir para no sobrescribir archivos ajenos
      // EN: Re-check destination collisions before writing to prevent overwriting foreign files
      const destinationExists = await fileExistsInDirectory(parentDir, finalFileName);

      if (item.resolution === "overwrite") {
        // ES: Solo reemplazar el archivo inspeccionado si todavía tiene el mismo contenido.
        // EN: Only replace the inspected file if its content is still unchanged.
        if (!item.hasCollision || item.existingContent === null || !destinationExists) {
          throw new EntryCollisionError(`Destination changed: "${finalPath}"`);
        }
        const fileHandle = await parentDir.getFileHandle(finalFileName, { create: false });
        if (await readHandleText(fileHandle) !== item.existingContent) {
          throw new EntryCollisionError(`Destination changed: "${finalPath}"`);
        }
        ownsDestination = true;
        await writeAndVerifyHandle(fileHandle, item.candidate.content);
      } else if (destinationExists) {
        // ES: Un parcial vacío no demuestra pertenencia: un archivo ajeno vacío también lo sería.
        // EN: An empty partial does not prove ownership: a foreign empty file would look identical.
        if (!authorizedPartial) {
          throw new EntryCollisionError(`Destination file already exists: "${finalPath}"`);
        }
        // ES: Solo se sustituye si el archivo actual sigue siendo exactamente el parcial de este intento
        // EN: Only replace when the current file is still exactly this attempt's partial write
        const fileHandle = await parentDir.getFileHandle(finalFileName, { create: false });
        if (await readHandleText(fileHandle) !== authorizedPartial) {
          throw new EntryCollisionError(`Destination file already exists: "${finalPath}"`);
        }
        ownsDestination = true;
        await writeAndVerifyHandle(fileHandle, item.candidate.content);
      } else {
        // ES: Usa la misma creación comprobada del primer guardado; algunos proveedores móviles
        // rechazan las sondas y el renombrado nativo aunque admiten crear el archivo directamente.
        // EN: Use the same checked creation as first save; some mobile providers reject native
        // move probes and renames even though direct file creation works.
        const handle = await createWorkspaceFile(parentDir, "", finalFileName);
        ownsDestination = true;
        await writeAndVerifyHandle(handle, item.candidate.content);
      }

      succeeded.push({
        id: item.candidate.id,
        title: item.candidate.title,
        targetPath: finalPath,
        sourceUpdatedAt: item.candidate.updatedAt,
        sourceContent: item.candidate.content,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Error de escritura o verificación";
      const partialContent = ownsDestination
        ? await readFileText(parentDir, finalFileName).catch(() => null)
        : null;
      failed.push({
        id: item.candidate.id,
        title: item.candidate.title,
        targetPath: finalPath,
        error: errorMsg,
        ...(partialContent !== null ? { partialContent } : {}),
      });
    }
  }

  return {
    ok: failed.length === 0 && !signal?.aborted,
    error: signal?.aborted ? "aborted" : undefined,
    succeeded,
    failed,
    skipped,
    pending,
  };
}

/**
 * ES: Retira los documentos anteriores de IndexedDB únicamente tras confirmación explícita.
 * Protege ediciones concurrentes ocurridas durante la migración (no elimina versiones más recientes).
 *
 * EN: Retires legacy documents from IndexedDB only after explicit confirmation.
 * Protects concurrent edits occurred during migration (never deletes more recent versions).
 */
export async function retireLegacyDocuments(
  store: DocumentStore,
  verifiedItems: VerifiedMigrationItem[],
): Promise<RetireResult> {
  let retiredCount = 0;
  let preservedCount = 0;
  let hadFailure = false;

  const flushed = await store.flushPendingSave();
  if (!flushed) {
    return {
      retiredCount: 0,
      preservedCount: verifiedItems.length,
      failed: true,
      backupPresent: true,
    };
  }

  for (const item of verifiedItems) {
    const currentDoc = store.documents.find(d => d.id === item.id);
    if (!currentDoc) {
      continue;
    }

    // ES: Si el documento fue editado durante la migración, conservarlo intacto
    // EN: If the document was edited during migration, keep it intact
    if (currentDoc.content !== item.sourceContent || currentDoc.updatedAt > item.sourceUpdatedAt) {
      preservedCount++;
      continue;
    }

    const version = store.versions[item.id];
    const draftKey = version
      ? getDraftKey(version.identity)
      : getDraftKey({ kind: "local", id: item.id });

    let outcome: RetireDocumentOutcome;
    try {
      // ES: Borrado durable y condicional: si documento o borrador ya contienen una versión posterior, no se toca nada
      // EN: Durable conditional deletion: if document or draft already hold a later version, nothing is touched
      outcome = await store.storage.retireDocumentIfUnchanged(item.id, draftKey, {
        content: item.sourceContent,
        updatedAt: item.sourceUpdatedAt,
      });
    } catch {
      hadFailure = true;
      continue;
    }

    if (outcome === "edited") {
      preservedCount++;
      continue;
    }
    if (outcome === "missing") {
      // ES: Sin copia durable verificable no se elimina la sesión: el respaldo podría ser la única copia
      // EN: Without a verifiable durable copy the session is kept: the backup may be the only copy
      hadFailure = true;
      preservedCount++;
      continue;
    }

    // ES: Volver a comprobar la versión tras la espera durable; una edición en esa ventana se restaura
    // EN: Re-check the version after the durable wait; an edit in that window is restored
    const after = store.documents.find(d => d.id === item.id);
    if (!after) {
      retiredCount++;
      continue;
    }
    if (after.content !== item.sourceContent || after.updatedAt > item.sourceUpdatedAt) {
      try {
        await store.storage.saveDocument({ ...after });
        const restored = await store.flushPendingSave();
        if (!restored) hadFailure = true;
      } catch {
        hadFailure = true;
      }
      preservedCount++;
      continue;
    }

    // ES: Retirar de la sesión activa una vez que el borrado durable fue exitoso
    // EN: Retire from active session once durable deletion succeeded
    store.deleteDocument(item.id);
    retiredCount++;
  }

  return {
    retiredCount,
    preservedCount,
    failed: hadFailure,
    backupPresent: hadFailure || preservedCount > 0,
  };
}

/**
 * ES: Ofrece una exportación portable como alternativa cuando no hay escritura directa en disco.
 * No marca los documentos como migrados ni descarta el respaldo en IndexedDB.
 *
 * EN: Offers a portable export as an alternative when direct disk write is unavailable.
 * Does not mark documents as migrated nor discards the IndexedDB backup.
 */
export async function exportMigrationAlternative(
  store: DocumentStore,
): Promise<ExportBackupResult> {
  return exportBackup(store);
}
