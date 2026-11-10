/**
 * ES: Operaciones estructurales en disco (renombrar, mover, borrar y crear carpetas) con validación portable y capacidades nativas explícitas.
 * EN: Structural disk operations (rename, move, delete, and create folders) with portable validation and explicit native capabilities.
 */
import { directoryAt, workspacePathParts } from "./fileSystemAdapter";
import type { DirectoryHandle, WorkspaceFileHandle } from "./workspacePort";

export class EntryCollisionError extends Error {
  constructor(message = "An entry with that name already exists") {
    super(message);
    this.name = "EntryCollisionError";
  }
}

export class FolderCollisionError extends EntryCollisionError {}

export class UnsupportedCapabilityError extends Error {
  constructor(message = "The requested file system operation is not supported") {
    super(message);
    this.name = "UnsupportedCapabilityError";
  }
}

export class InvalidMoveError extends Error {
  constructor(message = "Cannot move a directory into itself or a subfolder") {
    super(message);
    this.name = "InvalidMoveError";
  }
}

/**
 * ES: No recorta ni transforma nombres; rechaza rutas y nombres no portables.
 * EN: Does not trim or transform names; rejects paths and non-portable names.
 */
export function isValidEntryName(name: string): boolean {
  return name.length > 0 && name.length <= 255 && name === name.trim()
    && !/[<>:"/\\|?*\x00-\x1f]/.test(name) && !/[. ]$/.test(name)
    && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name);
}

export const isValidFolderName = isValidEntryName;

/**
 * ES: Divide una ruta de espacio de trabajo en ruta de directorio padre y nombre base.
 * EN: Splits a workspace path into parent directory path and base name.
 */
export function splitWorkspacePath(path: string): { parentPath: string; name: string } {
  if (!path) return { parentPath: "", name: "" };
  const parts = workspacePathParts(path);
  const name = parts.pop()!;
  return { parentPath: parts.join("/"), name };
}

/**
 * ES: Creación explícita de una carpeta en disco evitando colisiones.
 * EN: Explicit creation of a folder on disk preventing collisions.
 */
export async function createWorkspaceFolder(
  root: DirectoryHandle, parentPath: string, name: string,
): Promise<DirectoryHandle> {
  if (!isValidEntryName(name)) throw new TypeError("Invalid folder name");
  const parent = await directoryAt(root, parentPath);
  const normalized = name.normalize("NFC").toLowerCase();
  for await (const entry of parent.values()) {
    if (entry.name.normalize("NFC").toLowerCase() === normalized) {
      throw new FolderCollisionError();
    }
  }
  // ES: La API no tiene creación exclusiva de carpetas; una coincidencia concurrente nunca se vacía.
  // EN: The API has no exclusive directory creation; a concurrent matching directory is never emptied.
  return parent.getDirectoryHandle(name, { create: true });
}

/**
 * ES: Crea un archivo nuevo evitando reemplazar una entrada existente del mismo directorio.
 * EN: Creates a new file without replacing an existing entry in the same directory.
 */
export async function createWorkspaceFile(
  root: DirectoryHandle, parentPath: string, name: string,
): Promise<WorkspaceFileHandle> {
  if (!isValidEntryName(name)) throw new TypeError("Invalid file name");
  const parent = await directoryAt(root, parentPath);
  const normalized = name.normalize("NFC").toLowerCase();
  for await (const entry of parent.values()) {
    if (entry.name.normalize("NFC").toLowerCase() === normalized) {
      throw new EntryCollisionError();
    }
  }
  // ES: La API no ofrece creación exclusiva; la comprobación previa evita sobrescrituras normales.
  // EN: The API has no exclusive creation; the previous check prevents normal overwrites.
  return parent.getFileHandle(name, { create: true });
}

/**
 * ES: Renombra un archivo o carpeta en disco validando colisiones en el mismo directorio.
 * EN: Renames a file or folder on disk validating collisions in the same directory.
 */
