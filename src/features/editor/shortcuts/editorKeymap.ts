/**
 * ES: Generador de extensiones de teclado de CodeMirror a partir del catálogo unificado de comandos.
 * EN: CodeMirror keymap extension generator from the unified command catalog.
 */

import { keymap, type KeyBinding } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { EDITOR_COMMANDS } from "./editorCommands";
import { snippetFieldsExtension } from "./snippetFields";

/**
 * ES: Genera los atajos de CodeMirror solo para comandos que definen `keybinding`.
 * EN: Generates CodeMirror keybindings only for commands that define `keybinding`.
 */
export function createEditorKeybindings(): KeyBinding[] {
  return EDITOR_COMMANDS.filter((cmd) => cmd.keybinding).map((cmd) => ({
    key: cmd.keybinding as string,
    run: (view) => cmd.run(view),
    preventDefault: true,
  }));
}

/**
 * ES: Extensión lista para el EditorState: campos de snippet (Tab/Escape) + atajos de comandos.
 * EN: Ready-to-use extension for the EditorState: snippet fields (Tab/Escape) + command shortcuts.
 */
export function createEditorKeymapExtension(): Extension {
  return [snippetFieldsExtension(), keymap.of(createEditorKeybindings())];
}
