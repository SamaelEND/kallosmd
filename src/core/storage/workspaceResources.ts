/**
 * ES: Resolución y lectura bajo demanda de recursos locales relativos al documento en el espacio de trabajo.
 * EN: On-demand resolution and reading of local resources relative to document in workspace.
 */
import type { DirectoryHandle, WorkspaceFileHandle } from "./workspacePort";
import { directoryAt } from "./fileSystemAdapter";
import { UnsupportedCapabilityError } from "./workspaceOperations";

export { UnsupportedCapabilityError };

export class InvalidResourcePathError extends Error {
  constructor(message = "Invalid resource path") {
    super(message);
    this.name = "InvalidResourcePathError";
  }
}

export class ResourceNotFoundError extends Error {
  constructor(message = "Resource not found") {
    super(message);
    this.name = "ResourceNotFoundError";
  }
}

export class PermissionDeniedError extends Error {
  constructor(message = "Permission denied for resource") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

export interface ResolvedResourceRef {
  /** ES: Ruta relativa normalizada en el espacio de trabajo. */
  /** EN: Normalized relative path in workspace. */
  workspaceRelativePath: string;
  /** ES: Nombre del archivo de recurso. */
  /** EN: Resource file name. */
  fileName: string;
  /** ES: Ruta del directorio contenedor dentro del workspace (cadena vacía para la raíz). */
  /** EN: Containing directory path within workspace (empty string for root). */
  parentPath: string;
}

export interface WorkspaceResource {
  /** ES: Ruta relativa en el espacio de trabajo. */
  /** EN: Relative path in workspace. */
  path: string;
  /** ES: Nombre base del archivo de recurso. */
  /** EN: Base name of resource file. */
  name: string;
  /** ES: Tamaño en bytes. */
  /** EN: Size in bytes. */
  size: number;
  /** ES: Tipo MIME inferido o determinado por el navegador. */
  /** EN: MIME type inferred or determined by the browser. */
  type: string;
  /** ES: Instancia Blob con el contenido binario intacto. */
  /** EN: Blob instance with intact binary content. */
  blob: Blob;
  /** ES: Obtiene una copia de los bytes binarios bajo demanda. */
  /** EN: Obtains a copy of binary bytes on demand. */
  bytes(): Promise<Uint8Array>;
}

export interface WorkspaceResourcePort {
  resolveResourcePath(documentPath: string, relativeUri: string): ResolvedResourceRef;
  readResource(
    root: DirectoryHandle,
    documentPath: string,
    relativeUri: string,
  ): Promise<WorkspaceResource>;
}

/**
 * ES: Determina un tipo MIME común para extensiones conocidas cuando no viene provisto.
 * EN: Guesses a common MIME type for known extensions when not provided.
 */
export function guessMimeType(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) return "application/octet-stream";
  const ext = fileName.slice(dotIndex + 1).toLowerCase();
  switch (ext) {
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "svg": return "image/svg+xml";
    case "webp": return "image/webp";
    case "ico": return "image/x-icon";
    case "bmp": return "image/bmp";
    case "avif": return "image/avif";
    case "pdf": return "application/pdf";
    case "json": return "application/json";
    case "txt": return "text/plain";
    case "csv": return "text/csv";
    case "mp3": return "audio/mpeg";
    case "mp4": return "video/mp4";
    case "webm": return "video/webm";
    case "ogg": return "audio/ogg";
    case "wav": return "audio/wav";
    default: return "application/octet-stream";
  }
}

/**
 * ES: Resuelve y normaliza la ruta de un recurso local respecto a un documento del workspace.
 * Valida tanto la ruta del documento como la del recurso para evitar salidas de raíz o rutas absolutas.
 *
 * EN: Resolves and normalizes a local resource path relative to a workspace document.
 * Validates both document path and resource path to prevent root escaping or absolute paths.
 */