export async function renameWorkspaceEntry(
  root: DirectoryHandle, path: string, newName: string,
): Promise<DirectoryHandle | WorkspaceFileHandle> {
  if (!path) throw new TypeError("Cannot rename workspace root");
  if (!isValidEntryName(newName)) throw new TypeError("Invalid entry name");
  const { parentPath, name: oldName } = splitWorkspacePath(path);
  const parent = await directoryAt(root, parentPath);
  const normalizedNew = newName.normalize("NFC").toLowerCase();
  let target: DirectoryHandle | WorkspaceFileHandle | null = null;
  for await (const entry of parent.values()) {
    if (entry.name === oldName) target = entry;
    else if (entry.name.normalize("NFC").toLowerCase() === normalizedNew) throw new EntryCollisionError();
  }
  if (!target) throw new Error("Entry not found");
  if (oldName === newName) return target;

  if (typeof target.move === "function") {
    // ES: La comprobación de nombres no es atómica frente a procesos externos; la API no ofrece no-replace.
    // EN: The name check is not atomic against external processes; the API has no no-replace option.
    await target.move(newName);
    return target;
  }
  throw new UnsupportedCapabilityError("Native renaming is not supported by this environment");
}

/**
 * ES: Mueve un archivo o carpeta a otro directorio en disco comprobando jerarquías y colisiones.
 * EN: Moves a file or folder to another directory on disk checking hierarchies and collisions.
 */
export async function moveWorkspaceEntry(
  root: DirectoryHandle, sourcePath: string, targetParentPath: string, newName?: string,
): Promise<DirectoryHandle | WorkspaceFileHandle> {
  if (!sourcePath) throw new TypeError("Cannot move workspace root");
  const { parentPath: sourceParentPath, name: sourceName } = splitWorkspacePath(sourcePath);
  const finalName = newName ?? sourceName;
  if (!isValidEntryName(finalName)) throw new TypeError("Invalid target name");

  const sourceParent = await directoryAt(root, sourceParentPath);
  let sourceEntry: DirectoryHandle | WorkspaceFileHandle | null = null;
  for await (const entry of sourceParent.values()) {
    if (entry.name === sourceName) { sourceEntry = entry; break; }
  }
  if (!sourceEntry) throw new Error("Source entry not found");

  if (sourceEntry.kind === "directory") {
    if (targetParentPath === sourcePath || targetParentPath.startsWith(sourcePath + "/")) {
      throw new InvalidMoveError();
    }
  }

  const targetParent = await directoryAt(root, targetParentPath);
  const normalizedFinal = finalName.normalize("NFC").toLowerCase();
  for await (const entry of targetParent.values()) {
    if (entry.name.normalize("NFC").toLowerCase() === normalizedFinal) {
      if (sourceParentPath === targetParentPath && sourceName === finalName) return sourceEntry;
      throw new EntryCollisionError();
    }
  }

  if (typeof sourceEntry.move === "function") {
    // ES: El movimiento nativo conserva bytes; no promete exclusión de procesos externos entre comprobaciones.
    // EN: Native movement preserves bytes; it does not promise exclusion of external processes between checks.
    await sourceEntry.move(targetParent, finalName);
    return sourceEntry;
  }

  // ES: Copiar y borrar no ofrece creación exclusiva ni protección frente a escritores externos.
  // EN: Copy/delete offers neither exclusive creation nor protection against external writers.

  throw new UnsupportedCapabilityError("Native moving is not supported by this environment");
}

/**
 * ES: Elimina un archivo o carpeta del disco de forma explícita.
 * EN: Explicitly removes a file or folder from disk.
 */
export async function deleteWorkspaceEntry(root: DirectoryHandle, path: string): Promise<void> {
  if (!path) throw new TypeError("Cannot delete workspace root");
  const { parentPath, name } = splitWorkspacePath(path);
  const parent = await directoryAt(root, parentPath);
  if (!parent.removeEntry) throw new UnsupportedCapabilityError();

  let targetKind: "file" | "directory" | null = null;
  for await (const entry of parent.values()) {
    if (entry.name === name) { targetKind = entry.kind; break; }
  }
  if (!targetKind) throw new Error("Entry not found");
  await parent.removeEntry(name, { recursive: targetKind === "directory" });
}
