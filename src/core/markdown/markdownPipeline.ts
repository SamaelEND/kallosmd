/**
 * ES: Motor orquestador de procesamiento y sanitización de Markdown, Highlight.js y DOMPurify.
 *     Delega el escaneo matemático KaTeX en mathScanner.ts, alertas GFM en gfmAlerts.ts y notas al pie en footnotes.ts.
 * EN: Orchestrator engine for Markdown processing and sanitization, Highlight.js, and DOMPurify.
 *     Delegates KaTeX math scanning to mathScanner.ts, GFM alerts to gfmAlerts.ts, and footnotes to footnotes.ts.
 */

import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/common";
import { Marked, Renderer } from "marked";
import {
  extractAndRenderFootnotes,
  restoreFootnotePlaceholders,
} from "./footnotes";
import { enhanceTaskLists, transformGfmAlerts } from "./gfmAlerts";
import { generateHeadingSlug } from "./markdownUtils";
import { extractAndRenderMath, restoreMathPlaceholders } from "./mathScanner";

const markedInstance = new Marked();

// ES: Registro de conteo de slugs para desambiguar encabezados duplicados en el mismo documento.
// EN: Slug count registry to disambiguate duplicate headings within the same document.
const renderHeadingCounts = new Map<string, number>();

// ES: En entorno de navegador configura directivas de seguridad en enlaces externos e inputs.
// EN: In browser environment, configures security directives on external links and inputs.
if (typeof DOMPurify?.addHook === "function") {
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.hasAttribute("href")) {
      const href = node.getAttribute("href") || "";
      if (
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("//")
      ) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    }

    if (node.tagName === "INPUT") {
      const type = node.getAttribute("type");
      if (type !== "checkbox") {
        node.remove();
      }
    }
  });
}

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

