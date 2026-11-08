/**
 * ES: Utilidades de cálculo y sincronización de desplazamiento vertical del editor.
 * EN: Utilities for vertical editor scroll computation and line synchronization.
 */

import type { EditorView } from "@codemirror/view";

/**
 * ES: Obtiene el número de línea visible en la parte superior del editor y la fracción de desplazamiento dentro de ella.
 * EN: Retrieves the visible line number at the top of the editor and the scroll fraction within it.
 */
export function getEditorVisibleLineRange(view: EditorView | null): {
  line: number;
  fraction: number;
} | null {
  if (!view || !view.scrollDOM) return null;
  const top = view.scrollDOM.scrollTop;
  const maxScroll = view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight;
  if (maxScroll <= 0) return { line: 1, fraction: 0 };

  if (top <= 2) {
    return { line: 1, fraction: 0 };
  }

  if (top >= maxScroll - 4) {
    return { line: view.state.doc.lines, fraction: 1 };
  }

  try {
    const block = view.lineBlockAtHeight(top);
    const lineObj = view.state.doc.lineAt(block.from);
    const height = Math.max(1, block.bottom - block.top);
    const fraction = Math.max(0, Math.min(1, (top - block.top) / height));
    return { line: lineObj.number, fraction };
  } catch {
    return null;
  }
}

/**
 * ES: Desplaza el editor a la línea de origen especificada con la fracción vertical deseada de forma suave y precisa.
 * EN: Scrolls the editor to the specified source line with the desired vertical fraction smoothly and accurately.
 */
export function scrollEditorToSourceLine(
  view: EditorView | null,
  targetLine: number,
  fraction = 0,
): void {
  if (!view || !view.scrollDOM) return;
  try {
    const maxScroll = view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight;
    if (maxScroll <= 0) return;

    if (targetLine <= 1 && fraction <= 0) {
      view.scrollDOM.scrollTop = 0;
      return;
    }

    const totalLines = view.state.doc.lines;
    if (targetLine >= totalLines && fraction >= 1) {
      view.scrollDOM.scrollTop = maxScroll;
      return;
    }

    const safeLine = Math.max(1, Math.min(targetLine, totalLines));
    const lineObj = view.state.doc.line(safeLine);
    const block = view.lineBlockAt(lineObj.from);
    const height = Math.max(1, block.bottom - block.top);
    const targetTop = block.top + Math.max(0, Math.min(1, fraction)) * height;
    view.scrollDOM.scrollTop = Math.min(targetTop, maxScroll);
  } catch {
    // ES: Ignora en caso de desfase momentáneo de documento.
    // EN: Ignores in case of momentary document offset mismatch.
  }
}

