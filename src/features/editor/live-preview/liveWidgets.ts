/**
 * ES: Widgets del DOM para elementos interactivos y bloques enriquecidos en Live Preview.
 *     Maneja casillas de tareas, divisores, fórmulas KaTeX, bloques HTML/código y diagramas Mermaid.
 * EN: DOM widgets for interactive elements and rich blocks in Live Preview.
 *     Handles task checkboxes, dividers, KaTeX formulas, HTML/code blocks, and Mermaid diagrams.
 */

import { EditorView, WidgetType } from "@codemirror/view";
import katex from "katex";
import { processMathAndMarkdown } from "../../../core/markdown/markdownPipeline";
import { setupCopyButtons } from "../../preview/previewInteractions";
import { attachClickToEdit, enterBlockAt } from "./liveClickToEdit";
import { renderLiveMermaidInto } from "./liveMermaidModal";
import { i18n } from "../../../shared/i18n/i18n.svelte";

/**
 * ES: Registro persistente del estado de apertura para desplegables <details>.
 * EN: Persistent state registry for <details> disclosure elements.
 */
const openDetailsState = new Map<string, boolean>();

/**
 * ES: Casilla de verificación interactiva para listas de tareas (- [ ] y - [x]).
 * EN: Interactive checkbox for task lists (- [ ] and - [x]).
 */
export class TaskCheckboxWidget extends WidgetType {
  constructor(
    private readonly checked: boolean,
    private readonly bracketInnerPos: number,
  ) {
    super();
  }

  override eq(other: TaskCheckboxWidget): boolean {
    return (
      other.checked === this.checked &&
      other.bracketInnerPos === this.bracketInnerPos
    );
  }

  override toDOM(view: EditorView): HTMLElement {
    const box = document.createElement("span");
    box.className = `cm-live-checkbox${this.checked ? " is-checked" : ""}`;
    box.setAttribute("role", "checkbox");
    box.setAttribute("aria-checked", String(this.checked));
    box.title = this.checked ? "Marcar como pendiente" : "Completar tarea";

    if (this.checked) {
      box.innerHTML = `<svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="2.5 7.5 5.5 10.5 11.5 3.5"></polyline></svg>`;
    }

    box.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const pos = this.bracketInnerPos;
      if (pos < 0 || pos >= view.state.doc.length) return;
      view.dispatch({
        changes: { from: pos, to: pos + 1, insert: this.checked ? " " : "x" },
      });
    });

    return box;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

/**
 * ES: Punto de viñeta para listas desordenadas (- , * , + ).
 * EN: Bullet point glyph for unordered lists (- , * , + ).
 */
export class BulletPointWidget extends WidgetType {
  /** ES: Glifos por nivel (disco, círculo, cuadrado). EN: Glyphs per level (disc, circle, square). */
  private static readonly GLYPHS = ["•", "◦", "▪"];

  constructor(private readonly level = 0) {
    super();
  }

  override eq(other: BulletPointWidget): boolean {
    return other.level === this.level;
  }

  override toDOM(): HTMLElement {
    const bullet = document.createElement("span");
    bullet.className = "cm-live-bullet";
    bullet.setAttribute("aria-hidden", "true");
    bullet.textContent = BulletPointWidget.GLYPHS[this.level % 3];
    return bullet;
  }
}

/**
 * ES: Línea divisoria horizontal para separadores temáticos (---, ***, ___).
 * EN: Horizontal divider line for thematic breaks (---, ***, ___).
 */
export class HrDividerWidget extends WidgetType {
  override eq(): boolean {
    return true;
  }

  override toDOM(): HTMLElement {
    const hr = document.createElement("span");
    hr.className = "cm-live-hr-widget";
    hr.setAttribute("role", "separator");
    return hr;
  }
}

/**
 * ES: Renderizado de fórmulas matemáticas KaTeX en línea ($...$).
 * EN: Inline KaTeX mathematical formula rendering ($...$).
 */
export class KatexInlineWidget extends WidgetType {
  constructor(
    private readonly formula: string,
    private readonly targetPos: number,
  ) {
    super();
  }

  override eq(other: KatexInlineWidget): boolean {
    return other.formula === this.formula && other.targetPos === this.targetPos;
  }

  override toDOM(view: EditorView): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-live-katex-inline";
    try {
      span.innerHTML = katex.renderToString(this.formula.trim(), {
        throwOnError: false,
        displayMode: false,
      });
    } catch {
      span.textContent = `$${this.formula}$`;
    }

    attachClickToEdit(span, view, () => this.targetPos);

    return span;
  }
}

/**
 * ES: Bloque enriquecido compilado mediante el canal principal de Markdown.
 *     Soporta bloques KaTeX, tablas GFM, alertas, citas, <details>, imágenes y notas al pie.
 * EN: Rich block compiled through the main Markdown pipeline.
 *     Supports KaTeX blocks, GFM tables, alerts, quotes, <details>, images, and footnotes.
 */
export class LiveRenderedBlockWidget extends WidgetType {
  constructor(
    private readonly rawMarkdown: string,
    private readonly targetPos: number,
    private readonly indentColumns = 0,
  ) {
    super();
  }

  override eq(other: LiveRenderedBlockWidget): boolean {
    return (
      other.rawMarkdown === this.rawMarkdown &&
      other.targetPos === this.targetPos &&
      other.indentColumns === this.indentColumns
    );
  }

  override toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "reading-table-content cm-live-html-block";
    wrapper.innerHTML = processMathAndMarkdown(this.rawMarkdown);

