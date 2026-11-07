/**
 * ES: Decoraciones de formato inline para el modo Live Preview en CodeMirror 6.
 *     Aplica reemplazos y estilos tipográficos limpios para código en línea,
 *     fórmulas KaTeX $...$, enlaces Markdown, negritas, cursivas, tachados,
 *     resaltados ==mark== y etiquetas semánticas HTML (kbd, sup, sub, abbr).
 * EN: Inline formatting decorations for Live Preview mode in CodeMirror 6.
 *     Applies clean typographic replacements and styles for inline code,
 *     KaTeX $...$ formulas, Markdown links, bold, italic, strikethrough,
 *     ==mark== highlights, and semantic HTML tags (kbd, sup, sub, abbr).
 */

import { type Range } from "@codemirror/state";
import { Decoration } from "@codemirror/view";
import { KatexInlineWidget } from "./liveWidgets";

/**
 * ES: Cuenta cuántas barras invertidas consecutivas preceden inmediatamente a una posición.
 * EN: Counts how many consecutive backslashes immediately precede a position.
 */
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
 * ES: Busca todas las fórmulas matemáticas inline ($...$) válidas en una línea respetando escapes \$.
 * EN: Finds all valid inline math formulas ($...$) in a line while respecting \$ escapes.
 */
function findInlineMathSpans(slice: string): Array<{ from: number; to: number; expr: string }> {
  const spans: Array<{ from: number; to: number; expr: string }> = [];
  const len = slice.length;
  let i = 0;

  while (i < len) {
    if (
      slice[i] === "$" &&
      slice[i + 1] !== "$" &&
      (i === 0 || slice[i - 1] !== "$") &&
      countBackslashesBefore(slice, i) % 2 === 0 &&
      i + 1 < len &&
      slice[i + 1] !== " " &&
      slice[i + 1] !== "\t"
    ) {
      let j = i + 1;
      let foundClosing = false;
      while (j < len) {
        if (
          slice[j] === "$" &&
          slice[j + 1] !== "$" &&
          countBackslashesBefore(slice, j) % 2 === 0
        ) {
          foundClosing = true;
          break;
        }
        j++;
      }

      if (foundClosing) {
        const rawMath = slice.slice(i + 1, j);
        const trimmed = rawMath.trim();
        const isPureCurrency = /^\d+([.,]\d{1,2})?$/.test(trimmed);
        if (trimmed && !isPureCurrency) {
          spans.push({ from: i, to: j + 1, expr: trimmed });
          i = j + 1;
          continue;
        }
      }
    }
    i++;
  }

  return spans;
}

/**
 * ES: Escanea y aplica decoraciones tipográficas inline sobre el contenido de una línea.
 * EN: Scans and applies inline typographic decorations over line content.
 */
