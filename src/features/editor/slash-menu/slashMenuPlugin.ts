/**
 * ES: Plugin de CodeMirror 6 para detectar la activación del menú slash (/) y capturar navegación por teclado.
 * EN: CodeMirror 6 plugin to detect slash menu (/) activation and capture keyboard navigation.
 */

import { EditorView, ViewPlugin, type ViewUpdate, keymap } from "@codemirror/view";
import { Prec, type Extension } from "@codemirror/state";
import { slashMenuStore } from "./slashMenuStore.svelte";

/**
 * ES: Expresión regular que detecta una barra diagonal activadora al inicio de línea o tras espacio en blanco.
 * EN: Regular expression detecting an activating forward slash at line start or after whitespace.
 */
const SLASH_TRIGGER_REGEX = /(?:^|\s)\/([a-zA-Z0-9_\-\u00C0-\u017F]*)$/;

/**
 * ES: Plugin de vista que rastrea los cambios de posición del cursor y actualiza el estado del menú contextual slash.
 * EN: View plugin that tracks cursor position updates and keeps the slash context menu state updated.
 */
export const slashMenuTrackerPlugin = ViewPlugin.fromClass(
  class {
    private rafId: number | null = null;

    update(update: ViewUpdate): void {
      if (!update.docChanged && !update.selectionSet) return;

      const { state, view } = update;
      const selection = state.selection.main;

      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }

      // ES: Si hay selección de texto múltiple o rango, cerramos el menú emergente.
      // EN: If multiple characters or range are selected, close the popup menu.
      if (!selection.empty) {
        if (slashMenuStore.isOpen) {
          slashMenuStore.close();
        }
        return;
      }

      const head = selection.head;
      const line = state.doc.lineAt(head);
      const textBeforeCursor = line.text.slice(0, head - line.from);

      const match = textBeforeCursor.match(SLASH_TRIGGER_REGEX);
      if (match) {
        const query = match[1] || "";
        const slashIndexInLine = textBeforeCursor.lastIndexOf("/");
        const fromPos = line.from + slashIndexInLine;
        const toPos = head;

        // ES: Aplaza la lectura de coordenadas a la siguiente animación para evitar errores de layout en CodeMirror.
        // EN: Defers coordinates reading to next animation frame avoiding CodeMirror layout query errors.
        this.rafId = requestAnimationFrame(() => {
          this.rafId = null;
          if (!view.dom.isConnected) return;
          const coords = view.coordsAtPos(fromPos);
          if (coords) {
            slashMenuStore.open(
              view,
              query,
              {
                top: coords.top,
                bottom: coords.bottom,
                left: coords.left,
              },
              { from: fromPos, to: toPos },
            );
          }
        });
        return;
      }

      // ES: Si el cursor ya no está tras una barra diagonal válida, cerramos el menú.
      // EN: If cursor is no longer after a valid slash, close the menu.
      if (slashMenuStore.isOpen) {
        slashMenuStore.close();
      }
    }

    destroy(): void {
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }
  },
);

/**
 * ES: Bindings de teclado para interceptar flechas, Enter y Escape exclusivamente cuando el menú slash está abierto.
 * Usa Prec.highest porque el keymap de lang-markdown (alta prioridad) consumía Enter antes que el menú.
 * EN: Keybindings to intercept arrows, Enter, and Escape exclusively when the slash menu is active.
 * Uses Prec.highest because the lang-markdown keymap (high precedence) consumed Enter before the menu.
 */
export function createSlashMenuKeymapExtension(): Extension {
  return Prec.highest(keymap.of([
    {
      key: "ArrowDown",
      run: () => {
        if (!slashMenuStore.isOpen) return false;
        slashMenuStore.selectNext();
        return true;
      },
    },
    {
      key: "ArrowUp",
      run: () => {
        if (!slashMenuStore.isOpen) return false;
        slashMenuStore.selectPrev();
        return true;
      },
    },
    {
      key: "Enter",
      run: () => {
        if (!slashMenuStore.isOpen) return false;
        return slashMenuStore.executeCurrent();
      },
    },
    {
      key: "Tab",
      run: () => {
        if (!slashMenuStore.isOpen) return false;
        return slashMenuStore.executeCurrent();
      },
    },
    {
      key: "Escape",
      run: () => {
        if (!slashMenuStore.isOpen) return false;
        slashMenuStore.close();
        return true;
      },
    },
  ]));
}

