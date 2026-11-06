/**
 * ES: Motor de procesamiento y sanitización de Markdown, alertas GFM, notas al pie, KaTeX y Highlight.js.
 * EN: Markdown processing and sanitization engine with GFM alerts, footnotes, KaTeX, and Highlight.js.
 */

import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/common";
import katex from "katex";
import { Marked, Renderer } from "marked";
import { generateHeadingSlug } from "./markdownUtils";

const markedInstance = new Marked();

// ES: Registro de conteo de slugs para desambiguar encabezados duplicados en el mismo documento.
// EN: Slug count registry to disambiguate duplicate headings within the same document.
const renderHeadingCounts = new Map<string, number>();

// ES: Configura directivas de seguridad en atributos de enlaces externos y elementos input.
// EN: Configures security directives on attributes of external links and input elements.
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

/**
 * ES: Escapa caracteres especiales HTML en cadenas de texto plano.
 * EN: Escapes special HTML characters in plain text strings.
 */
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
      const lineAttr = token.startLine ? ` data-source-line="${token.startLine}"` : "";
      return `<h${token.depth} id="${slug}"${lineAttr}>${token.text}</h${token.depth}>\n`;
    },
    code(token: any) {
      const lineAttr = token.startLine ? ` data-source-line="${token.startLine}"` : "";
      if (token.lang === "mermaid") {
        return `<div class="mermaid-container"${lineAttr} data-mermaid-code="${encodeURIComponent(token.text)}"></div>\n`;
      }

      const rawLang = token.lang ? token.lang.trim().toLowerCase().split(/\s+/)[0] : "";
      const displayLang = rawLang.replace(/[^a-z0-9\-_+#]/g, "") || "texto";

      // ES: Resalta el código según el lenguaje especificado o escapa el texto plano.
      // EN: Highlights code using the specified language or escapes plain text.
      let highlightedCode = "";
      try {
        if (rawLang && hljs.getLanguage(rawLang)) {
          highlightedCode = hljs.highlight(token.text, {
            language: rawLang,
            ignoreIllegals: true,
          }).value;
        } else {
          highlightedCode = escapeHtmlText(token.text);
        }
      } catch {
        highlightedCode = escapeHtmlText(token.text);
      }

      return `
        <div class="code-block-wrapper"${lineAttr}>
          <div class="code-header-bar">
            <span class="code-lang-label">${displayLang}</span>
            <button class="code-copy-btn" type="button" title="Copiar código al portapapeles">
              <span class="copy-text">Copiar</span>
            </button>
          </div>
          <pre><code class="hljs language-${displayLang}">${highlightedCode}</code></pre>
        </div>
      `;
    },
    paragraph(token: any) {
      const lineAttr = token.startLine ? ` data-source-line="${token.startLine}"` : "";
      return `<p${lineAttr}>${this.parser.parseInline(token.tokens || [])}</p>\n`;
    },
    blockquote(token: any) {
      const lineAttr = token.startLine ? ` data-source-line="${token.startLine}"` : "";
      return `<blockquote${lineAttr}>\n${this.parser.parse(token.tokens || [])}</blockquote>\n`;
    },
    table(token: any) {
      const lineAttr = token.startLine ? ` data-source-line="${token.startLine}"` : "";
      const defaultHtml = Renderer.prototype.table.call(this, token);
      return defaultHtml.replace("<table", `<table${lineAttr}`);
    },
    list(token: any) {
      const lineAttr = token.startLine ? ` data-source-line="${token.startLine}"` : "";
      const tag = token.ordered ? "<ol" : "<ul";
      const defaultHtml = Renderer.prototype.list.call(this, token);
      return defaultHtml.replace(tag, `${tag}${lineAttr}`);
    },
    hr(token: any) {
      const lineAttr = token.startLine ? ` data-source-line="${token.startLine}"` : "";
      return `<hr${lineAttr}>\n`;
    },
  },
});

