/**
 * Utilidades de análisis y manipulación de texto Markdown.
 */

import type { TocHeading } from "../../types";

/**
 * Normaliza nombres de archivos asegurando la extensión .md.
 */
export function normalizeDocTitle(rawTitle: string): string {
  const clean = rawTitle.trim();
  if (!clean) return "documento.md";
  return clean.toLowerCase().endsWith(".md") ? clean : `${clean}.md`;
}

/**
 * Extrae el primer encabezado de nivel 1 (# Título) para el nombre automático del archivo.
 */
export function extractFirstH1(markdown: string): string | null {
  const lines = markdown.split("\n");
  let inCodeBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Detectar encabezado de nivel 1 (# Encabezado pero no ## o más)
    const match = line.match(/^#\s+(.+)$/);
    if (match) {
      const clean = match[1]
        .replace(/[*_`~[\]]/g, "")
        .replace(/[\\/:*?"<>|]/g, "")
        .trim();
      if (clean) return clean;
    }
  }

  return null;
}

/**
 * Extrae encabezados del contenido Markdown para construir la tabla de contenidos (TOC).
 */
export function extractHeadings(markdown: string): TocHeading[] {
  const lines = markdown.split("\n");
  const headings: TocHeading[] = [];
  const slugCounts = new Map<string, number>();

  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith("```") || line.trim().startsWith("~~~")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const rawText = match[2].trim().replace(/[*_`~[\]]/g, "");

      let slug = rawText
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");

      if (!slug) slug = `seccion-${headings.length + 1}`;

      const count = slugCounts.get(slug) || 0;
      slugCounts.set(slug, count + 1);
      const uniqueId = count > 0 ? `${slug}-${count}` : slug;

      headings.push({
        id: uniqueId,
        text: rawText,
        level,
      });
    }
  }

  return headings;
}

/**
 * Conmuta el estado de un checkbox de tarea (- [ ] / - [x]) en el código Markdown
 * según su índice ordinal, ignorando bloques de código.
 */
export function toggleMarkdownTaskAtIndex(
  markdown: string,
  taskIndex: number,
  isChecked: boolean,
): string | null {
  const masked = markdown.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (m) =>
    " ".repeat(m.length),
  );
  const taskRegex = /(^|\n)(\s*[-*+]\s+\[)([ xX])(\]\s+)/g;

  let match: RegExpExecArray | null;
  let currentIndex = 0;
  let targetPos = -1;

  while ((match = taskRegex.exec(masked)) !== null) {
    if (currentIndex === taskIndex) {
      targetPos = match.index + match[1].length + match[2].length;
      break;
    }
    currentIndex++;
  }

  if (targetPos === -1) return null;

  const newChar = isChecked ? "x" : " ";
  return (
    markdown.substring(0, targetPos) +
    newChar +
    markdown.substring(targetPos + 1)
  );
}

