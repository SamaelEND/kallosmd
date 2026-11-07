/**
 * ES: Gesto de entrada a edición y confinamiento de selección para bloques de Live Preview:
 *     un clic corto entra al bloque; arrastrar o seleccionar dentro de un bloque limita la
 *     selección estrictamente al interior del bloque.
 * EN: Edit-entry gesture and selection confinement for Live Preview blocks:
 *     a short click enters the block; dragging or selecting inside a block confines the
 *     selection strictly to the interior of the block.
 */

import { EditorSelection, EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { scanMultilineBlocksFromDoc } from "./liveBlockScanner";
import { liveRawModeField } from "./liveSheetFrame";

/** ES: Desplazamiento máximo (px) para considerar el gesto como clic. EN: Max movement (px) to count as a click. */
const CLICK_MOVE_TOLERANCE_PX = 5;
/** ES: Duración máxima (ms) de un clic corto. EN: Max duration (ms) of a short click. */
const CLICK_MAX_DURATION_MS = 350;
/** ES: Elementos interactivos que conservan su comportamiento propio. EN: Interactive elements keeping their own behavior. */
const INTERACTIVE_SELECTOR = "summary, a, button, input";

/**
 * ES: Coloca el cursor en `pos` dentro del bloque y lo mantiene visible sin mover el contenido superior.
 * EN: Places the cursor at `pos` inside the block and keeps it visible without shifting upper content.
 */
export function enterBlockAt(view: EditorView, pos: number): void {
  const safePos = Math.max(0, Math.min(pos, view.state.doc.length));
  view.dispatch({
    selection: { anchor: safePos },
    effects: EditorView.scrollIntoView(safePos, { y: "nearest", yMargin: 40 }),
  });
  view.focus();
}

/**
 * ES: Vincula el gesto de clic corto a un elemento y aísla la selección por arrastre dentro del widget.
 * EN: Binds the short-click gesture to an element and isolates drag selection inside the widget.
 */
export function attachClickToEdit(
  el: HTMLElement,
  view: EditorView,
  resolvePos: (e: MouseEvent) => number,
): void {
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let tracking = false;

  el.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
    // ES: Evita que CodeMirror propague el arrastre fuera de la tarjeta renderizada.
    // EN: Prevents CodeMirror from propagating drag selection outside the rendered card.
    e.stopPropagation();
    startX = e.clientX;
    startY = e.clientY;
    startTime = performance.now();
    tracking = true;
  });

  el.addEventListener("mouseup", (e) => {
    if (!tracking) return;
    tracking = false;
    if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;

    const moved = Math.hypot(e.clientX - startX, e.clientY - startY) > CLICK_MOVE_TOLERANCE_PX;
    const held = performance.now() - startTime > CLICK_MAX_DURATION_MS;
    const selection = window.getSelection();
    const hasTextSelection = !!selection && !selection.isCollapsed && el.contains(selection.anchorNode);
    if (moved || held || hasTextSelection) return;

    enterBlockAt(view, resolvePos(e));
  });
}

/**
 * ES: Filtro de transacciones que confina la selección de texto al interior del bloque multilínea activo.
 * EN: Transaction filter that confines text selection to the interior of the active multiline block.
 */
export const blockSelectionClampFilter: Extension = EditorState.transactionFilter.of((tr) => {
  if (!tr.selection || tr.docChanged) return tr;
  if (tr.startState.field(liveRawModeField, false)) return tr;

  const newMain = tr.selection.main;
  // ES: Un clic simple (cursor colapsado) siempre permite entrar o salir libremente del bloque.
  // EN: A single click (collapsed cursor) always allows freely entering or leaving the block.
  if (newMain.empty) return tr;

  const doc = tr.startState.doc;
  const prevMain = tr.startState.selection.main;
  const lineToBlock = scanMultilineBlocksFromDoc(doc);

  const prevStartLn = doc.lineAt(prevMain.from).number;
  const prevEndLn = doc.lineAt(prevMain.to).number;
  const activeBlk = lineToBlock.get(prevStartLn);

  if (
    !activeBlk ||
    activeBlk.endLine <= activeBlk.startLine ||
    lineToBlock.get(prevEndLn) !== activeBlk
  ) {
    return tr;
  }

  const blkFrom = doc.line(activeBlk.startLine).from;
  const blkTo = doc.line(activeBlk.endLine).to;

  // ES: Si la selección nació dentro del bloque o es un Seleccionar Todo (Ctrl+A), la limita al bloque.
  // EN: If the selection started inside the block or is a Select All (Ctrl+A), clamp it to the block.
  const anchorInBlock = newMain.anchor >= blkFrom && newMain.anchor <= blkTo;
  const isSelectAll = newMain.from === 0 && newMain.to === doc.length;
  if (!anchorInBlock && !isSelectAll) return tr;

  const clampedAnchor = isSelectAll
    ? blkFrom
    : Math.max(blkFrom, Math.min(blkTo, newMain.anchor));
  const clampedHead = isSelectAll
    ? blkTo
    : Math.max(blkFrom, Math.min(blkTo, newMain.head));

  if (clampedAnchor === newMain.anchor && clampedHead === newMain.head) {
    return tr;
  }

  return [
    tr,
    {
      selection: EditorSelection.single(clampedAnchor, clampedHead),
    },
  ];
});