interface AlertMeta {
  label: string;
  className: string;
  icon: string;
}

const GFM_ALERT_MAP: Record<string, AlertMeta> = {
  NOTE: {
    label: "Nota",
    className: "markdown-alert-note",
    icon: `<svg class="markdown-alert-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>`,
  },
  TIP: {
    label: "Consejo",
    className: "markdown-alert-tip",
    icon: `<svg class="markdown-alert-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z"></path></svg>`,
  },
  IMPORTANT: {
    label: "Importante",
    className: "markdown-alert-important",
    icon: `<svg class="markdown-alert-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path></svg>`,
  },
  WARNING: {
    label: "Advertencia",
    className: "markdown-alert-warning",
    icon: `<svg class="markdown-alert-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path></svg>`,
  },
  CAUTION: {
    label: "Precaución",
    className: "markdown-alert-caution",
    icon: `<svg class="markdown-alert-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>`,
  },
};

/**
 * ES: Transforma blockquotes con sintaxis GFM ([!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION]) en contenedores de alerta con icono.
 * EN: Transforms blockquotes with GFM syntax ([!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION]) into alert containers with icons.
 */
function transformGfmAlerts(html: string): string {
  return html.replace(
    /<blockquote\b([^>]*)>\s*<p\b[^>]*>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<br\s*\/?>\s*)?([\s\S]*?)<\/blockquote>/gi,
    (match, blockquoteAttrs: string, rawType: string, restHtml: string) => {
      const alertKey = rawType.toUpperCase();
      const meta = GFM_ALERT_MAP[alertKey];
      if (!meta) return match;

      let bodyHtml = restHtml.trim();
      if (!bodyHtml.startsWith("<p") && !bodyHtml.startsWith("</p>")) {
        bodyHtml = `<p>${bodyHtml}`;
      } else if (bodyHtml.startsWith("</p>")) {
        bodyHtml = bodyHtml.replace(/^<\/p>\s*/, "");
      }

      return `
        <div class="markdown-alert ${meta.className}" role="note"${blockquoteAttrs}>
          <div class="markdown-alert-title">
            ${meta.icon}
            <span>${meta.label}</span>
          </div>
          <div class="markdown-alert-body">
            ${bodyHtml}
          </div>
        </div>
      `;
    },
  );
}

/**
 * ES: Etiqueta los elementos de listas de tareas (<li> con checkbox) para estilizado y control de saltos de página.
 * EN: Tags task list items (<li> with checkbox) for styling and page break control.
 */
