/**
 * ES: Escritura y verificación de archivos de migración: stream exclusivo, comprobación de integridad
 * y conservación del origen hasta confirmar el resultado.
 * EN: Migration file writing and verification: exclusive stream, integrity check, and preservation
 * of the source until the result is confirmed.
 */
import type { DirectoryHandle, WorkspaceFileHandle } from "../../core/storage/workspacePort";

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
