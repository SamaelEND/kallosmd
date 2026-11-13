/**
 * ES: Escritura y verificación de archivos de migración: stream exclusivo, comprobación de integridad
 * y creación sin reclamar nunca el nombre final con `create: true`.
 * EN: Migration file writing and verification: exclusive stream, integrity check, and creation without
 * ever claiming the final name with `create: true`.
 */
import type { DirectoryHandle, WorkspaceFileHandle } from "../../core/storage/workspacePort";
import { nativeMoveRejectsCollision, UnsafeNativeMoveError } from "../../core/storage/nativeMoveSafety";
import {
  EntryCollisionError,
  fileExistsInDirectory,
  readFileText,
} from "../../core/storage/workspaceOperations";

/**
 * ES: Crea recursivamente una jerarquía de subdirectorios en el workspace si no existe.
 * EN: Recursively creates a subdirectory hierarchy in workspace if it does not exist.
 */
export async function ensureDirectoryHierarchy(
  root: DirectoryHandle,
  folderPath: string,
): Promise<DirectoryHandle> {
  if (!folderPath) return root;
  const parts = folderPath.split("/").filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}
/**
 * ES: Escribe sobre un handle ya reclamado y verifica inmediatamente su integridad.
 * EN: Writes through an already-claimed handle and immediately verifies its integrity.
 */
export async function writeAndVerifyHandle(
  fileHandle: WorkspaceFileHandle,
  content: string,
): Promise<void> {
  const writer = await fileHandle.createWritable({ mode: "exclusive" });
  try {
    await writer.write(content);
    await writer.close();
  } catch (error) {
    await writer.abort().catch(() => {});
    throw error;
  }

  // ES: Verificación obligatoria de lectura tras escritura
  // EN: Mandatory post-write read verification
  const readBack = await (await fileHandle.getFile()).text();
  if (readBack !== content) {
    throw new Error("Integrity verification failed: written text does not match source");
  }
}

/** ES: Lee el contenido del handle que se va a escribir. EN: Reads the content of the handle about to be written. */
export async function readHandleText(fileHandle: WorkspaceFileHandle): Promise<string> {
  return await (await fileHandle.getFile()).text();
}

/** ES: Detecta un renombrado rechazado porque el destino ya existe. EN: Detects a rename rejected because the destination already exists. */
function isMoveCollisionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { name?: string; message?: string };
  return err.name === "InvalidModificationError"
    || err.name === "NoModificationAllowedError"
    || Boolean(err.message && /already\s*exists|modification|overwrite/i.test(err.message));
}

let tempCounter = 0;

/**
 * ES: Nombre temporal único: el nombre final nunca se reclama con `create: true`, así que un archivo
 * ajeno aparecido en la ventana de carrera jamás se confunde con uno creado por esta migración.
 * EN: Unique temp name: the final name is never claimed with `create: true`, so a foreign file
 * appearing in the race window is never mistaken for one created by this migration.
 */
function migrationTempName(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  const random = typeof cryptoApi?.randomUUID === "function"
    ? cryptoApi.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${(tempCounter++).toString(36)}`;
  return `.kallosmd-migration-${random}.tmp`;
}

/**
 * ES: Exige un movimiento nativo que rechace colisiones; después escribe en un temporal único y
 * lo renombra. Si el backend reemplaza destinos, conserva el origen y ofrece respaldo portable.
 * EN: Requires native move to reject collisions, then writes to a unique temporary file and
 * renames it. If the backend replaces targets, the source remains available for portable backup.
 */
export async function createFileWithoutOverwrite(
  parentDir: DirectoryHandle,
  finalFileName: string,
  content: string,
  onMoved: () => void,
): Promise<void> {
  if (!await nativeMoveRejectsCollision(parentDir, "file", "rename")) {
    throw new UnsafeNativeMoveError();
  }
  const tempName = migrationTempName();
  const tempHandle = await parentDir.getFileHandle(tempName, { create: true });
  let moved = false;
  try {
    await writeAndVerifyHandle(tempHandle, content);

    if (await fileExistsInDirectory(parentDir, finalFileName)) {
      throw new EntryCollisionError(`Destination file already exists: "${finalFileName}"`);
    }
    if (typeof tempHandle.move !== "function") {
      throw new Error("This environment cannot create files without overwriting an existing entry");
    }

    try {
      await tempHandle.move(finalFileName);
      moved = true;
    } catch (error: unknown) {
      if (isMoveCollisionError(error)) {
        throw new EntryCollisionError(`Destination file already exists: "${finalFileName}"`);
      }
      throw error;
    }
    // ES: El archivo final ya es de este intento; un fallo posterior puede reportarse como parcial.
    // EN: The final file now belongs to this attempt; a later failure may be reported as partial.
    onMoved();

    if (await readFileText(parentDir, finalFileName) !== content) {
      throw new Error("Integrity verification failed: written text does not match source");
    }
  } catch (error: unknown) {
    if (!moved && typeof parentDir.removeEntry === "function") {
      await parentDir.removeEntry(tempName).catch(() => {});
    }
    throw error;
  }
}
