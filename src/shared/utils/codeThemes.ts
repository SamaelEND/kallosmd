/**
 * Temas de color para código (editor, vista previa y HTML exportado).
 * Todo es local: no depende de fuentes ni recursos externos.
 */
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import type { CodeThemeId } from "../../core/types";

export interface Palette {
  bg: string;
  fg: string;
  border: string;
  gutter: string;
  activeLine: string;
  selection: string;
  caret: string;
  keyword: string;
  type: string;
  fn: string;
  variable: string;
  string: string;
  number: string;
  comment: string;
  regexp: string;
  tag: string;
  attr: string;
  operator: string;
  heading: string;
  link: string;
  invalid: string;
}

export interface CodeTheme {
  id: CodeThemeId;
  label: string;
  description: string;
  light: Palette;
  dark: Palette;
}

export const CODE_THEMES: CodeTheme[] = [
  {
    id: "vscode",
    label: "VS Code",
    description: "Dark+ / Light+ suavizado, bajo cansancio visual",
    dark: {
      bg: "#16181d",
      fg: "#e2e8f0",
      border: "#262a33",
      gutter: "#64748b",
      activeLine: "rgba(255,255,255,0.035)",
      selection: "rgba(38,79,120,0.7)",
      caret: "#aeafad",
      keyword: "#569cd6",
      type: "#4ec9b0",
      fn: "#569cd6",
      variable: "#9cdcfe",
      string: "#ce9178",
      number: "#b5cea8",
      comment: "#6a9955",
      regexp: "#d16969",
      tag: "#569cd6",
      attr: "#9cdcfe",
      operator: "#d4d4d4",
      heading: "#569cd6",
      link: "#9cdcfe",
      invalid: "#f44747",
    },
    light: {
      bg: "#fbfaf7",
      fg: "#2b2b2b",
      border: "#e4e1d8",
      gutter: "#9a9890",
      activeLine: "rgba(0,0,0,0.035)",
      selection: "rgba(173,214,255,0.6)",
      caret: "#0451a5",
      keyword: "#0451a5",
      type: "#267f99",
      fn: "#795e26",
      variable: "#001080",
      string: "#a3382f",
      number: "#098658",
      comment: "#5e8a5e",
      regexp: "#811f3f",
      tag: "#800000",
      attr: "#c4372d",
      operator: "#2b2b2b",
      heading: "#800000",
      link: "#0451a5",
      invalid: "#cd3131",
    },
  },
  {
    id: "solarized",
    label: "Solarized",
    description: "Contraste calibrado, diseñado contra la fatiga",
    dark: {
      bg: "#002b36",
      fg: "#93a1a1",
      border: "#0a3a46",
      gutter: "#586e75",
      activeLine: "#073642",
      selection: "rgba(38,139,210,0.3)",
      caret: "#93a1a1",
      keyword: "#859900",
      type: "#b58900",
      fn: "#268bd2",
      variable: "#268bd2",
      string: "#2aa198",
      number: "#d33682",
      comment: "#657b83",
      regexp: "#dc322f",
      tag: "#268bd2",
      attr: "#93a1a1",
      operator: "#93a1a1",
      heading: "#cb4b16",
      link: "#268bd2",
      invalid: "#dc322f",
    },
    light: {
      bg: "#fdf6e3",
      fg: "#586e75",
      border: "#e6dfc8",
      gutter: "#93a1a1",
      activeLine: "#eee8d5",
      selection: "rgba(38,139,210,0.22)",
      caret: "#586e75",
      keyword: "#859900",
      type: "#b58900",
      fn: "#268bd2",
      variable: "#268bd2",
      string: "#2aa198",
      number: "#d33682",
      comment: "#93a1a1",
      regexp: "#dc322f",
      tag: "#268bd2",
      attr: "#657b83",
      operator: "#586e75",
      heading: "#cb4b16",
      link: "#268bd2",
      invalid: "#dc322f",
    },
  },
  {
    id: "one",
    label: "One Dark / Light",
    description: "Paleta pastel equilibrada de Atom",
    dark: {
      bg: "#282c34",
      fg: "#abb2bf",
      border: "#353b45",
      gutter: "#636d83",
      activeLine: "#2c313c",
      selection: "rgba(62,68,81,0.9)",
      caret: "#528bff",
      keyword: "#c678dd",
      type: "#e5c07b",
      fn: "#61afef",
      variable: "#e06c75",
      string: "#98c379",
      number: "#d19a66",
      comment: "#5c6370",
      regexp: "#56b6c2",
      tag: "#e06c75",
      attr: "#d19a66",
      operator: "#56b6c2",
      heading: "#e06c75",
      link: "#61afef",
      invalid: "#ff6b6b",
    },
    light: {
      bg: "#fafafa",
      fg: "#383a42",
      border: "#e5e5e6",
      gutter: "#9d9d9f",
      activeLine: "#f0f0f1",
      selection: "rgba(229,229,230,1)",
      caret: "#526fff",
      keyword: "#a626a4",
      type: "#c18401",
      fn: "#4078f2",
      variable: "#e45649",
      string: "#50a14f",
      number: "#986801",
      comment: "#a0a1a7",
      regexp: "#0184bc",
      tag: "#e45649",
      attr: "#986801",
      operator: "#0184bc",
      heading: "#e45649",
      link: "#4078f2",
      invalid: "#ca1243",
    },
  },
  {
    id: "github",
    label: "GitHub",
    description: "GitHub Light y Dark Dimmed (oscuro azulado y suave)",
    dark: {
      bg: "#22272e",
      fg: "#adbac7",
      border: "#373e47",
      gutter: "#636e7b",
      activeLine: "rgba(99,110,123,0.12)",
      selection: "rgba(65,132,228,0.4)",
      caret: "#adbac7",
      keyword: "#f47067",
      type: "#f69d50",
      fn: "#dcbdfb",
      variable: "#6cb6ff",
      string: "#96d0ff",
      number: "#6cb6ff",
      comment: "#768390",
      regexp: "#8ddb8c",
      tag: "#8ddb8c",
      attr: "#6cb6ff",
      operator: "#adbac7",
      heading: "#6cb6ff",
      link: "#6cb6ff",
      invalid: "#ff938a",
    },
    light: {
      bg: "#ffffff",
      fg: "#24292f",
      border: "#d0d7de",
      gutter: "#8c959f",
      activeLine: "rgba(234,238,242,0.55)",
      selection: "rgba(84,174,255,0.3)",
      caret: "#0969da",
      keyword: "#cf222e",
      type: "#953800",
      fn: "#8250df",
      variable: "#0550ae",
      string: "#0a3069",
      number: "#0550ae",
      comment: "#6e7781",
      regexp: "#116329",
      tag: "#116329",
      attr: "#0550ae",
      operator: "#24292f",
      heading: "#0550ae",
      link: "#0969da",
      invalid: "#cf222e",
    },
  },
];

