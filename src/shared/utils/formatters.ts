/**
 * ES: Utilidades de formato para metadatos de archivos, validación de importación y estadísticas de texto.
 * EN: Formatting utilities for file metadata, import validation, and text statistics.
 */

export interface DocumentStats {
  lines: number;
  words: number;
  readingTime: number;
}

// ES: Tamaño máximo permitido para importar archivos de texto (10 MB).
// EN: Maximum allowed size for importing text files (10 MB).
export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

// ES: Extensiones de archivo admitidas para importación local.
// EN: Supported file extensions for local import.
const ALLOWED_IMPORT_EXTENSIONS = [".md", ".markdown", ".txt"];

const sharedTextEncoder =
  typeof TextEncoder !== "undefined" ? new TextEncoder() : null;

/**
 * ES: Calcula la longitud en bytes UTF-8 de una cadena de texto sin instanciar objetos Blob.
 * EN: Computes the UTF-8 byte length of a text string without instantiating Blob objects.
 */
export function getUtf8ByteLength(text: string): number {
  if (!text) return 0;
  return sharedTextEncoder ? sharedTextEncoder.encode(text).byteLength : text.length;
}

/**
 * ES: Calcula la cantidad de líneas, palabras y tiempo estimado de lectura (200 palabras por minuto).
 * EN: Computes line count, word count, and estimated reading time (200 words per minute).
 */
export function computeDocumentStats(text: string): DocumentStats {
  if (!text) {
    return { lines: 0, words: 0, readingTime: 0 };
  }

  let lines = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) lines++;
  }

  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const readingTime = words ? Math.max(1, Math.round(words / 200)) : 0;
  return { lines, words, readingTime };
}

/**
 * ES: Formatea la fecha de actualización y el tamaño en bytes de un documento según el idioma activo.
 * EN: Formats the update timestamp and byte size of a document according to the active locale.
 */
export function formatFileMeta(
  timestamp: number,
  sizeBytes: number,
  locale: "es" | "en" = "es",
): string {
  const date = new Date(timestamp);
  const monthNamesEs = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  const monthNamesEn = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthNames = locale === "en" ? monthNamesEn : monthNamesEs;
  const month = monthNames[date.getMonth()];
  const day = date.getDate();
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const timeStr = `${hours}:${minutes} ${ampm}`;

  let sizeStr = "";
  if (sizeBytes < 1024) {
    sizeStr = `${sizeBytes} B`;
  } else if (sizeBytes < 1024 * 1024) {
    sizeStr = `${(sizeBytes / 1024).toFixed(1)} KB`;
  } else {
    sizeStr = `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${month} ${day}, ${timeStr} · ${sizeStr}`;
}

/**
 * ES: Genera un identificador único compatible con cualquier entorno de navegador.
 * EN: Generates a unique identifier compatible with any browser environment.
 */
export function generateId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "doc_" +
        Date.now().toString(36) +
        "_" +
        Math.random().toString(36).substring(2, 8);
}

/**
 * ES: Verifica que el archivo cumpla con las extensiones de texto admitidas y el límite de tamaño.
 * EN: Verifies that the file matches supported text extensions and the size limit.
 */
export function isValidImportFile(file: File): boolean {
  if (!file || file.size > MAX_IMPORT_FILE_BYTES) {
    return false;
  }
  const lowerName = file.name.toLowerCase();
  const hasAllowedExt = ALLOWED_IMPORT_EXTENSIONS.some((ext) =>
    lowerName.endsWith(ext),
  );
  const isTextMime =
    !file.type ||
    file.type.startsWith("text/") ||
    file.type === "application/octet-stream";
  return hasAllowedExt && isTextMime;
}

/**
 * ES: Lee un archivo de texto validado del navegador mediante FileReader y devuelve su contenido.
 * EN: Reads a validated browser text file using FileReader and returns its content.
 */
export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isValidImportFile(file)) {
      reject(new Error("Unsupported file type or size limit exceeded."));
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => resolve(String(event.target?.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