export function resolveResourcePath(
  documentPath: string,
  relativeUri: string,
): ResolvedResourceRef {
  if (typeof documentPath !== "string" || !documentPath.trim()) {
    throw new InvalidResourcePathError("Document path must be a non-empty string");
  }
  if (typeof relativeUri !== "string" || !relativeUri.trim()) {
    throw new InvalidResourcePathError("Resource URI must be a non-empty string");
  }

  // ES: Validar que la ruta del documento sea relativa, sin letras de unidad ni barras invertidas
  // EN: Validate that document path is relative, without drive letters or backslashes
  const cleanDocPath = documentPath.trim();
  if (
    cleanDocPath.startsWith("/") ||
    /^[a-zA-Z]:/i.test(cleanDocPath) ||
    /[\\\x00-\x1f]/.test(cleanDocPath)
  ) {
    throw new InvalidResourcePathError("Document path must be a relative workspace path without drive letters or backslashes");
  }

  // ES: Analizar y normalizar los segmentos del directorio contenedor del documento
  // EN: Parse and normalize segments of document's containing directory
  const rawDocParts = cleanDocPath.split("/");
  const docFileName = rawDocParts.pop(); // quitar y validar nombre de archivo
  if (!docFileName || docFileName === "." || docFileName === ".." || /[<>:"|?*]/.test(docFileName)) {
    throw new InvalidResourcePathError("Document path must end with a valid file name");
  }

  const baseParts: string[] = [];
  for (const part of rawDocParts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (baseParts.length === 0) {
        throw new InvalidResourcePathError("Document path escapes workspace root with parent segments");
      }
      baseParts.pop();
    } else {
      if (/[<>:"|?*]/.test(part)) {
        throw new InvalidResourcePathError(`Invalid character in document path segment: "${part}"`);
      }
      baseParts.push(part);
    }
  }

  // ES: Limpiar fragmentos (#) y parámetros de consulta (?) comunes en referencias Markdown
  // EN: Strip fragments (#) and query parameters (?) common in Markdown references
  const cleanUri = relativeUri.trim().split(/[?#]/)[0];
  if (!cleanUri) {
    throw new InvalidResourcePathError("Resource URI must contain a valid path");
  }

  // ES: Detectar destinos externos (esquemas como http:, https:, data:, blob:, mailto:, o URLs de protocolo //)
  // EN: Detect external destinations (schemes like http:, https:, data:, blob:, mailto:, or protocol URLs //)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(cleanUri) || cleanUri.startsWith("//")) {
    throw new InvalidResourcePathError("External destinations are rejected for local resource access");
  }

  // ES: Rechazar rutas absolutas Unix (/...) o letras de unidad Windows (C:... / c:/...)
  // EN: Reject Unix absolute paths (/...) or Windows drive letters (C:... / c:/...)
  if (cleanUri.startsWith("/") || /^[a-zA-Z]:/i.test(cleanUri)) {
    throw new InvalidResourcePathError("Absolute paths are rejected for local resource access");
  }

  // ES: Rechazar barras invertidas y caracteres de control no portables
  // EN: Reject backslashes and non-portable control characters
  if (/[\\\x00-\x1f]/.test(cleanUri)) {
    throw new InvalidResourcePathError("Backslashes and control characters are not allowed in resource paths");
  }

  // ES: Decodificar secuencias de escape URI (p. ej. %20 -> espacio)
  // EN: Decode URI escape sequences (e.g. %20 -> space)
  let decodedUri: string;
  try {
    decodedUri = decodeURI(cleanUri);
  } catch {
    throw new InvalidResourcePathError("Malformed URI encoding in resource path");
  }

  // ES: Validar la ruta tras la decodificación para detectar caracteres nulos, barras invertidas o rutas absolutas escapadas
  // EN: Validate path after decoding to catch encoded null characters, backslashes, or escaped absolute paths
  if (/[\\\x00-\x1f]/.test(decodedUri)) {
    throw new InvalidResourcePathError("Backslashes and control characters are not allowed in decoded resource paths");
  }
  if (decodedUri.startsWith("/") || /^[a-zA-Z]:/i.test(decodedUri)) {
    throw new InvalidResourcePathError("Absolute paths are rejected in decoded resource paths");
  }

  // ES: Normalizar segmentos del recurso sobre los segmentos base del documento
  // EN: Normalize resource segments on top of document base segments
  const stack = [...baseParts];
  const uriParts = decodedUri.split("/");

  for (const part of uriParts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (stack.length === 0) {
        throw new InvalidResourcePathError("Resource path escapes workspace root with parent segments");
      }
      stack.pop();
    } else {
      if (/[<>:"|?*]/.test(part)) {
        throw new InvalidResourcePathError(`Invalid character in path segment: "${part}"`);
      }
      stack.push(part);
    }
  }

  if (stack.length === 0) {
    throw new InvalidResourcePathError("Resource path points to workspace root, not a file");
  }

  // ES: Garantía estricta de seguridad: nunca devolver una ruta con segmentos '..' o '.'
  // EN: Strict safety guarantee: never return a path with '..' or '.' segments
  if (stack.some((part) => part === ".." || part === "." || !part)) {
    throw new InvalidResourcePathError("Resource path contains unresolved relative segments");
  }

  const workspaceRelativePath = stack.join("/");
  const fileName = stack[stack.length - 1];
  const parentPath = stack.slice(0, -1).join("/");

  return {
    workspaceRelativePath,
    fileName,
    parentPath,
  };
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { name?: string; message?: string };
  return (
    err.name === "NotFoundError" ||
    Boolean(err.message && /not\s*found|missing/i.test(err.message))
  );
}

function isPermissionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { name?: string; message?: string };
  return (
    err.name === "NotAllowedError" ||
    err.name === "SecurityError" ||
    Boolean(err.message && /permission|denied|not\s*allowed/i.test(err.message))
  );
}

/**
 * ES: Lee bajo demanda un recurso local del workspace a partir de su referencia resuelta.
 * Preserva bytes binarios sin decodificar texto para evitar corrupción de datos.
 *
 * EN: Reads on-demand a local workspace resource from its resolved reference.
 * Preserves binary bytes without text decoding to avoid data corruption.
 */
export async function readWorkspaceResourceByResolved(
  root: DirectoryHandle,
  resolved: ResolvedResourceRef,
): Promise<WorkspaceResource> {
  let parentDir: DirectoryHandle;
  try {
    parentDir = await directoryAt(root, resolved.parentPath);
  } catch (error: unknown) {
    if (isPermissionError(error)) {
      throw new PermissionDeniedError(`Permission denied accessing directory: "${resolved.parentPath}"`);
    }
    if (isNotFoundError(error)) {
      throw new ResourceNotFoundError(`Parent directory not found for resource: "${resolved.parentPath}"`);
    }
    throw error;
  }

  let fileHandle: WorkspaceFileHandle;
  try {
    fileHandle = await parentDir.getFileHandle(resolved.fileName, { create: false });
  } catch (error: unknown) {
    if (isPermissionError(error)) {
      throw new PermissionDeniedError(`Permission denied accessing resource: "${resolved.workspaceRelativePath}"`);
    }
    if (isNotFoundError(error)) {
      throw new ResourceNotFoundError(`Resource not found: "${resolved.workspaceRelativePath}"`);
    }
    throw error;
  }

  let rawFile: { text(): Promise<string> };
  try {
    rawFile = await fileHandle.getFile();
  } catch (error: unknown) {
    if (isPermissionError(error)) {
      throw new PermissionDeniedError(`Permission denied reading resource: "${resolved.workspaceRelativePath}"`);
    }
    if (isNotFoundError(error)) {
      throw new ResourceNotFoundError(`Resource file could not be read: "${resolved.workspaceRelativePath}"`);
    }
    throw error;
  }

  const rawRecord = rawFile as unknown as {
    size?: number;
    type?: string;
    arrayBuffer?: () => Promise<ArrayBuffer>;
    bytes?: () => Promise<Uint8Array>;
  };
  const mimeType = rawRecord.type || guessMimeType(resolved.fileName);

  let blob: Blob;
  let size: number;
  let cachedBytes: Uint8Array | null = null;

  if (typeof Blob !== "undefined" && rawFile instanceof Blob) {
    blob = rawFile;
    size = rawFile.size;
  } else if (typeof rawRecord.arrayBuffer === "function") {
    // ES: Preservar bytes directamente desde arrayBuffer sin decodificar a texto
    // EN: Preserve bytes directly from arrayBuffer without text decoding
    const buffer = await rawRecord.arrayBuffer();
    cachedBytes = new Uint8Array(buffer);
    blob = typeof Blob !== "undefined" ? new Blob([buffer], { type: mimeType }) : (rawFile as unknown as Blob);
    size = cachedBytes.byteLength;
  } else if (typeof rawRecord.bytes === "function") {
    // ES: Preservar bytes directamente desde función bytes()
    // EN: Preserve bytes directly from bytes() function
    const directBytes = await rawRecord.bytes();
    cachedBytes = directBytes;
    blob = typeof Blob !== "undefined" ? new Blob([directBytes as unknown as BlobPart], { type: mimeType }) : (rawFile as unknown as Blob);
    size = directBytes.byteLength;
  } else {
    // ES: NUNCA reconstruir un binario desde text() para evitar corrupción silenciosa de bytes
    // EN: NEVER reconstruct a binary from text() to avoid silent byte corruption
    throw new UnsupportedCapabilityError(
      "Underlying file handle cannot preserve binary content (missing Blob, arrayBuffer, or bytes)",
    );
  }

  return {
    path: resolved.workspaceRelativePath,
    name: resolved.fileName,
    size,
    type: mimeType,
    blob,
    bytes: async () => {
      if (cachedBytes) {
        return new Uint8Array(cachedBytes);
      }
      if (typeof blob?.arrayBuffer === "function") {
        const buffer = await blob.arrayBuffer();
        return new Uint8Array(buffer);
      }
      throw new UnsupportedCapabilityError("Cannot read binary bytes from resource blob");
    },
  };
}

/**
 * ES: Lee bajo demanda un recurso local del workspace relativo al documento sin importar masivamente a IndexedDB.
 * EN: Reads on-demand a local workspace resource relative to document without importing massively to IndexedDB.
 */
export async function readWorkspaceResource(
  root: DirectoryHandle,
  documentPath: string,
  relativeUri: string,
): Promise<WorkspaceResource> {
  if (
    !root ||
    typeof root !== "object" ||
    root.kind !== "directory" ||
    typeof root.getDirectoryHandle !== "function" ||
    typeof root.getFileHandle !== "function"
  ) {
    throw new UnsupportedCapabilityError("Directory handle capability is not available in current environment");
  }

  if (typeof root.queryPermission === "function") {
    let perm: PermissionState = "prompt";
    try {
      perm = await root.queryPermission({ mode: "read" });
    } catch {
      perm = "prompt";
    }
    if (perm === "denied") {
      throw new PermissionDeniedError("Read permission was denied for workspace directory");
    }
  }

  const resolved = resolveResourcePath(documentPath, relativeUri);
  return readWorkspaceResourceByResolved(root, resolved);
}

/**
 * ES: Lee bajo demanda un recurso local especificando su ruta relativa directa desde la raíz del workspace.
 * EN: Reads on-demand a local resource specifying its direct relative path from workspace root.
 */
export async function readWorkspaceResourceByPath(
  root: DirectoryHandle,
  workspaceRelativePath: string,
): Promise<WorkspaceResource> {
  return readWorkspaceResource(root, "root.md", workspaceRelativePath);
}

export const workspaceResourceAdapter: WorkspaceResourcePort = {
  resolveResourcePath,
  readResource: readWorkspaceResource,
};
