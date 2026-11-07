/**
 * ES: Motor reactivo de Live Preview para CodeMirror 6.
 *     Orquesta decoraciones de líneas, bloques complejos y gestión de estabilidad.
 * EN: Reactive Live Preview engine for CodeMirror 6.
 *     Orchestrates line decorations, complex blocks, and stability management.
 */

import { StateEffect, type Extension, type Range } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { scanMultilineBlocks, sliceLines, type BlockSpan } from "./liveBlockScanner";
import { blockSelectionClampFilter } from "./liveClickToEdit";
import { addInlineDecorations } from "./liveInlineDecorations";
import { dedentBlock, LIST_INDENT_EM, listDepth } from "./liveListUtils";
import { createLiveSheetFrameExtension, liveRawModeField } from "./liveSheetFrame";
import { livePreviewTheme } from "./liveTheme";
import {
  BulletPointWidget,
  EmptyLinePlaceholderWidget,
  HrDividerWidget,
  LiveMermaidWidget,
  LiveRenderedBlockWidget,
  TaskCheckboxWidget,
} from "./liveWidgets";

/**
 * ES: Efecto interno para solicitar el recálculo de decoraciones al finalizar gestos asíncronos.
 * EN: Internal effect to request decoration recalculation when asynchronous gestures end.
 */
const refreshLiveEffect = StateEffect.define<null>();

/**
 * ES: Estado transitorio de estabilidad para congelación y debounce en la vista.
 * EN: Transient stability state for freezing and debouncing in the view.
 */
interface LiveStabilityState {
  isPointerDown: boolean;
  isNavigatingFast: boolean;
  frozenBlockLines: Set<number> | null;
}

/**
 * ES: Resultado del cálculo de decoraciones y líneas de bloques activas.
 * EN: Result of decorations computation and active block start lines.
 */
interface LiveDecorationResult {
  decos: DecorationSet;
  activeBlockStartLines: Set<number>;
}

/**
 * ES: Determina qué líneas y bloques deben mostrarse en código crudo según el cursor y la selección.
 * EN: Determines which lines and blocks should be shown as raw code based on cursor and selection.
 */
function calculateActiveLines(
  view: EditorView,
  lineToBlock: Map<number, BlockSpan>,
  stability?: LiveStabilityState,
): { activeLines: Set<number>; activeBlockStartLines: Set<number> } {
  const doc = view.state.doc;
  const activeLines = new Set<number>();
  const activeBlockStartLines = new Set<number>();

  for (const r of view.state.selection.ranges) {
    if (r.empty) {
      const pos = r.head;
      const curLine = doc.lineAt(pos).number;
      const blk = lineToBlock.get(curLine);

      if (blk && blk.endLine > blk.startLine) {
        // ES: El cursor en cualquier línea del bloque (incluidas la apertura y el cierre) revela su fuente.
        // EN: A cursor on any line of the block (including opening and closing lines) reveals its source.
        activeBlockStartLines.add(blk.startLine);
        for (let b = blk.startLine; b <= blk.endLine; b++) activeLines.add(b);
      } else {
        activeLines.add(curLine);
      }
    } else {
      const sLn = doc.lineAt(r.from).number;
      const eLn = doc.lineAt(r.to).number;
      const startBlk = lineToBlock.get(sLn);
      const sameBlock = !!startBlk && startBlk === lineToBlock.get(eLn) && startBlk.endLine > startBlk.startLine;

      // ES: Una selección que abarca varias líneas deja todo renderizado (copiar devuelve el Markdown fuente).
      //     Solo se revela la línea o el bloque cuando la selección vive dentro de una línea o de un único bloque.
      // EN: A selection spanning several lines keeps everything rendered (copy returns the source Markdown).
      //     Only the line or block is revealed when the selection lives inside one line or one single block.
      if (sLn === eLn || sameBlock) {
        if (startBlk && startBlk.endLine > startBlk.startLine) {
          activeBlockStartLines.add(startBlk.startLine);
          for (let b = startBlk.startLine; b <= startBlk.endLine; b++) activeLines.add(b);
        } else {
          activeLines.add(sLn);
        }
      }
    }
  }

  // ES: Congelación de bloques únicamente durante arrastre con selección activa (!empty).
  //     Un clic simple colapsado cambia de bloque de inmediato sin requerir doble clic.
  // EN: Block freezing strictly during active drag selection (!empty).
  //     A single collapsed click switches blocks immediately without requiring a double click.
  const hasRangeSelection = view.state.selection.ranges.some((r) => !r.empty);
  if (stability?.isPointerDown && hasRangeSelection && stability.frozenBlockLines) {
    const filtered = new Set<number>();
    for (let ln = 1; ln <= doc.lines; ln++) {
      const blk = lineToBlock.get(ln);
      if (blk && blk.endLine > blk.startLine) {
        if (stability.frozenBlockLines.has(blk.startLine)) {
          filtered.add(ln);
        }
      } else if (activeLines.has(ln)) {
        filtered.add(ln);
      }
    }
    return { activeLines: filtered, activeBlockStartLines };
  }

  return { activeLines, activeBlockStartLines };
}

