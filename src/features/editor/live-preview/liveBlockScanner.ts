/**
 * ES: Escáner de bloques multilínea para el modo Live Preview en CodeMirror 6.
 *     Identifica bloques cercados (``` / ~~~), diagramas Mermaid, fórmulas KaTeX ($$...$$),
 *     desplegables <details>, citas/alertas GFM y tablas GFM estructuradas.
 * EN: Multiline block scanner for Live Preview mode in CodeMirror 6.
 *     Identifies fenced blocks (``` / ~~~), Mermaid diagrams, KaTeX formulas ($$...$$),
 *     <details> disclosures, GFM quotes/alerts, and structured GFM tables.
 */

import { type Text } from "@codemirror/state";
import { type EditorView } from "@codemirror/view";
import { Marked } from "marked";

/**
 * ES: Descriptor de un bloque multilínea con su tipo y rango de líneas.
 * EN: Multiline block descriptor with its kind and line range.
 */
export interface BlockSpan {
  kind: "mermaid" | "code" | "math" | "table" | "quote" | "details";
  startLine: number;
  endLine: number;
  lang?: string;
}

const tableScannerLexer = new Marked({ gfm: true });

/**
 * ES: Extrae fragmentos de texto del documento entre dos números de línea inclusivos.
 * EN: Extracts text slices from document between two inclusive line numbers.
 */
export function sliceLines(
  view: EditorView,
  startLine: number,
  endLine: number,
): string {
  const out: string[] = [];
  for (let l = startLine; l <= endLine; l++) {
    out.push(view.state.doc.line(l).text);
  }
  return out.join("\n");
}

/**
 * ES: Escanea el texto del documento para encontrar tablas GFM mediante el lexer oficial de Marked.
 * EN: Scans document text for GFM tables using the official Marked lexer.
 */
function scanTablesWithLexer(
  docText: string,
): Array<{ from: number; to: number }> {
  const tokens = tableScannerLexer.lexer(docText);
  const tables: Array<{ from: number; to: number }> = [];
  let offset = 0;

  for (const token of tokens) {
    const from = offset;
    offset += token.raw.length;
    const to = offset;

    if (token.type === "table") {
      tables.push({ from, to });
    }
  }

  return tables;
}

/**
 * ES: Escanea todos los bloques multilínea de un documento y construye un mapa de línea a BlockSpan.
 * EN: Scans all multiline blocks of a document and builds a line-to-BlockSpan map.
 */
export function scanMultilineBlocksFromDoc(doc: Text): Map<number, BlockSpan> {
  const lineToBlock = new Map<number, BlockSpan>();
  const docText = doc.toString();

  // ES: Detección estándar y precisa de tablas GFM vía lexer de Marked.
  // EN: Standard and accurate detection of GFM tables via Marked lexer.
  const tableRanges = scanTablesWithLexer(docText);
  for (const tbl of tableRanges) {
    const startLine = doc.lineAt(tbl.from).number;
    const endLine = doc.lineAt(Math.max(tbl.from, tbl.to - 1)).number;
    const span: BlockSpan = { kind: "table", startLine, endLine };
    for (let ln = startLine; ln <= endLine; ln++) {
      lineToBlock.set(ln, span);
    }
  }

  // ES: Detección de bloques multilínea restantes línea por línea.
  // EN: Line-by-line detection of remaining multiline blocks.
  for (let i = 1; i <= doc.lines; i++) {
    const existing = lineToBlock.get(i);
    if (existing && existing.kind === "table") {
      i = existing.endLine;
      continue;
    }

    const text = doc.line(i).text;

    // ES: Bloques cercados ```lang o ~~~lang (incluyendo ```mermaid).
    // EN: Fenced blocks ```lang or ~~~lang (including ```mermaid).
    const fence = text.match(/^\s*(`{3,}|~{3,})([\w-]*)\s*$/);
    if (fence) {
      const closeRe = new RegExp(`^\\s*${fence[1][0]}{${fence[1].length},}\\s*$`);
      const lang = (fence[2] || "").toLowerCase();
      const startLine = i++;
      while (i <= doc.lines && !closeRe.test(doc.line(i).text)) i++;
      const endLine = Math.min(i, doc.lines);
      const kind = lang === "mermaid" ? "mermaid" : "code";
      const span: BlockSpan = { kind, startLine, endLine, lang: fence[2] || "" };
      for (let ln = startLine; ln <= endLine; ln++) lineToBlock.set(ln, span);
      continue;
    }

    // ES: Bloques matemáticos $$ ... $$ (monolínea o multilínea).
    // EN: Mathematical blocks $$ ... $$ (single-line or multiline).
    if (/^\s*\$\$/.test(text)) {
      const startLine = i;
      const singleLine = /^\s*\$\$.+\$\$\s*$/.test(text);
      if (!singleLine) {
        i++;
        while (i <= doc.lines && !/\$\$\s*$/.test(doc.line(i).text)) i++;
      }
      const endLine = Math.min(i, doc.lines);
      const span: BlockSpan = { kind: "math", startLine, endLine };
      for (let ln = startLine; ln <= endLine; ln++) lineToBlock.set(ln, span);
      continue;
    }

    // ES: Desplegables HTML5 <details> ... </details>.
    // EN: HTML5 <details> ... </details> disclosures.
    if (/^\s*<details\b/i.test(text)) {
      const startLine = i++;
      while (i <= doc.lines && !/^\s*<\/details>/i.test(doc.line(i).text)) i++;
      const endLine = Math.min(i, doc.lines);
      const span: BlockSpan = { kind: "details", startLine, endLine };
      for (let ln = startLine; ln <= endLine; ln++) lineToBlock.set(ln, span);
      continue;
    }

    // ES: Citas y Alertas GFM (> [!NOTE], citas anidadas).
    // EN: Quotes and GFM Alerts (> [!NOTE], nested blockquotes).
    if (/^\s*>/.test(text)) {
      const startLine = i;
      while (i + 1 <= doc.lines && /^\s*>/.test(doc.line(i + 1).text)) i++;
      const span: BlockSpan = { kind: "quote", startLine, endLine: i };
      for (let ln = startLine; ln <= i; ln++) lineToBlock.set(ln, span);
      continue;
    }

    // ES: Grupos de definiciones de notas al pie ([^id]: texto).
    // EN: Groups of footnote definitions ([^id]: text).
    if (/^\s*\[\^[^\]]+\]:\s+/.test(text)) {
      const startLine = i;
      while (i + 1 <= doc.lines) {
        const nextText = doc.line(i + 1).text;
        if (/^\s*\[\^[^\]]+\]:\s+/.test(nextText)) {
          i++;
        } else if (
          nextText.trim().length === 0 &&
          i + 2 <= doc.lines &&
          /^\s*\[\^[^\]]+\]:\s+/.test(doc.line(i + 2).text)
        ) {
          i += 2;
        } else {
          break;
        }
      }
      const span: BlockSpan = { kind: "details", startLine, endLine: i };
      for (let ln = startLine; ln <= i; ln++) lineToBlock.set(ln, span);
    }
  }

  return lineToBlock;
}

/**
 * ES: Escanea todos los bloques multilínea de la vista activa y construye un mapa de línea a BlockSpan.
 * EN: Scans all multiline blocks of active view and builds a line-to-BlockSpan map.
 */
export function scanMultilineBlocks(view: EditorView): Map<number, BlockSpan> {
  return scanMultilineBlocksFromDoc(view.state.doc);
}