    // ES: Conserva la sangría original del bloque (p. ej. cita dentro de un ítem de lista).
    // EN: Keeps the block's original indentation (e.g. a quote inside a list item).
    if (this.indentColumns > 0) {
      wrapper.style.setProperty("padding-left", `${(this.indentColumns * 0.7).toFixed(2)}em`, "important");
    }

    // ES: Conecta funcionalidad de copiado en bloques de código.
    // EN: Connects copy functionality in code blocks.
    setupCopyButtons(wrapper);

    // ES: Preserva estado y añade control de edición en etiquetas <details>.
    // EN: Preserves state and adds edit control in <details> tags.
    wrapper.querySelectorAll<HTMLDetailsElement>("details").forEach((det, idx) => {
      const key = `${ idx }:${ det.querySelector("summary")?.textContent || "" }`;
      if (openDetailsState.get(key)) det.open = true;
      det.addEventListener("toggle", () => {
        openDetailsState.set(key, det.open);
      });
      const summary = det.querySelector("summary");
      if (summary) {
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "cm-live-details-edit-btn";
        editBtn.textContent = "Editar";
        editBtn.title = "Editar código Markdown de este desplegable";
        editBtn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          enterBlockAt(view, this.targetPos + 1);
        });
        summary.appendChild(editBtn);
      }
    });

    // ES: Un clic corto entra a editar en el punto pulsado; arrastrar o mantener presionado selecciona.
    // EN: A short click enters edit mode at the pressed point; dragging or holding selects.
    attachClickToEdit(wrapper, view, (e) => this.resolveEditPos(view, e));

    return wrapper;
  }

  /**
   * ES: Calcula la posición de edición dentro del bloque (tabla: fila; código: línea; otros: coordenadas).
   *     Siempre queda estrictamente dentro del bloque para que se revele el Markdown fuente.
   * EN: Computes the edit position inside the block (table: row; code: line; others: coordinates).
   *     Always strictly inside the block so the source Markdown is revealed.
   */
  private resolveEditPos(view: EditorView, e: MouseEvent): number {
    const doc = view.state.doc;
    const target = e.target as HTMLElement;
    let pos = this.targetPos;

    if (pos >= 0 && pos <= doc.length) {
      const startLineNum = doc.lineAt(pos).number;
      const tr = target.closest("tr");
      const pre = target.closest("pre");

      if (tr) {
        const tbody = tr.closest("tbody");
        if (tbody) {
          const rowIndex = Array.from(tbody.children).indexOf(tr);
          if (rowIndex >= 0) {
            pos = doc.line(Math.min(startLineNum + 2 + rowIndex, doc.lines)).from;
          }
        }
      } else if (pre) {
        const clickY = e.clientY - pre.getBoundingClientRect().top;
        const codeEl = pre.querySelector("code") || pre;
        const lineHeight = parseFloat(window.getComputedStyle(codeEl).lineHeight) || 22;
        const lineOffset = Math.max(0, Math.floor(clickY / lineHeight));
        pos = doc.line(Math.min(startLineNum + 1 + lineOffset, doc.lines)).from;
      } else {
        const coords = view.posAtCoords({ x: e.clientX, y: e.clientY });
        if (coords !== null && coords >= pos) pos = coords;
      }
    }

    return Math.max(pos, this.targetPos + 1);
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

/**
 * ES: Widget para diagramas Mermaid tanto en estado inactivo como en vista previa reactiva.
 * EN: Widget for Mermaid diagrams in both inactive state and reactive preview.
 */
export class LiveMermaidWidget extends WidgetType {
  constructor(
    private readonly code: string,
    private readonly targetPos: number,
    private readonly isActivePreview: boolean,
  ) {
    super();
  }

  override eq(other: LiveMermaidWidget): boolean {
    return (
      other.code === this.code &&
      other.isActivePreview === this.isActivePreview &&
      (this.isActivePreview || other.targetPos === this.targetPos)
    );
  }

  override toDOM(view: EditorView): HTMLElement {
    const box = document.createElement("div");
    box.className = `cm-live-mermaid-box${this.isActivePreview ? " is-active-preview" : " is-inactive-block"}`;
    renderLiveMermaidInto(box, this.code, 0);

    // ES: Un clic corto sobre el diagrama entra a editar su fuente; arrastrar o mantener presionado no lo abre.
    // EN: A short click on the diagram enters its source for editing; dragging or holding does not open it.
    if (!this.isActivePreview) {
      attachClickToEdit(box, view, () => this.targetPos + 1);
    }

    return box;
  }

  override updateDOM(dom: HTMLElement): boolean {
    const expectedClass = this.isActivePreview
      ? "is-active-preview"
      : "is-inactive-block";
    if (!dom.classList.contains(expectedClass)) return false;
    renderLiveMermaidInto(dom, this.code, this.isActivePreview ? 300 : 0);
    return true;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

/**
 * ES: Indicador visual fantasma en líneas vacías con cursor activo (no altera el contenido del documento).
 * EN: Visual ghost placeholder on empty lines with an active cursor (does not alter document content).
 */
export class EmptyLinePlaceholderWidget extends WidgetType {
  private readonly text: string;

  constructor() {
    super();
    const t = i18n.current;
    this.text = t.slashMenu?.emptyLinePlaceholder || "Escribe, o pulsa / para insertar...";
  }

  override eq(other: EmptyLinePlaceholderWidget): boolean {
    return this.text === other.text;
  }

  override toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-live-empty-placeholder";
    span.textContent = this.text;
    span.setAttribute("aria-hidden", "true");
    return span;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}
