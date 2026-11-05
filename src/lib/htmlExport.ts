/**
 * Utilidades para exportar la vista previa como un documento HTML5 autónomo.
 */

import katexCss from "katex/dist/katex.min.css?raw";
import type { CodeThemeId } from "../types";
import { getPalette, paletteToCssText } from "./codeThemes";

// Fuentes de KaTeX como data URI (carga diferida, funciona sin internet)
const katexFonts = import.meta.glob<string>(
  "/node_modules/katex/dist/fonts/*.woff2",
  { query: "?inline", import: "default" },
);

/**
 * Devuelve el CSS de KaTeX con las fuentes incrustadas (autónomo, sin red).
 */
async function buildKatexCss(): Promise<string> {
  const dataUris = new Map<string, string>();
  await Promise.all(
    Object.entries(katexFonts).map(async ([path, load]) => {
      dataUris.set(path.split("/").pop() ?? path, await load());
    }),
  );
  return katexCss.replace(
    /src:\s*url\(([^)]*?([\w-]+\.woff2))\)\s*format\("woff2"\)[^;}]*/g,
    (match, _url: string, file: string) => {
      const uri = dataUris.get(file);
      return uri ? `src:url(${uri}) format("woff2")` : match;
    },
  );
}

const BASE_CSS = `
:root{--bg:#fff;--text:#1f2328;--muted:#59636e;--border:#d1d9e0;--accent:#1f7a6d;--code-bg:#f6f8fa;--stripe:#f6f8fa}
@media (prefers-color-scheme:dark){:root{--bg:#1e1f22;--text:#e8e6e1;--muted:#9b9a94;--border:#3a3c40;--accent:#5fb3a3;--code-bg:#26282b;--stripe:#232427}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.7 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:820px;margin:0 auto;padding:2.5rem 1.5rem 5rem;word-break:break-word}
h1,h2,h3,h4,h5,h6{line-height:1.3;margin:2em 0 .6em;font-weight:650}
h1{font-size:2em;border-bottom:1px solid var(--border);padding-bottom:.3em;margin-top:0}
h2{font-size:1.5em;border-bottom:1px solid var(--border);padding-bottom:.25em}
h3{font-size:1.25em}
p,ul,ol,blockquote,table,pre{margin:0 0 1em}
a{color:var(--accent)}
img,svg{max-width:100%;height:auto}
blockquote{margin:1em 0;padding:.65em 1.1em;border-left:4px solid var(--accent);background:var(--code-bg);border-radius:0 6px 6px 0;color:var(--muted);font-style:italic}
blockquote blockquote{margin:.55em 0 .25em .75em}
.markdown-alert{margin:1em 0;padding:.75em 1.1em;border-left:4px solid #0969da;border-radius:0 6px 6px 0;background:rgba(9,105,218,.08)}
.markdown-alert-title{display:flex;align-items:center;gap:.45em;font-weight:650;margin-bottom:.35em}
.markdown-alert-note{border-left-color:#0969da}.markdown-alert-note .markdown-alert-title{color:#0969da}
.markdown-alert-tip{border-left-color:#1a7f37;background:rgba(26,127,55,.08)}.markdown-alert-tip .markdown-alert-title{color:#1a7f37}
.markdown-alert-important{border-left-color:#8250df;background:rgba(130,80,223,.08)}.markdown-alert-important .markdown-alert-title{color:#8250df}
.markdown-alert-warning{border-left-color:#d97706;background:rgba(217,119,6,.09)}.markdown-alert-warning .markdown-alert-title{color:#d97706}
.markdown-alert-caution{border-left-color:#cf222e;background:rgba(207,34,46,.09)}.markdown-alert-caution .markdown-alert-title{color:#cf222e}
ul,ol{padding-left:1.6em}
ul.contains-task-list{padding-left:.4em}
li.task-list-item{list-style:none}
li>input[type=checkbox]{margin-right:.5em}
details{margin:1em 0;padding:.7em 1em;border:1px solid var(--border);border-radius:6px;background:var(--code-bg)}
details summary{font-weight:600;cursor:pointer}
.footnote-ref a{font-size:.78em;font-weight:600;text-decoration:none}
.footnote-item{display:flex;align-items:baseline;gap:.5em;font-size:.9em;margin:.4em 0;padding:.45em .75em;background:var(--code-bg);border-left:3px solid var(--accent);border-radius:0 4px 4px 0}
.footnote-num{font-weight:700;color:var(--accent)}
hr{border:0;border-top:1px solid var(--border);margin:2em 0}
code{font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.88em}
:not(pre)>code{background:var(--code-bg);padding:.15em .4em;border-radius:5px}
.code-block-wrapper{border:1px solid var(--code-border);border-radius:8px;overflow:hidden;margin:0 0 1em;background:var(--code-bg)}
.code-lang-label{display:block;padding:.3rem .8rem;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--tok-comment);border-bottom:1px solid var(--code-border)}
pre{background:var(--code-bg);color:var(--code-fg);padding:1rem;overflow:auto;margin:0}
pre code{font-size:.85em}
table{border-collapse:collapse;display:block;overflow:auto;width:max-content;max-width:100%}
th,td{border:1px solid var(--border);padding:.45em .8em}
th{background:var(--stripe);font-weight:600}
tr:nth-child(even) td{background:var(--stripe)}
.katex-display-wrapper{overflow-x:auto;margin:1em 0}
.mermaid-container{margin:1em 0;text-align:center;overflow-x:auto}
.hljs{color:var(--tok-base)}
.hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-doctag{color:var(--tok-keyword)}
.hljs-built_in,.hljs-type,.hljs-meta,.hljs-class .hljs-title,.hljs-title.class_{color:var(--tok-type)}
.hljs-title,.hljs-function,.hljs-section{color:var(--tok-function)}
.hljs-variable,.hljs-template-variable,.hljs-params,.hljs-property,.hljs-symbol,.hljs-selector-id,.hljs-selector-class{color:var(--tok-variable)}
.hljs-attr,.hljs-attribute,.hljs-name{color:var(--tok-attr)}
.hljs-tag{color:var(--tok-tag)}
.hljs-string{color:var(--tok-string)}
.hljs-number,.hljs-bullet,.hljs-addition{color:var(--tok-number)}
.hljs-regexp,.hljs-link,.hljs-deletion{color:var(--tok-regexp)}
.hljs-comment,.hljs-quote{color:var(--tok-comment);font-style:italic}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:700}
@media print{main{max-width:none;padding:0}}
`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Limpia el DOM de la vista previa de elementos interactivos (copiar, zoom, etc.).
 */
