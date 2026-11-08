/**
 * ES: Marco de escritura ajustable para el modo Live Preview.
 *     Renderiza los límites laterales visibles y arrastrables del área de escritura.
 * EN: Adjustable writing frame for Live Preview mode.
 *     Renders visible, draggable lateral writing boundaries for the writing area.
 */

import { StateEffect, StateField, type Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

/** ES: Clave de almacenamiento local para el ancho del marco en Live Preview. EN: Local storage key for Live Preview frame width. */
const LIVE_WIDTH_STORAGE_KEY = "md_studio_live_width_v1";
/** ES: Ancho predeterminado del área de escritura (px). EN: Default writing area width (px). */
const DEFAULT_LIVE_WIDTH = 1020;
/** ES: Ancho mínimo permitido del área de escritura (px). EN: Minimum allowed writing area width (px). */
const MIN_LIVE_WIDTH = 680;
/** ES: Ancho máximo permitido del área de escritura (px). EN: Maximum allowed writing area width (px). */
const MAX_LIVE_WIDTH = 1600;
/** ES: Margen interno horizontal entre el borde de la hoja y el texto (px por lado). EN: Horizontal inner padding between sheet edge and text (px per side). */
const SHEET_SIDE_PAD = 28;

/**
 * ES: Efecto de estado para alternar o fijar la visualización de código Markdown crudo dentro de Live Preview.
 * EN: State effect to toggle or set raw Markdown code visualization inside Live Preview.
 */
export const toggleLiveRawModeEffect = StateEffect.define<boolean | undefined>();

/**
 * ES: Campo de estado que indica si se muestra el código Markdown completo dentro de Live Preview.
 * EN: State field indicating whether full raw Markdown code is shown inside Live Preview.
 */
export const liveRawModeField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(toggleLiveRawModeEffect)) {
        return effect.value !== undefined ? effect.value : !value;
      }
    }
    return value;
  },
});

/**
 * ES: Alterna entre vista renderizada y código fuente Markdown dentro de Live Preview.
 * EN: Toggles between rendered view and raw Markdown source inside Live Preview.
 */
export function toggleLiveRawMode(view: EditorView): boolean {
  const next = !view.state.field(liveRawModeField, false);
  view.dispatch({
    effects: toggleLiveRawModeEffect.of(next),
  });
  return true;
}

/**
 * ES: Lee el ancho guardado del marco de escritura desde localStorage.
 * EN: Reads the saved writing frame width from localStorage.
 */
function loadSavedWidth(): number {
  if (typeof window === "undefined") return DEFAULT_LIVE_WIDTH;
  const raw = Number(localStorage.getItem(LIVE_WIDTH_STORAGE_KEY));
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LIVE_WIDTH;
  return Math.max(MIN_LIVE_WIDTH, Math.min(MAX_LIVE_WIDTH, Math.round(raw)));
}

/**
 * ES: Persiste el ancho del marco de escritura en localStorage.
 * EN: Persists the writing frame width to localStorage.
 */
function saveWidth(width: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LIVE_WIDTH_STORAGE_KEY, String(Math.round(width)));
  } catch {
    // ES: Ignora errores de cuota de almacenamiento.
    // EN: Ignores storage quota errors.
  }
}

/**
 * ES: Plugin que dibuja los límites de escritura arrastrables y la píldora de alternancia MD/Live.
 * EN: Plugin that renders draggable writing boundaries and the MD/Live toggle pill.
 */