/**
 * ES: Construye el conjunto de decoraciones reactivas para todo el documento visible.
 * EN: Builds the reactive decoration set for the entire visible document.
 */
function buildLiveDecorations(
  view: EditorView,
  stability?: LiveStabilityState,
): LiveDecorationResult {
  // ES: Cuando el usuario activa la vista de código Markdown crudo (Ctrl+E), se omiten las decoraciones.
  // EN: When the user activates raw Markdown source view (Ctrl+E), decorations are bypassed.
  if (view.state.field(liveRawModeField, false)) {
    return { decos: Decoration.none, activeBlockStartLines: new Set() };
  }

  const doc = view.state.doc;
  const decos: Range<Decoration>[] = [];
  const lineToBlock = scanMultilineBlocks(view);
  const { activeLines, activeBlockStartLines } = calculateActiveLines(view, lineToBlock, stability);

  let prevLineWasEmpty = false;

  for (let ln = 1; ln <= doc.lines; ln++) {
    const line = doc.line(ln);
    const text = line.text;
    const blk = lineToBlock.get(ln);
    const isEmpty = text.trim().length === 0;
    const insideMultilineBlock = !!blk && blk.endLine > blk.startLine;

    if (activeLines.has(ln)) {
      prevLineWasEmpty = isEmpty && !insideMultilineBlock;
      if (blk && blk.endLine > blk.startLine) {
        const cls = ["cm-live-active-raw-block"];
        if (blk.kind === "code") cls.push("cm-live-active-code-block");
        if (ln === blk.startLine) cls.push("cm-live-active-raw-block-start");
        if (ln === blk.endLine) cls.push("cm-live-active-raw-block-end");
        decos.push(Decoration.line({ class: cls.join(" ") }).range(line.from));

        // ES: Vista previa de Mermaid adjunta bajo el código crudo activo.
        // EN: Mermaid live preview attached below active raw code.
        if (blk.kind === "mermaid" && ln === blk.endLine) {
          const mmdCode =
            blk.endLine > blk.startLine + 1 ? sliceLines(view, blk.startLine + 1, blk.endLine - 1) : "";
          const widget = new LiveMermaidWidget(mmdCode, doc.line(blk.startLine).from, true);
          decos.push(Decoration.widget({ widget, side: 1 }).range(line.to));
        }
      } else {
        const hMatch = text.match(/^(#{1,6})\s+/);
        if (hMatch) {
          // ES: Mantiene la tipografía del encabezado y atenúa los marcadores.
          // EN: Maintains heading typography and dims markdown markers.
          const hCls = `cm-live-h${hMatch[1].length} cm-live-active-heading`;
          decos.push(Decoration.line({ class: hCls }).range(line.from));
          decos.push(
            Decoration.mark({ class: "cm-live-hash-marker" }).range(
              line.from,
              line.from + hMatch[1].length,
            ),
          );
        } else {
          decos.push(Decoration.line({ class: "cm-live-active-raw-line" }).range(line.from));
          if (text.length === 0) {
            const widget = new EmptyLinePlaceholderWidget();
            decos.push(Decoration.widget({ widget, side: 1 }).range(line.from));
          }
        }
      }
      continue;
    }

    // ES: Primera línea vacía consecutiva fuera de bloques como hueco estructural uniforme.
    //     Las líneas vacías dentro de un bloque multilínea pertenecen al bloque.
    // EN: First consecutive empty line outside blocks as a uniform structural gap.
    //     Empty lines inside a multiline block belong to the block.
    if (isEmpty && !insideMultilineBlock) {
      if (!prevLineWasEmpty) {
        decos.push(Decoration.line({ class: "cm-md-gap" }).range(line.from));
      }
      prevLineWasEmpty = true;
      continue;
    }
    prevLineWasEmpty = false;

    // ES: Diagramas Mermaid inactivos renderizados como tarjeta interactiva.
    // EN: Inactive Mermaid diagrams rendered as interactive cards.
    if (blk?.kind === "mermaid") {
      if (ln === blk.startLine) {
        const mmdCode =
          blk.endLine > blk.startLine + 1 ? sliceLines(view, blk.startLine + 1, blk.endLine - 1) : "";
        const widget = new LiveMermaidWidget(mmdCode, line.from, false);
        decos.push(Decoration.replace({ widget }).range(line.from, line.to));
      } else {
        decos.push(Decoration.line({ class: "cm-live-collapsed-line" }).range(line.from));
        if (line.to > line.from) decos.push(Decoration.replace({}).range(line.from, line.to));
      }
      continue;
    }

    // ES: Bloques multilínea inactivos (código, matemáticas, tablas, citas, details).
    // EN: Inactive multiline blocks (code, math, tables, quotes, details).
    if (blk) {
      if (ln === blk.startLine) {
        const rawBlock = sliceLines(view, blk.startLine, blk.endLine);
        const { text: blockText, columns } = dedentBlock(rawBlock);
        const widget = new LiveRenderedBlockWidget(blockText, line.from, columns);
        decos.push(Decoration.replace({ widget }).range(line.from, line.to));
      } else {
        decos.push(Decoration.line({ class: "cm-live-collapsed-line" }).range(line.from));
        if (line.to > line.from) decos.push(Decoration.replace({}).range(line.from, line.to));
      }
      continue;
    }

    // ES: Bloques de una línea (imágenes y notas al pie).
    // EN: Single-line blocks (images and footnotes).
    if (/^\s*!\[.*?\]\(.*?\)\s*$/.test(text) || /^\s*\[\^[^\]]+\]:\s+/.test(text)) {
      decos.push(
        Decoration.replace({ widget: new LiveRenderedBlockWidget(text, line.from) }).range(line.from, line.to),
      );
      continue;
    }

    // ES: Reglas divisorias horizontales.
    // EN: Horizontal divider rules.
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(text)) {
      decos.push(Decoration.replace({ widget: new HrDividerWidget() }).range(line.from, line.to));
      continue;
    }

    let offset = 0;
    const hMatch = text.match(/^(#{1,6})\s+/);
    const tMatch = !hMatch ? text.match(/^(\s*[-*+]\s+\[([ xX])\]\s+)/) : null;
    const bMatch = !hMatch && !tMatch ? text.match(/^(\s*)([-*+]\s+)/) : null;
    const oMatch = !hMatch && !tMatch && !bMatch ? text.match(/^(\s*)(\d{1,9}[.)])(\s+)/) : null;

    if (hMatch) {
      decos.push(
        Decoration.line({ class: `cm-live-h${hMatch[1].length} cm-live-inactive-line` }).range(line.from),
      );
      decos.push(Decoration.replace({}).range(line.from, line.from + hMatch[0].length));
      offset = hMatch[0].length;
    } else if (tMatch || bMatch || oMatch) {
      // ES: La sangría del Markdown se traduce a una sangría visual proporcional por nivel de anidación.
      // EN: Markdown indentation is translated into proportional visual indentation per nesting level.
      const indentLen = text.match(/^\s*/)?.[0].length ?? 0;
      const depth = listDepth(text.slice(0, indentLen));
      decos.push(
        Decoration.line({
          class: "cm-live-inactive-line",
          attributes: { style: `padding-left: calc(4px + ${(depth * LIST_INDENT_EM).toFixed(2)}em)` },
        }).range(line.from),
      );
      if (indentLen > 0) decos.push(Decoration.replace({}).range(line.from, line.from + indentLen));

      if (tMatch) {
        const checked = tMatch[2].toLowerCase() === "x";
        const bracketPos = line.from + tMatch[0].indexOf("[") + 1;
        decos.push(
          Decoration.replace({ widget: new TaskCheckboxWidget(checked, bracketPos) }).range(
            line.from + indentLen,
            line.from + tMatch[0].length,
          ),
        );
        offset = tMatch[0].length;
      } else if (bMatch) {
        decos.push(
          Decoration.replace({ widget: new BulletPointWidget(depth % 3) }).range(
            line.from + bMatch[1].length,
            line.from + bMatch[0].length,
          ),
        );
        offset = bMatch[0].length;
      } else if (oMatch) {
        decos.push(
          Decoration.mark({ class: "cm-live-ol-marker" }).range(
            line.from + oMatch[1].length,
            line.from + oMatch[1].length + oMatch[2].length,
          ),
        );
        offset = oMatch[0].length;
      }
    } else {
      decos.push(Decoration.line({ class: "cm-live-inactive-line" }).range(line.from));
    }

    addInlineDecorations(text, line.from, offset, decos);
  }

  return { decos: Decoration.set(decos, true), activeBlockStartLines };
}

/**
 * ES: Plugin de vista que enlaza el ciclo de vida de CodeMirror 6 con las decoraciones reactivas.
 * EN: View plugin that binds CodeMirror 6 lifecycle with reactive decorations.
 */
const livePreviewViewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    isPointerDown = false;
    isNavigatingFast = false;
    navTimer: ReturnType<typeof setTimeout> | null = null;
    frozenBlockLines: Set<number> | null = null;
    activeBlockStartLines = new Set<number>();

    private readonly onPointerDown: () => void;
    private readonly onPointerUp: () => void;
    private readonly onKeyDown: (e: KeyboardEvent) => void;
    private readonly onKeyUp: () => void;

    constructor(readonly view: EditorView) {
      const res = buildLiveDecorations(view, this.getStabilityState());
      this.decorations = res.decos;
      this.activeBlockStartLines = res.activeBlockStartLines;

      this.onPointerDown = () => {
        this.isPointerDown = true;
        this.frozenBlockLines = new Set(this.activeBlockStartLines);
      };

      this.onPointerUp = () => {
        if (this.isPointerDown) {
          this.isPointerDown = false;
          this.frozenBlockLines = null;
          this.refresh(true);
        }
      };

      this.onKeyDown = (e: KeyboardEvent) => {
        if (e.repeat && /^(Arrow(Up|Down|Left|Right)|Page(Up|Down))$/.test(e.key)) {
          this.isNavigatingFast = true;
          if (this.navTimer) clearTimeout(this.navTimer);
          this.navTimer = setTimeout(() => {
            this.isNavigatingFast = false;
            this.refresh(true);
          }, 130);
        }
      };

      this.onKeyUp = () => {
        if (this.isNavigatingFast) {
          if (this.navTimer) clearTimeout(this.navTimer);
          this.isNavigatingFast = false;
          this.refresh(true);
        }
      };

      view.dom.addEventListener("pointerdown", this.onPointerDown);
      window.addEventListener("pointerup", this.onPointerUp);
      window.addEventListener("pointercancel", this.onPointerUp);
      view.dom.addEventListener("keydown", this.onKeyDown);
      view.dom.addEventListener("keyup", this.onKeyUp);
    }

    private refresh(measure = false): void {
      this.view.dispatch({ effects: refreshLiveEffect.of(null) });
      if (measure) this.view.requestMeasure();
    }

    getStabilityState(): LiveStabilityState {
      return {
        isPointerDown: this.isPointerDown,
        isNavigatingFast: this.isNavigatingFast,
        frozenBlockLines: this.frozenBlockLines,
      };
    }

    update(u: ViewUpdate) {
      const rawToggled =
        u.startState.field(liveRawModeField, false) !== u.state.field(liveRawModeField, false);
      const forcedRefresh = u.transactions.some((tr) =>
        tr.effects.some((e) => e.is(refreshLiveEffect)),
      );
      if (this.isNavigatingFast && !u.docChanged && !rawToggled && !forcedRefresh) {
        return;
      }
      if (
        forcedRefresh ||
        rawToggled ||
        u.docChanged ||
        u.selectionSet ||
        u.viewportChanged ||
        u.focusChanged
      ) {
        const res = buildLiveDecorations(u.view, this.getStabilityState());
        this.decorations = res.decos;
        this.activeBlockStartLines = res.activeBlockStartLines;
      }
    }

    destroy() {
      if (this.navTimer) clearTimeout(this.navTimer);
      this.view.dom.removeEventListener("pointerdown", this.onPointerDown);
      window.removeEventListener("pointerup", this.onPointerUp);
      window.removeEventListener("pointercancel", this.onPointerUp);
      this.view.dom.removeEventListener("keydown", this.onKeyDown);
      this.view.dom.removeEventListener("keyup", this.onKeyUp);
    }
  },
  { decorations: (inst) => inst.decorations },
);

/**
 * ES: Crea la extensión completa de Live Preview para ser montada en el compartimiento de CodeMirror.
 * EN: Creates the full Live Preview extension to be mounted in the CodeMirror compartment.
 */
export function createLivePreviewExtension(): Extension {
  return [
    EditorView.editorAttributes.of({ class: "cm-live-preview-mode" }),
    createLiveSheetFrameExtension(),
    blockSelectionClampFilter,
    livePreviewTheme,
    livePreviewViewPlugin,
  ];
}