function enhanceTaskLists(html: string): string {
  const withTaskItems = html.replace(
    /<li>(\s*<input\b[^>]*type=["']checkbox["'][^>]*>)/gi,
    '<li class="task-list-item">$1',
  );
  return withTaskItems.replace(
    /<ul>(\s*<li class="task-list-item">)/gi,
    '<ul class="contains-task-list">$1',
  );
}

/**
 * ES: Canal de procesamiento central de Markdown, matemáticas KaTeX, alertas GFM y notas al pie.
 * EN: Core processing pipeline for Markdown, KaTeX math, GFM alerts, and footnotes.
 */
function compileMarkdownPipeline(rawText: string): string {
  // ES: Reinicia el registro de conteo de encabezados al iniciar cada ciclo de procesamiento.
  // EN: Resets the heading count registry at the start of each processing cycle.
  renderHeadingCounts.clear();

  const codePlaceholders: { id: string; raw: string }[] = [];
  const mathPlaceholders: { id: string; html: string }[] = [];
  const footnotePlaceholders: { id: string; html: string }[] = [];

  // ES: 1. Transforma sintaxis de resaltado ==texto== a etiquetas semánticas <mark>.
  // EN: 1. Transforms highlight syntax ==text== to semantic <mark> tags.
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

  // ES: 3. Protege código en línea (`...` o ``...``).
  // EN: 3. Protects inline code (`...` or ``...``).
  processed = processed.replace(
    /(`+)([\s\S]*?[^`])\1(?!`)/g,
    (match) => {
      const id = `%%CODE_INLINE_${codePlaceholders.length}%%`;
      codePlaceholders.push({ id, raw: match });
      return id;
    },
  );

  // ES: 4. Escáner robusto de fórmulas matemáticas (Display Math $$...$$ e Inline Math $...$) consciente de escapes.
  // EN: 4. Escape-aware robust math scanner (Display Math $$...$$ and Inline Math $...$).
  let mathProcessed = "";
  let i = 0;
  const len = processed.length;

  function countBackslashesBefore(pos: number): number {
    let count = 0;
    let p = pos - 1;
    while (p >= 0 && processed[p] === "\\") {
      count++;
      p--;
    }
    return count;
  }

  while (i < len) {
    // ES: Detección de bloque matemático Display Math ($$ ... $$) no escapado.
    // EN: Detection of unescaped block math Display Math ($$ ... $$).
    if (
      processed[i] === "$" &&
      processed[i + 1] === "$" &&
      countBackslashesBefore(i) % 2 === 0
    ) {
      let j = i + 2;
      let foundClosing = false;
      let hasHeaderBreak = false;

      while (j < len - 1) {
        // ES: Si se detecta un encabezado Markdown o separador temático, aborta para evitar devorar el documento.
        // EN: If a Markdown heading or horizontal rule is found, aborts to avoid consuming the document.
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
          countBackslashesBefore(j) % 2 === 0
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

    // ES: Detección de fórmula matemática en línea Inline Math ($ ... $) no escapada.
    // EN: Detection of unescaped inline math formula ($ ... $).
    if (
      processed[i] === "$" &&
      processed[i + 1] !== "$" &&
      countBackslashesBefore(i) % 2 === 0 &&
      processed[i + 1] !== " " &&
      processed[i + 1] !== "\t" &&
      processed[i + 1] !== "\n" &&
      processed[i + 1] !== "\r"
    ) {
      let j = i + 1;
      let foundClosing = false;
      let hasLineBreak = false;

      while (j < len) {
        // ES: Fórmulas en línea no deben cruzar líneas en blanco ni encabezados.
        // EN: Inline math must not cross blank lines or headings.
        if (processed[j] === "\n") {
          if (processed[j + 1] === "\n" || /^#{1,6}\s/.test(processed.slice(j + 1))) {
            hasLineBreak = true;
            break;
          }
        }
        if (
          processed[j] === "$" &&
          processed[j + 1] !== "$" &&
          countBackslashesBefore(j) % 2 === 0
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

  processed = mathProcessed;

  // ES: 5. Procesa definiciones y referencias de notas al pie ([^id]).
  // EN: 5. Processes footnote definitions and references ([^id]).
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

  function sanitizeFootnoteSlug(rawId: string): string {
    return rawId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\-_]/g, "-");
  }

  // ES: Registra el orden de aparición de las referencias en el documento.
  // EN: Records the order of appearance of references in the document.
  const refOrderRegex = /\[\^([^\]]+)\](?!:)/g;
  let refMatch: RegExpExecArray | null;
  while ((refMatch = refOrderRegex.exec(processed)) !== null) {
    getFootnoteNumber(refMatch[1]);
  }

  // ES: Transforma definiciones `[^id]: texto` al inicio de línea en contenedores de nota al pie.
  // EN: Transforms `[^id]: text` definitions at the start of a line into footnote containers.
  processed = processed.replace(
    /(^|\n)\[\^([^\]]+)\]:[ \t]*([^\n]+(?:\n[ \t]+[^\n]+)*)/g,
    (_, leadingNewline: string, rawId: string, rawDef: string) => {
      const num = getFootnoteNumber(rawId);
      const slug = sanitizeFootnoteSlug(rawId);
      const inlineBody = markedInstance.parseInline(rawDef.trim()) as string;
      const placeholderId = `%%FOOTNOTE_ITEM_${footnotePlaceholders.length}%%`;

      footnotePlaceholders.push({
        id: placeholderId,
        html: `<div class="footnote-item" id="fn-${slug}"><span class="footnote-num">[${num}]</span><div class="footnote-body">${inlineBody} <a href="#fnref-${slug}" class="footnote-backref" title="Volver al texto" aria-label="Volver al texto">↩</a></div></div>`,
      });

      return `${leadingNewline}${placeholderId}\n`;
    },
  );

  // ES: Reemplaza referencias en línea `[^id]` por superíndices enlazados.
  // EN: Replaces inline `[^id]` references with linked superscripts.
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

  // ES: 6. Restaura los bloques de código protegidos para su procesamiento en Marked.
  // EN: 6. Restores protected code blocks for processing in Marked.
  for (const item of codePlaceholders) {
    processed = processed.replace(item.id, () => item.raw);
  }

  // ES: 7. Tokeniza y anota líneas fuente para sincronización de scroll entre editor y vista previa.
  // EN: Tokenizes and annotates source lines for scroll sync between editor and preview.
  const tokens = markedInstance.lexer(processed);
  let offset = 0;
  for (const token of tokens) {
    const idx = processed.indexOf(token.raw, offset);
    if (idx !== -1) {
      (token as any).startLine = (processed.slice(0, idx).match(/\n/g) || []).length + 1;
      offset = idx + token.raw.length;
    }
  }
  let html = markedInstance.parser(tokens) as string;

  // ES: 8. Transforma alertas GFM ([!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION]).
  // EN: 8. Transforms GFM alerts ([!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION]).
  html = transformGfmAlerts(html);

  // ES: 9. Etiqueta listas de tareas para presentación e impresión.
  // EN: 9. Tags task lists for display and printing.
  html = enhanceTaskLists(html);

  // ES: 10. Restaura el HTML de las notas al pie procesadas.
  // EN: 10. Restores the HTML of processed footnotes.
  for (const item of footnotePlaceholders) {
    html = html.replace(
      new RegExp(`<p\\b[^>]*>\\s*${item.id}\\s*<\\/p>|${item.id}`, "g"),
      () => item.html,
    );
  }

  // ES: 11. Restaura el HTML de las fórmulas matemáticas KaTeX, evitando anidación inválida de <div> en <p>.
  // EN: 11. Restores the HTML of KaTeX math formulas, preventing invalid nesting of <div> in <p>.
  for (const item of mathPlaceholders) {
    if (item.id.startsWith("%%KATEX_BLOCK_")) {
      html = html.replace(
        new RegExp(`<p\\b[^>]*>\\s*${item.id}\\s*<\\/p>|${item.id}`, "g"),
        () => item.html,
      );
    } else {
      html = html.replace(item.id, () => item.html);
    }
  }

  return html;
}

export type DompurifyConfig = NonNullable<Parameters<typeof DOMPurify.sanitize>[1]>;

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
  ],
};

/**
 * ES: Preprocesa y compila Markdown a HTML plano sin sanitizar (apto para Web Workers).
 * EN: Preprocesses and compiles Markdown to raw HTML without sanitizing (suitable for Web Workers).
 */
export function processMathAndMarkdownRaw(rawText: string): string {
  return compileMarkdownPipeline(rawText);
}

/**
 * ES: Preprocesa, compila y sanitiza el Markdown para su visualización segura en la vista previa.
 * EN: Preprocesses, compiles, and sanitizes Markdown for safe display in the preview.
 */
export function processMathAndMarkdown(rawText: string): string {
  const rawHtml = compileMarkdownPipeline(rawText);
  return DOMPurify.sanitize(rawHtml, DOMPURIFY_CONFIG) as string;
}
