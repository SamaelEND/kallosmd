/**
 * Utilidades de formato para metadatos de archivos y estadísticas de texto.
 */

export interface DocumentStats {
  lines: number;
  words: number;
  readingTime: number;
}

/**
 * Calcula la cantidad de líneas, palabras y tiempo estimado de lectura (200 ppm).
 */
export function computeDocumentStats(text: string): DocumentStats {
  const lines = text ? text.split("\n").length : 0;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const readingTime = words ? Math.max(1, Math.round(words / 200)) : 0;
  return { lines, words, readingTime };
}

/**
 * Formatea la fecha de actualización y el tamaño en bytes de un documento.
 * Ejemplo: "Nov 5, 12:01 AM · 11 B"
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
 * Genera un identificador único compatible con cualquier entorno de navegador.
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
 * Lee un archivo de texto del navegador mediante FileReader y devuelve su contenido.
 */
export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(String(event.target?.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