export function cleanPreviewHtml(article: HTMLElement): string {
  const clone = article.cloneNode(true) as HTMLElement;

  clone
    .querySelectorAll(".code-copy-btn, .mermaid-header-bar, .mermaid-syntax-notice")
    .forEach((el) => el.remove());

  clone.querySelectorAll("input[type=checkbox]").forEach((el) => {
    const input = el as HTMLInputElement;
    input.setAttribute("disabled", "");
    if (input.checked) input.setAttribute("checked", "");
    input.removeAttribute("data-task-index");
    input.removeAttribute("data-bound");
    input.removeAttribute("class");
  });

  clone.querySelectorAll("svg").forEach((svg) => {
    svg.style.removeProperty("max-width");
  });

  return clone.innerHTML;
}

/**
 * Construye un documento HTML5 completo y autónomo (sin recursos externos).
 */
export async function buildHtmlDocument(
  title: string,
  bodyHtml: string,
  codeTheme: CodeThemeId,
): Promise<string> {
  const safeTitle = escapeHtml(title);
  const light = paletteToCssText(getPalette(codeTheme, false));
  const dark = paletteToCssText(getPalette(codeTheme, true));
  const themeCss = `:root{${light}}@media (prefers-color-scheme:dark){:root{${dark}}}`;
  const katex = bodyHtml.includes('class="katex')
    ? await buildKatexCss()
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<style>${katex}</style>
<style>${BASE_CSS}${themeCss}</style>
</head>
<body>
<main>
${bodyHtml}
</main>
</body>
</html>
`;
}

/**
 * Descarga un texto como archivo.
 */
export function downloadTextFile(
  filename: string,
  content: string,
  mime: string,
): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

