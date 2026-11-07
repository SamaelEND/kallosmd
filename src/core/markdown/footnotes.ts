/**
 * Procesador de definiciones y referencias de notas al pie ([^id]).
 */

export interface FootnotePlaceholder {
  id: string;
  html: string;
}

export interface FootnoteScanResult {
  text: string;
  placeholders: FootnotePlaceholder[];
}

function sanitizeFootnoteSlug(rawId: string): string {
  return rawId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_]/g, "-");
}

/**
 * Extrae las definiciones `[^id]: texto` y referencias `[^id]` reemplazándolas por placeholders.
 */
export function extractAndRenderFootnotes(
  input: string,
  parseInline: (src: string) => string,
): FootnoteScanResult {
  const footnotePlaceholders: FootnotePlaceholder[] = [];
  const footnoteNumbers = new Map<string, number>();
  let footnoteCounter = 0;

  function getFootnoteNumber(rawId: string): number {
    const key = rawId.trim();
    const existing = footnoteNumbers.get(key);
    if (existing !== undefined) return existing;
    footnoteCounter += 1;
    footnoteNumbers.set(key, footnoteCounter);
    return footnoteCounter;
  }

  const refOrderRegex = /\[\^([^\]]+)\](?!:)/g;
  let refMatch: RegExpExecArray | null;
  while ((refMatch = refOrderRegex.exec(input)) !== null) {
    getFootnoteNumber(refMatch[1]);
  }

  let processed = input.replace(
    /(^|\n)\[\^([^\]]+)\]:[ \t]*([^\n]+(?:\n[ \t]+[^\n]+)*)/g,
    (_, leadingNewline: string, rawId: string, rawDef: string) => {
      const num = getFootnoteNumber(rawId);
      const slug = sanitizeFootnoteSlug(rawId);
      const inlineBody = parseInline(rawDef.trim());
      const placeholderId = `%%FOOTNOTE_ITEM_${footnotePlaceholders.length}%%`;

      footnotePlaceholders.push({
        id: placeholderId,
        html: `<div class="footnote-item" id="fn-${slug}"><span class="footnote-num">[${num}]</span><div class="footnote-body">${inlineBody} <a href="#fnref-${slug}" class="footnote-backref" title="Volver al texto" aria-label="Volver al texto">↩</a></div></div>`,
      });

      return `${leadingNewline}${placeholderId}\n`;
    },
  );

  processed = processed.replace(/\[\^([^\]]+)\](?!:)/g, (_, rawId: string) => {
    const num = getFootnoteNumber(rawId);
    const slug = sanitizeFootnoteSlug(rawId);
    const placeholderId = `%%FOOTNOTE_REF_${footnotePlaceholders.length}%%`;

    footnotePlaceholders.push({
      id: placeholderId,
      html: `<sup class="footnote-ref"><a href="#fn-${slug}" id="fnref-${slug}">[${num}]</a></sup>`,
    });

    return placeholderId;
  });

  return {
    text: processed,
    placeholders: footnotePlaceholders,
  };
}

/**
 * Restaura el HTML de las notas al pie procesadas en el documento compilado.
 */
export function restoreFootnotePlaceholders(
  html: string,
  placeholders: FootnotePlaceholder[],
): string {
  let result = html;
  for (const item of placeholders) {
    result = result.replace(
      new RegExp(`<p\\b[^>]*>\\s*${item.id}\\s*<\\/p>|${item.id}`, "g"),
      () => item.html,
    );
  }
  return result;
}

