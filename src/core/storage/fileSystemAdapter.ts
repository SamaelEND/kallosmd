/**
 * ES: Escritura explícita de archivos con detección de cambios externos y cierre confirmado.
 * EN: Explicit file writes with external-change detection and confirmed stream closure.
 */
import type { SaveFileHandle } from "../types";
import type { DirectoryHandle, WorkspaceEntry } from "./workspacePort";
import { getDraftKey } from "./documentRecords";

/** ES: Detecta el selector real sin inferir soporte por el navegador.
 * EN: Detects the actual picker without inferring support from browser identity. */
export function pickWorkspaceDirectory(): Promise<DirectoryHandle> | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & {
    showDirectoryPicker?: (options: object) => Promise<DirectoryHandle>;
  };
  return typeof host.showDirectoryPicker === "function"
    ? host.showDirectoryPicker({ id: "kallosmd-workspace", mode: "read" }) : null;
}

export function supportsWorkspaceDirectory(): boolean {
  return typeof window !== "undefined" && typeof (window as Window & {
    showDirectoryPicker?: unknown;
  }).showDirectoryPicker === "function";
}

/** ES: Solo admite rutas relativas de segmentos inequívocos, también para recursos locales.
 * EN: Accepts only unambiguous relative path segments, including local resources. */
export function workspacePathParts(path: string): string[] {
  getDraftKey({ kind: "file", workspaceId: "validation", path });
  return path.split("/");
}

export async function directoryAt(root: DirectoryHandle, path: string): Promise<DirectoryHandle> {
  let directory = root;
  for (const name of path ? workspacePathParts(path) : []) {
    directory = await directory.getDirectoryHandle(name);
  }
  return directory;
}

/** ES: Enumerar solo obtiene nombres y tipos; nunca lee textos ni recursos.
 * EN: Enumeration obtains names and kinds only, never reading text or resources. */
export async function listWorkspaceDirectory(root: DirectoryHandle, path: string): Promise<WorkspaceEntry[]> {
  const directory = await directoryAt(root, path);
  const entries: WorkspaceEntry[] = [];
  for await (const entry of directory.values()) {
    const entryPath = path ? `${path}/${entry.name}` : entry.name;
    workspacePathParts(entryPath);
    entries.push({ kind: entry.kind, name: entry.name, path: entryPath });
  }
  return entries.sort((a, b) => Number(b.kind === "directory") - Number(a.kind === "directory")
    || a.name.localeCompare(b.name));
}

/** ES: Enumera únicamente carpetas para elegir un destino, sin leer contenidos.
 * EN: Enumerates folders only to choose a destination, without reading contents. */
export async function listWorkspaceDirectories(root: DirectoryHandle, path = ""): Promise<string[]> {
  const directories: string[] = [];
  const pending = [path];
  while (pending.length) {
    const current = pending.shift()!;
    for (const entry of await listWorkspaceDirectory(root, current)) {
      if (entry.kind !== "directory") continue;
      directories.push(entry.path);
      pending.push(entry.path);
    }
  }
  return directories;
}

export class FileConflictError extends Error {
  constructor() {
    super("The file changed externally");
    this.name = "FileConflictError";
  }
}

export function pickSaveFile(title: string): Promise<SaveFileHandle> | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & {
    showSaveFilePicker?: (options: object) => Promise<SaveFileHandle>;
  };
  if (typeof host.showSaveFilePicker !== "function") return null;
  return host.showSaveFilePicker({
    suggestedName: title,
    types: [{ description: "Markdown", accept: { "text/markdown": [".md"] } }],
  });
}

export async function writeFileSnapshot(
  handle: SaveFileHandle, content: string, confirmedContent: string | null,
): Promise<void> {
  const before = await (await handle.getFile()).text();
  if (confirmedContent !== null && before !== confirmedContent) throw new FileConflictError();
  const writer = await handle.createWritable({ mode: "exclusive" });
  let closed = false;
  try {
    if (await (await handle.getFile()).text() !== before) throw new FileConflictError();
    await writer.write(content);
    // ES: La API no ofrece compare-and-swap; se compara antes y después del cierre.
    // EN: The API has no compare-and-swap; compare before and after closing.
    if (await (await handle.getFile()).text() !== before) throw new FileConflictError();
    await writer.close();
    closed = true;
    if (await (await handle.getFile()).text() !== content) throw new FileConflictError();
  } finally {
    // ES: Un fallo al abortar no debe ocultar el error que impidió guardar.
    // EN: An abort failure must not mask the error that prevented saving.
    if (!closed) await writer.abort().catch(() => {});
  }
}