export function addInlineDecorations(
  lineText: string,
  lineFrom: number,
  contentOffset: number,
  decos: Range<Decoration>[],
): void {
  const occupied: Array<[number, number]> = [];
  const isFree = (s: number, e: number) => !occupied.some(([os, oe]) => s < oe && e > os);
  const slice = lineText.slice(contentOffset);
  const base = lineFrom + contentOffset;

  // ES: Aplica marcas simétricas delimitadas por tokens Markdown (negrita, cursiva, código, tachado).
  // EN: Applies symmetric marks bounded by Markdown tokens (bold, italic, code, strikethrough).
  const markSymmetric = (re: RegExp, cls: string, markerLen?: number) => {
    for (const m of slice.matchAll(re)) {
      const s = m.index!;
      const e = s + m[0].length;
      if (!isFree(s, e)) continue;
      occupied.push([s, e]);
      const mLen = markerLen ?? m[1].length;
      decos.push(Decoration.replace({}).range(base + s, base + s + mLen));
      decos.push(Decoration.mark({ class: cls }).range(base + s + mLen, base + e - mLen));
      decos.push(Decoration.replace({}).range(base + e - mLen, base + e));
    }
  };

  markSymmetric(/(`+)([^`]+?)\1/g, "cm-live-inline-code");

  // ES: Fórmulas matemáticas KaTeX inline ($...$) respetando signos de dólar escapados (\$).
  // EN: Inline KaTeX math formulas ($...$) respecting escaped dollar signs (\$).
  for (const span of findInlineMathSpans(slice)) {
    const s = span.from;
    const e = span.to;
    if (!isFree(s, e)) continue;
    occupied.push([s, e]);
    decos.push(
      Decoration.replace({ widget: new KatexInlineWidget(span.expr, base + s + 1) }).range(
        base + s,
        base + e,
      ),
    );
  }

  // ES: Oculta la barra invertida de escape en \$ literales fuera de fórmulas y código.
  // EN: Hides the escape backslash in literal \$ outside formulas and code.
  for (const m of slice.matchAll(/\\\$/g)) {
    const s = m.index!;
    const e = s + 2;
    if (!isFree(s, e)) continue;
    if (countBackslashesBefore(slice, s) % 2 !== 0) continue;
    occupied.push([s, s + 1]);
    decos.push(Decoration.replace({}).range(base + s, base + s + 1));
  }

  // ES: Enlaces Markdown [texto](url) con lookbehind negativo para proteger imágenes ![alt](url).
  // EN: Markdown links [text](url) with negative lookbehind to protect ![alt](url) images.
  for (const m of slice.matchAll(/(?<!\!)\[([^\]]+)\]\(([^)]+)\)/g)) {
    const s = m.index!;
    const e = s + m[0].length;
    if (!isFree(s, e)) continue;
    occupied.push([s, e]);
    const labelEnd = s + 1 + m[1].length;
    decos.push(Decoration.replace({}).range(base + s, base + s + 1));
    decos.push(Decoration.mark({ class: "cm-live-link" }).range(base + s + 1, base + labelEnd));
    decos.push(Decoration.replace({}).range(base + labelEnd, base + e));
  }

  // ES: Referencias de notas al pie [^1] renderizadas como superíndice [1].
  // EN: Footnote references [^1] rendered as superscript [1].
  for (const m of slice.matchAll(/\[\^([^\]]+)\](?!:)/g)) {
    const s = m.index!;
    const e = s + m[0].length;
    if (!isFree(s, e)) continue;
    occupied.push([s, e]);
    decos.push(Decoration.mark({ class: "cm-live-footnote-ref" }).range(base + s, base + s + 1));
    decos.push(Decoration.replace({}).range(base + s + 1, base + s + 2));
    decos.push(Decoration.mark({ class: "cm-live-footnote-ref" }).range(base + s + 2, base + e));
  }

  markSymmetric(/(\*\*\*|___)(?=\S)(.+?)(?<=\S)\1/g, "cm-live-bold cm-live-italic", 3);
  markSymmetric(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, "cm-live-bold", 2);
  markSymmetric(/~~(?=\S)(.+?)(?<=\S)~~/g, "cm-live-strike", 2);
  markSymmetric(/==(?=\S)(.+?)(?<=\S)==/g, "cm-live-mark", 2);
  markSymmetric(/(?<![*_])(\*|_)(?=\S)([^_*]+?)(?<=\S)\1(?![*_])/g, "cm-live-italic", 1);

  // ES: Ocultamiento de etiquetas de apertura/cierre HTML semánticas estilizando su contenido.
  // EN: Hiding of semantic HTML opening/closing tags while styling their inner content.
  const markHtmlTag = (re: RegExp, cls: string) => {
    for (const m of slice.matchAll(re)) {
      const s = m.index!;
      const e = s + m[0].length;
      if (!isFree(s, e)) continue;
      occupied.push([s, e]);
      const openLen = m[1].length;
      const closeLen = m[3].length;
      decos.push(Decoration.replace({}).range(base + s, base + s + openLen));
      decos.push(Decoration.mark({ class: cls }).range(base + s + openLen, base + e - closeLen));
      decos.push(Decoration.replace({}).range(base + e - closeLen, base + e));
    }
  };

  markHtmlTag(/(<kbd>)(.+?)(<\/kbd>)/gi, "cm-live-kbd");
  markHtmlTag(/(<mark>)(.+?)(<\/mark>)/gi, "cm-live-mark");
  markHtmlTag(/(<sup>)(.+?)(<\/sup>)/gi, "cm-live-sup");
  markHtmlTag(/(<sub>)(.+?)(<\/sub>)/gi, "cm-live-sub");
  markHtmlTag(/(<abbr\b[^>]*>)(.+?)(<\/abbr>)/gi, "cm-live-abbr");
}
