/**
 * ES: Catálogo unificado de comandos del editor: atajos estándar de la industria + menú slash.
 * EN: Unified editor command catalog: industry-standard shortcuts + slash menu.
 */

import type { EditorView } from "@codemirror/view";
import { i18n } from "../../../shared/i18n/i18n.svelte";
import { formatKeybinding } from "../../shortcuts/platform";
import { localizeCommands } from "./editorCommandsI18n";
import { insertBlock, setLinePrefix, wrapInline, type SlashRange } from "./editorEdits";

/**
 * ES: Comando del editor disponible por atajo y en el menú slash. Sin `keybinding` solo vive en el menú.
 * EN: Editor command available via shortcut and slash menu. Without `keybinding` it lives only in the menu.
 */
export interface EditorCommand {
  id: string;
  label: string;
  description: string;
  category: "heading" | "inline" | "block" | "advanced";
  iconText: string;
  keybinding?: string;
  shortcutDisplay: string;
  run: (view: EditorView, slashRange?: SlashRange) => boolean;
}

type CommandInput = Omit<EditorCommand, "shortcutDisplay">;

/**
 * ES: Textos de ayuda (placeholders) en el idioma activo al momento de insertar.
 * EN: Help texts (placeholders) in the active language at insertion time.
 */
const ph = () => i18n.current.slashMenu;

/**
 * ES: Plantilla de bloque de código: lenguaje `markdown` por defecto (campo 1) y cuerpo (campo 2).
 * EN: Code block template: `markdown` as default language (field 1) and body (field 2).
 */
const codeBlockParts = () => ["```", { ph: "markdown" }, "\n", { ph: ph().phCode }, "\n```\n"];

/**
 * ES: Tabla 2x2 con encabezados y celdas editables recorribles con Tab.
 * EN: 2x2 table with headers and cells editable and reachable with Tab.
 */
const tableParts = () => {
  const h = ph().phTableHeader;
  const c = ph().phTableCell;
  return [
    "| ", { ph: `${h} 1` }, " | ", { ph: `${h} 2` }, " |\n| :--- | :--- |\n| ",
    { ph: `${c} 1` }, " | ", { ph: `${c} 2` }, " |\n",
  ];
};

const headings: CommandInput[] = [1, 2, 3, 4, 5, 6].map((level) => ({
  id: `heading-${level}`,
  label: `Título ${level}`,
  description: "",
  category: "heading",
  iconText: "#".repeat(level),
  keybinding: `Mod-Alt-${level}`,
  run: (view, range) => setLinePrefix(view, `${"#".repeat(level)} `, range),
}));

const inlineCommands: CommandInput[] = [
  {
    id: "bold", label: "Negrita", description: "", category: "inline", iconText: "B", keybinding: "Mod-b",
    run: (view, range) => wrapInline(view, "**", "**", ph().phText, range),
  },
  {
    id: "italic", label: "Cursiva", description: "", category: "inline", iconText: "I", keybinding: "Mod-i",
    run: (view, range) => wrapInline(view, "*", "*", ph().phText, range),
  },
  {
    id: "strikethrough", label: "Tachado", description: "", category: "inline", iconText: "S", keybinding: "Mod-Shift-x",
    run: (view, range) => wrapInline(view, "~~", "~~", ph().phText, range),
  },
  {
    id: "inline-code", label: "Código en línea", description: "", category: "inline", iconText: "</>", keybinding: "Mod-e",
    run: (view, range) => wrapInline(view, "`", "`", ph().phCode, range),
  },
  {
    id: "link", label: "Enlace", description: "", category: "inline", iconText: "🔗", keybinding: "Mod-k",
    run: (view, range) =>
      wrapInline(view, "[", "](", ph().phLink, range, { ph: "https://", close: ")" }),
  },
];

const blockCommands: CommandInput[] = [
  {
    id: "code-block", label: "Bloque de código", description: "", category: "block", iconText: "```", keybinding: "Mod-Alt-c",
    run: (view, range) => insertBlock(view, codeBlockParts(), range),
  },
  {
    id: "math-block", label: "Fórmula matemática", description: "", category: "block", iconText: "$$", keybinding: "Mod-Shift-m",
    run: (view, range) =>
      insertBlock(view, ["$$\n", { ph: "\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}" }, "\n$$\n"], range),
  },
  {
    id: "mermaid-block", label: "Diagrama Mermaid", description: "", category: "block", iconText: "📊",
    run: (view, range) =>
      insertBlock(
        view,
        [
          "```mermaid\nflowchart TD\n  A[", { ph: ph().phNodeStart }, "] --> B(", { ph: ph().phNodeProcess },
          ")\n  B --> C[", { ph: ph().phNodeEnd }, "]\n```\n",
        ],
        range,
      ),
  },
  {
    id: "table", label: "Tabla Markdown", description: "", category: "block", iconText: "▦", keybinding: "Mod-Alt-Shift-t",
    run: (view, range) => insertBlock(view, tableParts(), range),
  },
  {
    id: "quote", label: "Cita", description: "", category: "block", iconText: ">", keybinding: "Mod-Alt-q",
    run: (view, range) => setLinePrefix(view, "> ", range),
  },
  {
    id: "bullet-list", label: "Lista con viñetas", description: "", category: "block", iconText: "•", keybinding: "Mod-Shift-8",
    run: (view, range) => setLinePrefix(view, "- ", range),
  },
  {
    id: "number-list", label: "Lista numerada", description: "", category: "block", iconText: "1.", keybinding: "Mod-Shift-7",
    run: (view, range) => setLinePrefix(view, "1. ", range),
  },
  {
    id: "task-list", label: "Lista de tareas", description: "", category: "block", iconText: "☑", keybinding: "Mod-Shift-9",
    run: (view, range) => setLinePrefix(view, "- [ ] ", range),
  },
  {
    id: "callout", label: "Alerta GFM", description: "", category: "block", iconText: "⚠", keybinding: "Mod-Alt-o",
    run: (view, range) => insertBlock(view, ["> [!NOTE]\n> ", { ph: ph().phCallout }, "\n"], range),
  },
  {
    id: "divider", label: "Línea divisoria", description: "", category: "block", iconText: "―",
    run: (view, range) => insertBlock(view, ["---\n\n"], range),
  },
];

/**
 * ES: Catálogo principal; `shortcutDisplay` se deriva del `keybinding` (fuente única de verdad).
 * EN: Main catalog; `shortcutDisplay` is derived from `keybinding` (single source of truth).
 */
export const EDITOR_COMMANDS: EditorCommand[] = [...headings, ...inlineCommands, ...blockCommands].map(
  (cmd) => ({ ...cmd, shortcutDisplay: cmd.keybinding ? formatKeybinding(cmd.keybinding) : "" }),
);

/**
 * ES: Comandos con etiquetas y descripciones traducidas según el idioma activo.
 * EN: Commands with labels and descriptions localized to the active language.
 */
export function getLocalizedCommands(): EditorCommand[] {
  return localizeCommands(EDITOR_COMMANDS);
}
