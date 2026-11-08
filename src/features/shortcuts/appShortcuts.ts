/**
 * ES: Catálogo de atajos globales de la aplicación (vista, archivo, exportación, tema) y su detector.
 * EN: Catalog of global application shortcuts (view, file, export, theme) and its matcher.
 */

import { isMacPlatform } from "./platform";

export type AppActionId =
  | "toggle-sidebar"
  | "save"
  | "import"
  | "new-document"
  | "new-folder"
  | "focus-search"
  | "export-md"
  | "export-pdf"
  | "export-html"
  | "toggle-theme"
  | "toggle-language"
  | "view-live"
  | "view-editor"
  | "view-split"
  | "view-preview"
  | "toggle-minimap"
  | "toggle-line-numbers"
  | "toggle-sync-scroll";

/**
 * ES: Fuente única de verdad de los atajos globales (formato CodeMirror: Mod = Ctrl/Cmd).
 * EN: Single source of truth for global shortcuts (CodeMirror format: Mod = Ctrl/Cmd).
 */
export const APP_SHORTCUTS: ReadonlyArray<{ id: AppActionId; keybinding: string }> = [
  { id: "toggle-sidebar", keybinding: "Mod-\\" },
  { id: "save", keybinding: "Mod-s" },
  { id: "import", keybinding: "Mod-o" },
  { id: "new-document", keybinding: "Mod-Alt-n" },
  { id: "new-folder", keybinding: "Mod-Alt-f" },
  { id: "focus-search", keybinding: "Mod-Shift-f" },
  { id: "export-md", keybinding: "Mod-Shift-e" },
  { id: "export-pdf", keybinding: "Mod-p" },
  { id: "export-html", keybinding: "Mod-Alt-e" },
  { id: "toggle-theme", keybinding: "Mod-Shift-l" },
  { id: "toggle-language", keybinding: "Mod-Alt-i" },
  { id: "view-live", keybinding: "Mod-1" },
  { id: "view-editor", keybinding: "Mod-2" },
  { id: "view-split", keybinding: "Mod-3" },
  { id: "view-preview", keybinding: "Mod-4" },
  { id: "toggle-minimap", keybinding: "Mod-Alt-m" },
  { id: "toggle-line-numbers", keybinding: "Mod-Alt-Shift-l" },
  { id: "toggle-sync-scroll", keybinding: "Mod-Alt-s" },
];

interface ParsedKeybinding {
  alt: boolean;
  shift: boolean;
  key: string;
}

const PARSED = APP_SHORTCUTS.map((s) => {
  const tokens = s.keybinding.split("-");
  const key = tokens.pop() as string;
  const parsed: ParsedKeybinding = {
    alt: tokens.includes("Alt"),
    shift: tokens.includes("Shift"),
    key,
  };
  return { id: s.id, parsed };
});

/**
 * ES: Compara la tecla; con Alt/Shift usa `code` para dígitos (Alt+1 produce símbolos) y en Mac para letras.
 * EN: Compares the key; with Alt/Shift uses `code` for digits (Alt+1 yields symbols) and on Mac for letters.
 */
function keyMatches(event: KeyboardEvent, key: string): boolean {
  if (event.key.toLowerCase() === key) return true;
  if (/^\d$/.test(key)) return event.code === `Digit${key}`;
  if (/^[a-z]$/.test(key) && event.altKey && isMacPlatform()) return event.code === `Key${key.toUpperCase()}`;
  return false;
}

/**
 * ES: Devuelve la acción global asociada al evento o null. Ignora AltGr (Ctrl+Alt en Windows) y teclas ya manejadas.
 * EN: Returns the global action bound to the event or null. Ignores AltGr (Ctrl+Alt on Windows) and already handled keys.
 */
export function matchAppShortcut(event: KeyboardEvent): AppActionId | null {
  if (event.defaultPrevented || event.isComposing) return null;
  if (event.getModifierState?.("AltGraph")) return null;

  const mod = isMacPlatform() ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  if (!mod) return null;

  for (const { id, parsed } of PARSED) {
    if (parsed.alt === event.altKey && parsed.shift === event.shiftKey && keyMatches(event, parsed.key)) {
      return id;
    }
  }
  return null;
}

