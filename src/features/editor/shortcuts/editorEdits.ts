/**
 * ES: Transformaciones de texto del editor (inline, prefijos de línea y bloques) basadas en snippets.
 * EN: Editor text transformations (inline, line prefixes and blocks) built on snippets.
 */

import type { EditorView } from "@codemirror/view";
import { applySnippet, type SnippetPart } from "./snippetFields";

export interface SlashRange {
  from: number;
  to: number;
}

/**
 * ES: Segundo campo opcional tras el sufijo (por ejemplo la URL de un enlace).
 * EN: Optional second field after the suffix (for example a link URL).
 */
export interface InlineTail {
  ph: string;
  close: string;
}

/**
 * ES: Envuelve la selección con prefijo/sufijo (alterna si ya estaba envuelta) o inserta un placeholder editable.
 * EN: Wraps the selection with prefix/suffix (toggles if already wrapped) or inserts an editable placeholder.
 */
export function wrapInline(
  view: EditorView,
  prefix: string,
  suffix: string,
  placeholder: string,
  slashRange?: SlashRange,
  tail?: InlineTail,
): boolean {
  const { state } = view;
  const { from, to } = slashRange ?? state.selection.main;
  const selected = slashRange ? "" : state.sliceDoc(from, to);

  // ES: Alternar: quitar marcas si la selección ya está envuelta (solo sin campo extra).
  // EN: Toggle: remove markers if the selection is already wrapped (only without extra field).
  if (!tail && selected) {
    const around =
      state.sliceDoc(Math.max(0, from - prefix.length), from) === prefix &&
      state.sliceDoc(to, to + suffix.length) === suffix;
    if (around) {
      view.dispatch({
        changes: [
          { from: from - prefix.length, to: from },
          { from: to, to: to + suffix.length },
        ],
        selection: { anchor: from - prefix.length, head: to - prefix.length },
      });
      view.focus();
      return true;
    }
  }

  const parts: SnippetPart[] = [prefix, { ph: selected || placeholder }, suffix];
  if (tail) parts.push({ ph: tail.ph }, tail.close);
  // ES: Con texto ya seleccionado, el foco va directo al campo extra (URL).
  // EN: With text already selected, focus goes straight to the extra field (URL).
  return applySnippet(view, from, to, parts, tail && selected ? 1 : 0);
}

/**
 * ES: Pone o alterna un prefijo de línea (#, -, 1., >, - [ ]) quitando marcas previas de encabezado o lista.
 * EN: Sets or toggles a line prefix (#, -, 1., >, - [ ]) stripping prior heading or list markers.
 */
export function setLinePrefix(view: EditorView, prefix: string, slashRange?: SlashRange): boolean {
  const { state } = view;
  const pos = slashRange ? slashRange.from : state.selection.main.from;
  const line = state.doc.lineAt(pos);

  let content = line.text;
  if (slashRange) {
    content =
      content.slice(0, Math.max(0, slashRange.from - line.from)) +
      content.slice(Math.min(content.length, slashRange.to - line.from));
  }

  const sameAlready = !slashRange && content.startsWith(prefix);
  const cleaned = sameAlready
    ? content.slice(prefix.length)
    : content
      .replace(/^#{1,6}\s+/, "")
      .replace(/^[-*+]\s+(\[[ xX]\]\s+)?/, "")
      .replace(/^\d+\.\s+/, "")
      .trimStart();
  const next = sameAlready ? cleaned : `${prefix}${cleaned}`;

  view.dispatch({
    changes: { from: line.from, to: line.to, insert: next },
    selection: { anchor: line.from + next.length },
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

/**
 * ES: Inserta un bloque (código, tabla, fórmula, diagrama) con saltos limpios y campos editables.
 * EN: Inserts a block (code, table, math, diagram) with clean line breaks and editable fields.
 */
export function insertBlock(view: EditorView, parts: SnippetPart[], slashRange?: SlashRange): boolean {
  const { state } = view;
  const line = state.doc.lineAt(slashRange ? slashRange.from : state.selection.main.head);

  let from = line.from;
  let to = line.to;
  let lead = "";

  if (slashRange) {
    const before = line.text.slice(0, slashRange.from - line.from).trim();
    const after = line.text.slice(slashRange.to - line.from).trim();
    // ES: Si la línea solo tenía el slash se reemplaza entera; si no, el bloque baja a otra línea.
    // EN: If the line only held the slash it is replaced; otherwise the block drops to a new line.
    if (before || after) {
      from = slashRange.from;
      to = slashRange.to;
      lead = "\n";
    }
  } else if (line.text.trim() !== "") {
    from = to = line.to;
    lead = "\n\n";
  }

  return applySnippet(view, from, to, lead ? [lead, ...parts] : parts);
}

