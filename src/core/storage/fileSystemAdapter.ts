/**
 * ES: Escritura explícita de archivos con detección de cambios externos y cierre confirmado.
 * EN: Explicit file writes with external-change detection and confirmed stream closure.
 */
import type { SaveFileHandle } from "../types";

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
