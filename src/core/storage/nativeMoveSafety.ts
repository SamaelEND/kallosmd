/**
 * ES: Comprueba en la carpeta elegida si el movimiento nativo rechaza un nombre ocupado.
 * EN: Checks whether native move rejects an occupied name in the selected directory.
 */
import type { DirectoryHandle, WorkspaceFileHandle } from "./workspacePort";

type EntryKind = "file" | "directory";
type MoveForm = "rename" | "move";

export class UnsafeNativeMoveError extends Error {
  constructor() {
    super("Unsafe native move: this filesystem may replace an occupied destination");
    this.name = "UnsafeNativeMoveError";
  }
}

async function writeMarker(file: WorkspaceFileHandle, content: string): Promise<void> {
  const writer = await file.createWritable();
  await writer.write(content);
  await writer.close();
}

async function readMarker(dir: DirectoryHandle, name: string): Promise<string> {
  const file = await dir.getFileHandle(name, { create: false });
  return (await file.getFile()).text();
}

async function createEntry(dir: DirectoryHandle, name: string, kind: EntryKind): Promise<DirectoryHandle | WorkspaceFileHandle> {
  return kind === "file"
    ? dir.getFileHandle(name, { create: true })
    : dir.getDirectoryHandle(name, { create: true });
}

async function markEntry(entry: DirectoryHandle | WorkspaceFileHandle, marker: string): Promise<void> {
  if (entry.kind === "file") await writeMarker(entry, marker);
  else await writeMarker(await entry.getFileHandle("marker", { create: true }), marker);
}

async function entryMarker(dir: DirectoryHandle, name: string, kind: EntryKind): Promise<string> {
  return kind === "file"
    ? readMarker(dir, name)
    : readMarker(await dir.getDirectoryHandle(name, { create: false }), "marker");
}

/**
 * ES: Usa solo entradas temporales propias. Devuelve false si move reemplaza, no está disponible o
 * altera alguna entrada tras rechazar la colisión. Nunca usa documentos del usuario como sonda.
 * EN: Uses only owned temporary entries. Returns false if move replaces, is unavailable, or
 * changes either entry after rejecting a collision. Never probes with user documents.
 */
export async function nativeMoveRejectsCollision(
  parent: DirectoryHandle,
  kind: EntryKind,
  form: MoveForm,
): Promise<boolean> {
  if (!parent.removeEntry) return false;
  const token = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const probeName = `.kallosmd-move-check-${token}`;

  // ES: No limpiar una carpeta que ya existía, incluso si su nombre aleatorio coincidiera.
  // EN: Never clean an existing directory, even if its random name happened to collide.
  try {
    await parent.getDirectoryHandle(probeName, { create: false });
    return false;
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== "NotFoundError") throw error;
  }

  const probe = await parent.getDirectoryHandle(probeName, { create: true });
  try {
    const sourceParent = form === "move" ? await probe.getDirectoryHandle("from", { create: true }) : probe;
    const targetParent = form === "move" ? await probe.getDirectoryHandle("to", { create: true }) : probe;
    const control = await createEntry(sourceParent, "control", kind);
    await markEntry(control, "control");
    if (typeof control.move !== "function") return false;
    try {
      if (form === "rename") await control.move("free");
      else await control.move(targetParent, "free");
      if (await entryMarker(targetParent, "free", kind) !== "control") return false;
    } catch {
      return false;
    }

    const source = await createEntry(sourceParent, "source", kind);
    const target = await createEntry(targetParent, "target", kind);
    await markEntry(source, "source");
    await markEntry(target, "target");

    if (typeof source.move !== "function") return false;
    let rejected = false;
    try {
      if (form === "rename") await source.move("target");
      else await source.move(targetParent, "target");
    } catch {
      rejected = true;
    }
    if (!rejected) return false;

    try {
      return await entryMarker(sourceParent, "source", kind) === "source"
        && await entryMarker(targetParent, "target", kind) === "target";
    } catch {
      return false;
    }
  } finally {
    await parent.removeEntry(probeName, { recursive: true });
  }
}
