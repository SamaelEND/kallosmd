/**
 * ES: Traduce reactivamente etiquetas y descripciones de comandos usando claves `slashMenu.<id camelCase>`.
 * EN: Reactively localizes command labels and descriptions using `slashMenu.<camelCase id>` keys.
 */

import { i18n } from "../../../shared/i18n/i18n.svelte";
import type { EditorCommand } from "./editorCommands";

/**
 * ES: Convierte "heading-1" en "heading1" y "inline-code" en "inlineCode".
 * EN: Converts "heading-1" to "heading1" and "inline-code" to "inlineCode".
 */
function toKey(id: string): string {
  return id.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
}

/**
 * ES: Aplica el idioma activo a la lista de comandos; si falta una clave conserva el texto base.
 * EN: Applies the active language to the command list; falls back to base text when a key is missing.
 */
export function localizeCommands(commands: EditorCommand[]): EditorCommand[] {
  const t = i18n.current.slashMenu as unknown as Record<string, string>;
  return commands.map((cmd) => {
    const key = toKey(cmd.id);
    return { ...cmd, label: t[key] || cmd.label, description: t[`${key}Desc`] || cmd.description };
  });
}
