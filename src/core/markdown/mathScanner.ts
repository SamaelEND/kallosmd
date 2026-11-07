/**
 * Escáner y renderizador de fórmulas matemáticas KaTeX (Display Math $$...$$ e Inline Math $...$).
 * Consciente de secuencias de escape y encabezados para evitar colisiones con precios o sintaxis Markdown.
 */

import katex from "katex";

export interface MathPlaceholder {
  id: string;
  html: string;
}

export interface MathScanResult {
  text: string;
  placeholders: MathPlaceholder[];
}

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function countBackslashesBefore(source: string, pos: number): number {
  let count = 0;
  let p = pos - 1;
  while (p >= 0 && source[p] === "\\") {
    count++;
    p--;
  }
  return count;
}

/**
 * Escanea un texto con bloques de código ya protegidos y reemplaza ecuaciones matemáticas por placeholders.
 */
export function extractAndRenderMath(processed: string): MathScanResult {
  const mathPlaceholders: MathPlaceholder[] = [];
  let mathProcessed = "";
  let i = 0;
  const len = processed.length;

  while (i < len) {
    // Detección de bloque matemático Display Math ($$ ... $$) no escapado
    if (
      processed[i] === "$" &&
      processed[i + 1] === "$" &&
      countBackslashesBefore(processed, i) % 2 === 0
    ) {
      let j = i + 2;
      let foundClosing = false;
      let hasHeaderBreak = false;

      while (j < len - 1) {
        if (processed[j] === "\n") {
          const rest = processed.slice(j + 1);
          if (/^#{1,6}\s|^---+(?=\n|$)/.test(rest)) {
            hasHeaderBreak = true;
            break;
          }
        }
        if (
          processed[j] === "$" &&
          processed[j + 1] === "$" &&
          countBackslashesBefore(processed, j) % 2 === 0
        ) {
          foundClosing = true;
          break;
        }
        j++;
      }

      if (foundClosing && !hasHeaderBreak) {
        const rawMath = processed.slice(i + 2, j);
        const cleanedMath = rawMath
          .split("\n")
          .map((line) => line.replace(/^[ \t]*(?:>[ \t]*)+/, ""))
          .join("\n")
          .trim();

        const lineNum = (processed.slice(0, i).match(/\n/g) || []).length + 1;
        const id = `%%KATEX_BLOCK_${mathPlaceholders.length}%%`;
        try {
          const rendered = katex.renderToString(cleanedMath, {
            displayMode: true,
            throwOnError: false,
          });
          mathPlaceholders.push({
            id,
            html: `<div class="katex-display-wrapper" data-source-line="${lineNum}">${rendered}</div>`,
          });
        } catch {
          mathPlaceholders.push({
            id,
            html: `<div class="katex-error" data-source-line="${lineNum}">$$${escapeHtmlText(cleanedMath)}$$</div>`,
          });
        }
        mathProcessed += id;
        i = j + 2;
        continue;
      }
    }

    // Detección de fórmula matemática en línea Inline Math ($ ... $) no escapada
    if (
      processed[i] === "$" &&
      processed[i + 1] !== "$" &&
      countBackslashesBefore(processed, i) % 2 === 0 &&
      processed[i + 1] !== " " &&
      processed[i + 1] !== "\t" &&
      processed[i + 1] !== "\n" &&
      processed[i + 1] !== "\r"
    ) {
      let j = i + 1;
      let foundClosing = false;
      let hasLineBreak = false;

      while (j < len) {
        if (processed[j] === "\n") {
          if (
            processed[j + 1] === "\n" ||
            /^#{1,6}\s/.test(processed.slice(j + 1))
          ) {
            hasLineBreak = true;
            break;
          }
        }
        if (
          processed[j] === "$" &&
          processed[j + 1] !== "$" &&
          countBackslashesBefore(processed, j) % 2 === 0
        ) {
          foundClosing = true;
          break;
        }
        j++;
      }

      if (foundClosing && !hasLineBreak) {
        const rawMath = processed.slice(i + 1, j);
        const trimmed = rawMath.trim();
        const isPureCurrency = /^\d+([.,]\d{1,2})?$/.test(trimmed);

        if (trimmed && !isPureCurrency) {
          const id = `%%KATEX_INLINE_${mathPlaceholders.length}%%`;
          try {
            const rendered = katex.renderToString(trimmed, {
              displayMode: false,
              throwOnError: false,
            });
            mathPlaceholders.push({
              id,
              html: rendered,
            });
          } catch {
            mathPlaceholders.push({
              id,
              html: `<span class="katex-error">$${escapeHtmlText(trimmed)}$</span>`,
            });
          }
          mathProcessed += id;
          i = j + 1;
          continue;
        }
      }
    }

    mathProcessed += processed[i];
    i++;
  }

  return {
    text: mathProcessed,
    placeholders: mathPlaceholders,
  };
}

/**
 * Restaura los placeholders matemáticos de KaTeX evitando anidación inválida de <div> dentro de <p>.
 */
export function restoreMathPlaceholders(
  html: string,
  placeholders: MathPlaceholder[],
): string {
  let result = html;
  for (const item of placeholders) {
    if (item.id.startsWith("%%KATEX_BLOCK_")) {
      result = result.replace(
        new RegExp(`<p\\b[^>]*>\\s*${item.id}\\s*<\\/p>|${item.id}`, "g"),
        () => item.html,
      );
    } else {
      result = result.replace(item.id, () => item.html);
    }
  }
  return result;
}