markedInstance.use({
  gfm: true,
  breaks: true,
  renderer: {
    heading(token: any) {
      const slug = generateHeadingSlug(token.text, renderHeadingCounts);
      const lineAttr = token.startLine
        ? ` data-source-line="${token.startLine}"`
        : "";
      // ES: Procesa los tokens inline para renderizar `código`, **negrita**, *cursiva* y [enlaces](url) dentro de encabezados.
      // EN: Parses inline tokens to render `code`, **bold**, *italic*, and [links](url) inside headings.
      const inlineHtml = token.tokens
        ? this.parser.parseInline(token.tokens)
        : token.text;
      return `<h${token.depth} id="${slug}"${lineAttr}>${inlineHtml}</h${token.depth}>\n`;
    },
    code(token: any) {
      const lineAttr = token.startLine
        ? ` data-source-line="${token.startLine}"`
        : "";
      if (token.lang === "mermaid") {
        return `<div class="mermaid-container"${lineAttr} data-mermaid-code="${encodeURIComponent(token.text)}"></div>\n`;
      }

      const rawLang = token.lang
        ? token.lang.trim().toLowerCase().split(/\s+/)[0]
        : "";
      const displayLang = rawLang.replace(/[^a-z0-9\-_+#]/g, "") || "texto";

      // ES: Elimina saltos de línea superfluos iniciales y finales del bloque de código.
      // EN: Strips superfluous leading and trailing newlines from the code block.
      const cleanCode = (token.text || "").replace(/^\n+|\n+$/g, "");

      let highlightedCode = "";
      try {
        if (rawLang && hljs.getLanguage(rawLang)) {
          highlightedCode = hljs.highlight(cleanCode, {
            language: rawLang,
            ignoreIllegals: true,
          }).value;
        } else {
          highlightedCode = escapeHtmlText(cleanCode);
        }
      } catch {
        highlightedCode = escapeHtmlText(cleanCode);
      }

      // ES: Emite HTML continuo sin saltos de línea ni indentación para evitar nodos de texto no deseados.
      // EN: Emits continuous HTML without newlines or indentation to prevent unwanted text nodes.
      return `<div class="code-block-wrapper"${lineAttr}><div class="code-header-bar"><span class="code-lang-label">${displayLang}</span><button class="code-copy-btn" type="button" title="Copiar código al portapapeles"><span class="copy-text">Copiar</span></button></div><pre><code class="hljs language-${displayLang}">${highlightedCode}</code></pre></div>\n`;
    },
    paragraph(token: any) {
      const lineAttr = token.startLine
        ? ` data-source-line="${token.startLine}"`
        : "";
      return `<p${lineAttr}>${this.parser.parseInline(token.tokens || [])}</p>\n`;
    },
    blockquote(token: any) {
      const lineAttr = token.startLine
        ? ` data-source-line="${token.startLine}"`
        : "";
      return `<blockquote${lineAttr}>\n${this.parser.parse(token.tokens || [])}</blockquote>\n`;
    },
    table(token: any) {
      const lineAttr = token.startLine
        ? ` data-source-line="${token.startLine}"`
        : "";
      const defaultHtml = Renderer.prototype.table.call(this, token);
      const tableWithLine = defaultHtml.replace("<table", `<table${lineAttr}`);
      return `<div class="table-container">${tableWithLine}</div>\n`;
    },
    list(token: any) {
      const lineAttr = token.startLine
        ? ` data-source-line="${token.startLine}"`
        : "";
      const tag = token.ordered ? "<ol" : "<ul";
      const defaultHtml = Renderer.prototype.list.call(this, token);
      return defaultHtml.replace(tag, `${tag}${lineAttr}`);
    },
    hr(token: any) {
      const lineAttr = token.startLine
        ? ` data-source-line="${token.startLine}"`
        : "";
      return `<hr${lineAttr}>\n`;
    },
  },
});

/**
 * ES: Canal de procesamiento central de Markdown, matemáticas KaTeX, alertas GFM y notas al pie.
 * EN: Core processing pipeline for Markdown, KaTeX math, GFM alerts, and footnotes.
 */
function compileMarkdownPipeline(rawText: string): string {
  renderHeadingCounts.clear();

  const codePlaceholders: { id: string; raw: string }[] = [];

  // ES: 1. Transforma sintaxis de resaltado ==texto== a etiquetas semánticas <mark>.
  // EN: 1. Transforms ==text== highlight syntax into semantic <mark> tags.
  let processed = rawText.replace(
    /(^|[^\\])==(?!\s)([\s\S]+?)(?<!\s)==/g,
    "$1<mark>$2</mark>",
  );

  // ES: 2. Protege bloques de código cercados (``` o ~~~) incluyendo aquellos dentro de blockquotes.
  // EN: 2. Protects fenced code blocks (``` or ~~~) including those inside blockquotes.
  processed = processed.replace(
    /(^|\n)([ \t]*(?:>[ \t]*)*)(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\n\2\3[ \t]*(?=\n|$)/g,
    (match, prefix) => {
      const id = `%%CODE_BLOCK_${codePlaceholders.length}%%`;
      const fullBlock = match.slice(prefix.length);
      codePlaceholders.push({ id, raw: fullBlock });
      return `${prefix}${id}`;
    },
  );

  // ES: 3. Protege código en línea (`...` o ``...``) ignorando acentos graves escapados (\`).
  // EN: 3. Protects inline code (`...` or ``...``) while ignoring escaped backticks (\`).
  processed = processed.replace(
    /(?<![\\`])((?:\\\\)*)(`+)([\s\S]*?[^`])\2(?!`)/g,
    (_match, slashes: string, ticks: string, inner: string) => {
      const id = `%%CODE_INLINE_${codePlaceholders.length}%%`;
      codePlaceholders.push({ id, raw: `${ticks}${inner}${ticks}` });
      return `${slashes}${id}`;
    },
  );

  // ES: 4. Escanea y renderiza fórmulas matemáticas KaTeX.
  // EN: 4. Scans and renders KaTeX mathematical formulas.
  const mathResult = extractAndRenderMath(processed);
  processed = mathResult.text;

  // ES: 5. Procesa definiciones y referencias de notas al pie ([^id]).
  // EN: 5. Processes footnote definitions and references ([^id]).
  const footnoteResult = extractAndRenderFootnotes(processed, (src) =>
    markedInstance.parseInline(src) as string,
  );
  processed = footnoteResult.text;

  // ES: 6. Restaura los bloques de código protegidos para su procesamiento en Marked.
  // EN: 6. Restores protected code blocks for Marked processing.
  for (const item of codePlaceholders) {
    processed = processed.replace(item.id, () => item.raw);
  }

  // ES: 7. Tokeniza y anota líneas fuente para sincronización de scroll entre editor y vista previa.
  // EN: 7. Tokenizes and annotates source lines for scroll synchronization between editor and preview.
  const tokens = markedInstance.lexer(processed);
  let offset = 0;
  for (const token of tokens) {
    const idx = processed.indexOf(token.raw, offset);
    if (idx !== -1) {
      (token as any).startLine =
        (processed.slice(0, idx).match(/\n/g) || []).length + 1;
      offset = idx + token.raw.length;
    }
  }
  let html = markedInstance.parser(tokens) as string;

  // ES: 8. Transforma alertas GFM y etiqueta listas de tareas.
  // EN: 8. Transforms GFM alerts and tags task lists.
  html = transformGfmAlerts(html);
  html = enhanceTaskLists(html);

  // ES: 9. Restaura notas al pie y bloques/fórmulas KaTeX.
  // EN: 9. Restores footnotes and KaTeX blocks/formulas.
  html = restoreFootnotePlaceholders(html, footnoteResult.placeholders);
  html = restoreMathPlaceholders(html, mathResult.placeholders);

  return html;
}

export type DompurifyConfig = NonNullable<
  Parameters<typeof DOMPurify.sanitize>[1]
>;

export const DOMPURIFY_CONFIG: DompurifyConfig = {
  ADD_TAGS: [
    "input",
    "details",
    "summary",
    "mark",
    "svg",
    "path",
    "math",
    "annotation",
    "semantics",
    "mrow",
    "mi",
    "mo",
    "mn",
    "msup",
    "msub",
    "mfrac",
    "msqrt",
    "mtable",
    "mtr",
    "mtd",
    "mtext",
    "mspace",
    "mover",
    "munder",
    "munderover",
    "msubsup",
    "mpadded",
    "mphantom",
    "menclose",
  ],
  ADD_ATTR: [
    "class",
    "style",
    "data-mermaid-code",
    "data-task-index",
    "data-source-line",
    "type",
    "checked",
    "disabled",
    "open",
    "id",
    "target",
    "rel",
    "role",
    "aria-hidden",
    "aria-label",
    "title",
    "viewBox",
    "width",
    "height",
    "fill",
    "d",
    "xmlns",
    "display",
    "align",
  ],
};

/**
 * Preprocesa y compila Markdown a HTML plano sin sanitizar (apto para Web Workers).
 */
export function processMathAndMarkdownRaw(rawText: string): string {
  return compileMarkdownPipeline(rawText);
}

/**
 * Preprocesa, compila y sanitiza el Markdown para su visualización segura en la vista previa.
 */
export function processMathAndMarkdown(rawText: string): string {
  const rawHtml = compileMarkdownPipeline(rawText);
  return DOMPurify.sanitize(rawHtml, DOMPURIFY_CONFIG) as string;
}
