/**
 * ES: Store reactivo para gestionar el estado, posición y comandos filtrados del menú contextual slash (/).
 * EN: Reactive store to manage state, position, and filtered commands for the slash context menu (/).
 */

import type { EditorView } from "@codemirror/view";
import { getLocalizedCommands, type EditorCommand } from "../shortcuts/editorCommands";

export interface SlashMenuCoords {
  top: number;
  bottom: number;
  left: number;
}

export interface SlashMenuRange {
  from: number;
  to: number;
}

class SlashMenuStore {
  isOpen = $state(false);
  query = $state("");
  coords = $state<SlashMenuCoords>({ top: 0, bottom: 0, left: 0 });
  slashRange = $state<SlashMenuRange | null>(null);
  selectedIndex = $state(0);
  activeView: EditorView | null = null;

  /**
   * ES: Lista de comandos filtrados en tiempo real según el término de búsqueda tras la barra diagonal.
   * EN: List of commands filtered in real-time according to the search query after the slash.
   */
  filteredCommands = $derived.by<EditorCommand[]>(() => {
    const list = getLocalizedCommands();
    const q = this.query.trim().toLowerCase();
    if (!q) return list;

    return list.filter((cmd) => {
      const matchLabel = cmd.label.toLowerCase().includes(q);
      const matchDesc = cmd.description.toLowerCase().includes(q);
      const matchIcon = cmd.iconText.toLowerCase().includes(q);
      const matchId = cmd.id.toLowerCase().includes(q);
      return matchLabel || matchDesc || matchIcon || matchId;
    });
  });

  /**
   * ES: Abre o actualiza el menú slash con nuevas coordenadas, consulta y rango de reemplazo.
   * EN: Opens or updates the slash menu with new coordinates, query, and replacement range.
   */
  open(
    view: EditorView,
    query: string,
    coords: SlashMenuCoords,
    slashRange: SlashMenuRange,
  ): void {
    this.activeView = view;
    this.query = query;
    this.coords = coords;
    this.slashRange = slashRange;
    this.isOpen = true;

    // ES: Ajusta el índice seleccionado si la lista filtrada cambia de longitud.
    // EN: Adjusts selected index if filtered list changes length.
    if (this.selectedIndex >= this.filteredCommands.length) {
      this.selectedIndex = 0;
    }
  }

  /**
   * ES: Cierra el menú contextual slash y restablece el estado.
   * EN: Closes the slash context menu and resets state.
   */
  close(): void {
    this.isOpen = false;
    this.query = "";
    this.slashRange = null;
    this.selectedIndex = 0;
    this.activeView = null;
  }

  /**
   * ES: Selecciona el siguiente elemento de la lista navegable.
   * EN: Selects the next item in the navigable list.
   */
  selectNext(): void {
    const count = this.filteredCommands.length;
    if (count === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % count;
  }

  /**
   * ES: Selecciona el elemento anterior de la lista navegable.
   * EN: Selects the previous item in the navigable list.
   */
  selectPrev(): void {
    const count = this.filteredCommands.length;
    if (count === 0) return;
    this.selectedIndex = (this.selectedIndex - 1 + count) % count;
  }

  /**
   * ES: Ejecuta el comando actualmente seleccionado utilizando la vista activa del editor.
   * EN: Executes the currently selected command using the active editor view.
   */
  executeCurrent(): boolean {
    if (!this.isOpen || !this.activeView) return false;
    const currentList = this.filteredCommands;
    if (currentList.length === 0) return false;

    const cmd = currentList[this.selectedIndex] || currentList[0];
    const range = this.slashRange;
    // ES: Captura la vista ANTES de close(), que la pone en null (causa raíz de que Enter no ejecutara).
    // EN: Capture the view BEFORE close(), which nulls it (root cause of Enter not executing).
    const view = this.activeView;
    this.close();

    return cmd && view ? cmd.run(view, range || undefined) : false;
  }

  /**
   * ES: Ejecuta un comando específico al hacer clic con el ratón o selección directa.
   * EN: Executes a specific command on mouse click or direct selection.
   */
  executeCommand(cmd: EditorCommand): boolean {
    const view = this.activeView;
    if (!view) return false;
    const range = this.slashRange;
    this.close();
    return cmd.run(view, range || undefined);
  }
}

export const slashMenuStore = new SlashMenuStore();

