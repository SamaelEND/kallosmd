/**
 * ES: Búsqueda y reemplazo dentro del documento (Ctrl+F / Ctrl+H) con panel traducido al idioma activo.
 * EN: In-document find and replace (Ctrl+F / Ctrl+H) with the panel translated to the active language.
 */

import { EditorState, Prec, type Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import {
  closeSearchPanel,
  findNext,
  findPrevious,
  openSearchPanel,
  search,
} from "@codemirror/search";
import type { SupportedLocale } from "../../../shared/i18n";

/**
 * ES: Traducciones del panel de CodeMirror (el inglés es el texto base de la librería).
 * EN: CodeMirror panel translations (English is the library's base text).
 */
const ES_PHRASES: Record<string, string> = {
  Find: "Buscar",
  Replace: "Reemplazar",
  next: "siguiente",
  previous: "anterior",
  all: "todos",
  "match case": "coincidir mayúsculas",
  regexp: "regex",
  "by word": "palabra completa",
  replace: "reemplazar",
  "replace all": "reemplazar todo",
  close: "cerrar",
};

/**
 * ES: Crea la extensión de búsqueda; debe recrearse al cambiar de idioma (vía Compartment).
 * EN: Creates the search extension; must be recreated on language change (via Compartment).
 */
export function createSearchExtension(locale: SupportedLocale): Extension {
  return [
    search({ top: true }),
    EditorState.phrases.of(locale === "es" ? ES_PHRASES : {}),
    Prec.high(
      keymap.of([
        { key: "Mod-f", run: openSearchPanel, scope: "editor search-panel", preventDefault: true },
        { key: "Mod-h", run: openSearchPanel, scope: "editor search-panel", preventDefault: true },
        { key: "F3", run: findNext, shift: findPrevious, scope: "editor search-panel", preventDefault: true },
        { key: "Escape", run: closeSearchPanel, scope: "editor search-panel" },
      ]),
    ),
  ];
}