export const DEFAULT_CODE_THEME: CodeThemeId = "vscode";

export function isCodeThemeId(value: unknown): value is CodeThemeId {
  return CODE_THEMES.some((theme) => theme.id === value);
}

export function getPalette(id: CodeThemeId, dark: boolean): Palette {
  const theme = CODE_THEMES.find((item) => item.id === id) ?? CODE_THEMES[0];
  return dark ? theme.dark : theme.light;
}

/**
 * Variables CSS que consumen los bloques de código de la vista previa
 * y el HTML exportado.
 */
export function paletteToCssVars(p: Palette): Record<string, string> {
  return {
    "--code-bg": p.bg,
    "--code-fg": p.fg,
    "--code-border": p.border,
    "--tok-base": p.fg,
    "--tok-keyword": p.keyword,
    "--tok-type": p.type,
    "--tok-function": p.fn,
    "--tok-variable": p.variable,
    "--tok-string": p.string,
    "--tok-number": p.number,
    "--tok-comment": p.comment,
    "--tok-regexp": p.regexp,
    "--tok-tag": p.tag,
    "--tok-attr": p.attr,
    "--tok-add": p.number,
    "--tok-del": p.regexp,
  };
}

export function paletteToCssText(p: Palette): string {
  return Object.entries(paletteToCssVars(p))
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
}

/**
 * Extensiones de CodeMirror (tema de interfaz + resaltado de sintaxis).
 */
export function buildEditorExtensions(p: Palette, dark: boolean): Extension {
  const view = EditorView.theme(
    {
      "&": {
        color: p.fg,
        backgroundColor: p.bg,
        height: "100%",
        fontFamily:
          '"JetBrains Mono", ui-monospace, Menlo, Monaco, Consolas, monospace',
        fontSize: "13.75px",
      },
      ".cm-content": {
        caretColor: p.caret,
        padding: "18px 22px",
        lineHeight: "1.68",
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: p.caret,
        borderLeftWidth: "2px",
      },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
        { backgroundColor: `${p.selection} !important` },
      ".cm-panels": { backgroundColor: p.bg, color: p.fg },
      ".cm-gutters": {
        backgroundColor: p.bg,
        color: p.gutter,
        borderRight: `1px solid ${p.border}`,
        paddingLeft: "8px",
        paddingRight: "8px",
      },
      ".cm-activeLine": { backgroundColor: p.activeLine },
      ".cm-activeLineGutter": {
        backgroundColor: p.activeLine,
        color: p.fg,
        fontWeight: "600",
      },
      ".cm-foldGutter span": { color: p.gutter },
      "&.cm-focused .cm-matchingBracket": {
        backgroundColor: p.selection,
        outline: `1px solid ${p.border}`,
      },
    },
    { dark },
  );

  const highlight = HighlightStyle.define([
    { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.definitionKeyword, t.operatorKeyword], color: p.keyword },
    { tag: [t.atom, t.self, t.bool, t.null, t.constant(t.variableName)], color: p.keyword },
    { tag: [t.typeName, t.className, t.namespace], color: p.type },
    { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName))], color: p.fn },
    { tag: [t.variableName, t.definition(t.variableName), t.propertyName, t.labelName, t.special(t.variableName)], color: p.variable },
    { tag: [t.string, t.special(t.string), t.attributeValue], color: p.string },
    { tag: [t.number, t.integer, t.float], color: p.number },
    { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: p.comment, fontStyle: "italic" },
    { tag: [t.regexp, t.escape], color: p.regexp },
    { tag: [t.tagName], color: p.tag },
    { tag: [t.attributeName], color: p.attr },
    { tag: [t.meta, t.annotation, t.modifier], color: p.type },
    { tag: [t.operator, t.punctuation, t.compareOperator, t.logicOperator, t.arithmeticOperator], color: p.operator },
    { tag: t.heading, color: p.heading, fontWeight: "600" },
    { tag: t.heading1, color: p.heading, fontWeight: "bold" },
    { tag: t.strong, color: p.fn, fontWeight: "bold" },
    { tag: t.emphasis, color: p.type, fontStyle: "italic" },
    { tag: t.strikethrough, textDecoration: "line-through" },
    { tag: [t.link, t.url], color: p.link, textDecoration: "underline" },
    { tag: t.monospace, color: p.string },
    // Marcas de sintaxis Markdown (*, #, -, >, `): discretas para no competir con el texto
    { tag: [t.processingInstruction, t.contentSeparator], color: p.gutter },
    { tag: t.invalid, color: p.invalid },
  ]);

  return [view, syntaxHighlighting(highlight)];
}