const liveSheetFramePlugin = ViewPlugin.fromClass(
  class {
    private widthPx: number;
    private readonly leftGuide: HTMLDivElement;
    private readonly rightGuide: HTMLDivElement;
    private readonly widthBadge: HTMLDivElement;
    private resizeObserver: ResizeObserver | null = null;
    private isDragging = false;

    private readonly onScrollOrResize: () => void;

    constructor(readonly view: EditorView) {
      this.widthPx = loadSavedWidth();

      this.leftGuide = document.createElement("div");
      this.leftGuide.className = "cm-live-boundary-guide is-left";
      this.leftGuide.title = "Arrastra para ajustar el ancho de escritura (doble clic para restablecer)";

      this.rightGuide = document.createElement("div");
      this.rightGuide.className = "cm-live-boundary-guide is-right";
      this.rightGuide.title = "Arrastra para ajustar el ancho de escritura (doble clic para restablecer)";

      this.widthBadge = document.createElement("div");
      this.widthBadge.className = "cm-live-width-badge";

      this.bindDragGuide(this.leftGuide);
      this.bindDragGuide(this.rightGuide);

      this.view.dom.appendChild(this.leftGuide);
      this.view.dom.appendChild(this.rightGuide);
      this.view.dom.appendChild(this.widthBadge);

      this.applyWidthCssVars();

      this.onScrollOrResize = () => this.positionGuides();
      window.addEventListener("resize", this.onScrollOrResize);
      if (typeof ResizeObserver !== "undefined") {
        this.resizeObserver = new ResizeObserver(this.onScrollOrResize);
        this.resizeObserver.observe(this.view.scrollDOM);
        this.resizeObserver.observe(this.view.contentDOM);
      }
      requestAnimationFrame(() => this.positionGuides());
    }

    /**
     * ES: Conecta los eventos de arrastre y doble clic a una guía lateral de límite de escritura.
     * EN: Connects drag and double-click events to a lateral writing boundary guide.
     */
    private bindDragGuide(guide: HTMLDivElement): void {
      guide.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.widthPx = DEFAULT_LIVE_WIDTH;
        saveWidth(this.widthPx);
        this.applyWidthCssVars();
        this.positionGuides();
        this.view.requestMeasure();
      });

      guide.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        this.isDragging = true;
        this.leftGuide.classList.add("is-dragging");
        this.rightGuide.classList.add("is-dragging");
        this.widthBadge.classList.add("is-visible");
        this.widthBadge.textContent = `${this.widthPx} px`;

        const onMove = (moveEvt: PointerEvent) => {
          const scrollerRect = this.view.scrollDOM.getBoundingClientRect();
          const centerX = scrollerRect.left + scrollerRect.width / 2;
          const distFromCenter = Math.abs(moveEvt.clientX - centerX);
          const maxAvailable = Math.max(MIN_LIVE_WIDTH, scrollerRect.width - SHEET_SIDE_PAD * 2 - 24);
          const nextWidth = Math.round((distFromCenter - SHEET_SIDE_PAD) * 2);
          this.widthPx = Math.max(
            MIN_LIVE_WIDTH,
            Math.min(Math.min(MAX_LIVE_WIDTH, maxAvailable), nextWidth),
          );
          this.widthBadge.textContent = `${this.widthPx} px`;
          this.applyWidthCssVars();
          this.positionGuides();
        };

        const onUp = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onUp);
          this.isDragging = false;
          this.leftGuide.classList.remove("is-dragging");
          this.rightGuide.classList.remove("is-dragging");
          this.widthBadge.classList.remove("is-visible");
          saveWidth(this.widthPx);
          this.view.requestMeasure();
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
      });
    }

    /**
     * ES: Actualiza las variables CSS de ancho en el contenedor del editor.
     * EN: Updates width CSS variables on the editor container.
     */
    private applyWidthCssVars(): void {
      this.view.dom.style.setProperty("--live-max-width", `${this.widthPx}px`);
      this.view.dom.style.setProperty(
        "--live-sheet-width",
        `${this.widthPx + SHEET_SIDE_PAD * 2}px`,
      );
    }

    /**
     * ES: Posiciona las guías laterales alineadas con los bordes de la hoja de escritura.
     * EN: Positions the lateral guides aligned with the writing sheet edges.
     */
    private positionGuides(): void {
      const editorRect = this.view.dom.getBoundingClientRect();
      const contentRect = this.view.contentDOM.getBoundingClientRect();
      if (editorRect.width <= 0 || contentRect.width <= 0) return;

      const leftX = Math.max(4, contentRect.left - editorRect.left - SHEET_SIDE_PAD);
      const rightX = Math.min(
        editorRect.width - 4,
        contentRect.right - editorRect.left + SHEET_SIDE_PAD,
      );
      const sheetActualWidth = Math.max(0, rightX - leftX);

      this.leftGuide.style.left = `${leftX}px`;
      this.rightGuide.style.left = `${rightX}px`;
      this.view.dom.style.setProperty("--live-sheet-actual-px", `${sheetActualWidth}px`);
    }

    update(u: ViewUpdate): void {
      if (u.geometryChanged || u.viewportChanged) {
        this.positionGuides();
      }
    }

    destroy(): void {
      window.removeEventListener("resize", this.onScrollOrResize);
      this.resizeObserver?.disconnect();
      this.leftGuide.remove();
      this.rightGuide.remove();
      this.widthBadge.remove();
      this.view.dom.classList.remove("cm-live-raw-source-active");
    }
  },
);

/**
 * ES: Tema visual para las guías de límite de escritura e indicador de ancho.
 * EN: Visual theme for writing boundary guides and width indicator.
 */
const liveSheetFrameTheme = EditorView.baseTheme({
  ".cm-live-boundary-guide": {
    position: "absolute",
    top: "0",
    bottom: "0",
    width: "12px",
    transform: "translateX(-50%)",
    cursor: "col-resize",
    zIndex: "6",
    userSelect: "none",
  },
  ".cm-live-boundary-guide::after": {
    content: '""',
    position: "absolute",
    top: "0",
    bottom: "0",
    left: "50%",
    width: "1px",
    transform: "translateX(-50%)",
    backgroundColor: "color-mix(in srgb, var(--text-faint, #64748b) 28%, transparent)",
    transition: "background-color 120ms ease, width 120ms ease",
  },
  ".cm-live-boundary-guide:hover::after, .cm-live-boundary-guide.is-dragging::after": {
    width: "2px",
    backgroundColor: "var(--accent-color, #5fb3a3)",
  },
  ".cm-live-width-badge": {
    position: "absolute",
    top: "12px",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "3px 10px",
    borderRadius: "999px",
    fontSize: "0.74rem",
    fontWeight: "600",
    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
    backgroundColor: "var(--bg-elevated, #1e222a)",
    color: "var(--accent-color, #5fb3a3)",
    border: "1px solid color-mix(in srgb, var(--accent-color, #5fb3a3) 45%, transparent)",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.18)",
    pointerEvents: "none",
    opacity: "0",
    transition: "opacity 120ms ease",
    zIndex: "10",
  },
  ".cm-live-width-badge.is-visible": {
    opacity: "1",
  },
});

/**
 * ES: Extensión combinada del marco de escritura ajustable.
 * EN: Combined extension of the adjustable writing frame.
 */
export function createLiveSheetFrameExtension(): Extension {
  return [liveRawModeField, liveSheetFrameTheme, liveSheetFramePlugin];
}

