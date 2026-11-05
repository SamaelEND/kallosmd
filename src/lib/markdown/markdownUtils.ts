/**
 * ES: Utilidades de análisis y manipulación de texto Markdown.
 * EN: Markdown text analysis and manipulation utilities.
 */

import type { TocHeading } from "../../types";

/**
 * ES: Normaliza nombres de archivos asegurando la extensión .md.
 * EN: Normalizes file names ensuring the .md extension.
 */
export function normalizeDocTitle(rawTitle: string): string {
  const clean = rawTitle.trim();
  if (!clean) return "documento.md";
  return clean.toLowerCase().endsWith(".md") ? clean : `${clean}.md`;
}

/**
 * ES: Extrae el primer encabezado de nivel 1 (# Título) ignorando bloques de código.
 * EN: Extracts the first level 1 heading (# Title) ignoring code blocks.
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

    // ES: Detecta encabezado de nivel 1 (# Encabezado) excluyendo niveles inferiores.
    // EN: Detects level 1 heading (# Heading) excluding deeper heading levels.
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
 * ES: Genera un slug identificador normalizado compatible con caracteres Unicode y sufijos numéricos únicos.
 * EN: Generates a normalized identifier slug compatible with Unicode characters and unique numeric suffixes.
 */
export function generateHeadingSlug(
  rawText: string,
  slugCounts?: Map<string, number>,
): string {
  const plainText = rawText
    .replace(/<[^>]+>/g, "")
    .replace(/[*_`~[\]]/g, "")
    .trim();

  let slug = plainText
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-_]/gu, "")
    .trim()
    .replace(/\s+/g, "-");

  if (!slug) slug = "seccion";

  if (slugCounts) {
    const count = slugCounts.get(slug) || 0;
    slugCounts.set(slug, count + 1);
    return count > 0 ? `${slug}-${count}` : slug;
  }

  return slug;
}

/**
 * ES: Extrae encabezados del contenido Markdown para construir la tabla de contenidos (TOC).
 * EN: Extracts headings from Markdown content to build the table of contents (TOC).
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
      const uniqueId = generateHeadingSlug(rawText, slugCounts);

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
 * ES: Conmuta el estado de un checkbox de tarea (- [ ] / - [x]) en el código Markdown según su índice ordinal.
 * EN: Toggles the state of a task checkbox (- [ ] / - [x]) in the Markdown source by its ordinal index.
 */
export function toggleMarkdownTaskAtIndex(
  markdown: string,
  taskIndex: number,
  isChecked: boolean,
): string | null {
  // ES: Enmascara bloques de código cercados e inline preservando los desplazamientos de caracteres.
  // EN: Masks fenced and inline code blocks while preserving character offsets.
  const masked = markdown
    .replace(
      /(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2[ \t]*(?=\n|$)/g,
      (m) => " ".repeat(m.length),
    )
    .replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (m) =>
      " ".repeat(m.length),
    );

  // ES: Coincide con tareas en listas con viñetas, numeradas y dentro de citas (>).
  // EN: Matches tasks in bulleted lists, numbered lists, and inside blockquotes (>).
  const taskRegex =
    /(^|\n)((?:[ \t]*>[ \t]*)*[ \t]*(?:[-*+]|\d+[.)])[ \t]+\[)([ xX])(\][ \t]+)/g;

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
