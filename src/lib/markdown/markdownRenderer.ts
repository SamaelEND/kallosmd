/**
 * ES: Motor de procesamiento y sanitización de Markdown, alertas GFM, notas al pie, KaTeX y Highlight.js.
 * EN: Markdown processing and sanitization engine with GFM alerts, footnotes, KaTeX, and Highlight.js.
 */

import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/common";
import katex from "katex";
import { Marked } from "marked";
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
    heading({ depth, text }) {
      const slug = generateHeadingSlug(text, renderHeadingCounts);
      return `<h${depth} id="${slug}">${text}</h${depth}>\n`;
    },
    code({ text, lang }) {
      if (lang === "mermaid") {
        return `<div class="mermaid-container" data-mermaid-code="${encodeURIComponent(text)}"></div>\n`;
      }

      const rawLang = lang ? lang.trim().toLowerCase().split(/\s+/)[0] : "";
      const displayLang = rawLang.replace(/[^a-z0-9\-_+#]/g, "") || "texto";

      // ES: Resalta el código según el lenguaje especificado o escapa el texto plano.
      // EN: Highlights code using the specified language or escapes plain text.
      let highlightedCode = "";
      try {
        if (rawLang && hljs.getLanguage(rawLang)) {
          highlightedCode = hljs.highlight(text, {
            language: rawLang,
            ignoreIllegals: true,
          }).value;
        } else {
          highlightedCode = escapeHtmlText(text);
        }
      } catch {
        highlightedCode = escapeHtmlText(text);
      }

      return `
        <div class="code-block-wrapper">
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
    /<blockquote>\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<br\s*\/?>\s*)?([\s\S]*?)<\/blockquote>/gi,
    (match, rawType: string, restHtml: string) => {
      const alertKey = rawType.toUpperCase();
      const meta = GFM_ALERT_MAP[alertKey];
      if (!meta) return match;

      const bodyHtml = `<p>${restHtml}`.replace(/<p>\s*<\/p>/g, "").trim();

      return `
        <div class="markdown-alert ${meta.className}" role="note">
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
 * ES: Preprocesa expresiones KaTeX, notas al pie y alertas GFM antes y después de Marked, y sanitiza el HTML con DOMPurify.
 * EN: Preprocesses KaTeX expressions, footnotes, and GFM alerts before and after Marked, and sanitizes the HTML with DOMPurify.
 */
export function processMathAndMarkdown(rawText: string): string {
  // ES: Reinicia el registro de conteo de encabezados al iniciar cada ciclo de procesamiento.
  // EN: Resets the heading count registry at the start of each processing cycle.
  renderHeadingCounts.clear();

  const codePlaceholders: { id: string; raw: string }[] = [];
  const mathPlaceholders: { id: string; html: string }[] = [];
  const footnotePlaceholders: { id: string; html: string }[] = [];
  let processed = rawText;

  // ES: 1. Protege bloques de código cercados (``` o ~~~) y código en línea (`...`) durante el preprocesamiento.
  // EN: 1. Protects fenced code blocks (``` or ~~~) and inline code (`...`) during preprocessing.
  processed = processed.replace(
    /(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2[ \t]*(?=\n|$)/g,
    (match, prefix) => {
      const block = prefix ? match.slice(prefix.length) : match;
      const id = `%%CODE_BLOCK_${codePlaceholders.length}%%`;
      codePlaceholders.push({ id, raw: block });
      return `${prefix}${id}`;
    },
  );

  processed = processed.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (match) => {
    const id = `%%CODE_INLINE_${codePlaceholders.length}%%`;
    codePlaceholders.push({ id, raw: match });
    return id;
  });

  // ES: 2. Renderiza y protege fórmulas matemáticas en bloque ($$ ... $$).
  // EN: 2. Renders and protects block math formulas ($$ ... $$).
  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    const id = `%%KATEX_BLOCK_${mathPlaceholders.length}%%`;
    try {
      const rendered = katex.renderToString(math.trim(), {
        displayMode: true,
        throwOnError: false,
      });
      mathPlaceholders.push({
        id,
        html: `<div class="katex-display-wrapper">${rendered}</div>`,
      });
    } catch {
      mathPlaceholders.push({
        id,
        html: `<div class="katex-error">$$${escapeHtmlText(math)}$$</div>`,
      });
    }
    return id;
  });

  // ES: 3. Renderiza y protege fórmulas matemáticas en línea ($ ... $), ignorando importes monetarios simples.
  // EN: 3. Renders and protects inline math formulas ($ ... $), ignoring simple currency amounts.
  processed = processed.replace(
    /(^|[^\\$])\$(?!\$)([^\$\n\r]+?)\$(?!\$|\d)/g,
    (match, prefix, math) => {
      const trimmed = math.trim();
      if (!trimmed) return match;

      // ES: Ignora cantidades numéricas simples con formato de moneda ($10, $10.50).
      // EN: Ignores simple numeric currency amounts ($10, $10.50).
      if (/^\d+([.,]\d{1,2})?$/.test(trimmed)) {
        return match;
      }

      // ES: Verifica operadores o funciones matemáticas cuando existen espacios en ambos extremos.
      // EN: Checks for math operators or functions when spaces exist on both ends.
      if (
        /^\s/.test(math) &&
        /\s$/.test(math) &&
        !/[\\^_{}=<>+\-*/~]|Mach|\b(sin|cos|tan|log|ln|sqrt|lim|sum|int)\b/.test(
          trimmed,
        )
      ) {
        return match;
      }

      const id = `%%KATEX_INLINE_${mathPlaceholders.length}%%`;
      try {
        const rendered = katex.renderToString(trimmed, {
          displayMode: false,
          throwOnError: false,
        });
        mathPlaceholders.push({ id, html: rendered });
      } catch {
        mathPlaceholders.push({
          id,
          html: `<span class="katex-error">$${escapeHtmlText(math)}$</span>`,
        });
      }
      return prefix + id;
    },
  );

  // ES: 4. Procesa definiciones y referencias de notas al pie ([^id]).
  // EN: 4. Processes footnote definitions and references ([^id]).
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

  // ES: 5. Restaura los bloques de código protegidos para su procesamiento en Marked.
  // EN: 5. Restores protected code blocks for processing in Marked.
  for (const item of codePlaceholders) {
    processed = processed.replace(item.id, () => item.raw);
  }

  // ES: 6. Compila el documento Markdown a HTML mediante Marked.
  // EN: 6. Compiles the Markdown document to HTML using Marked.
  let html = markedInstance.parse(processed) as string;

  // ES: 7. Transforma alertas GFM ([!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION]).
  // EN: 7. Transforms GFM alerts ([!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION]).
  html = transformGfmAlerts(html);

  // ES: 8. Etiqueta listas de tareas para presentación e impresión.
  // EN: 8. Tags task lists for display and printing.
  html = enhanceTaskLists(html);

  // ES: 9. Restaura el HTML de las notas al pie procesadas.
  // EN: 9. Restores the HTML of processed footnotes.
  for (const item of footnotePlaceholders) {
    html = html.replace(
      new RegExp(`<p>\\s*${item.id}\\s*<\\/p>|${item.id}`, "g"),
      () => item.html,
    );
  }

  // ES: 10. Restaura el HTML de las fórmulas matemáticas KaTeX.
  // EN: 10. Restores the HTML of KaTeX math formulas.
  for (const item of mathPlaceholders) {
    html = html.replace(item.id, () => item.html);
  }

  // ES: 11. Sanitiza el HTML resultante permitiendo etiquetas semánticas, alertas SVG, details y MathML/KaTeX.
  // EN: 11. Sanitizes the resulting HTML allowing semantic tags, SVG alerts, details, and MathML/KaTeX.
  return DOMPurify.sanitize(html, {
    ADD_TAGS: [
      "input",
      "details",
      "summary",
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
    ],
    ADD_ATTR: [
      "class",
      "style",
      "data-mermaid-code",
      "data-task-index",
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
    ],
  });
}
