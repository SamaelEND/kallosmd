/**
 * ES: Tema visual aislado para el modo Live Preview en CodeMirror 6.
 *     Estiliza líneas renderizadas, encabezados, bloques HTML/código/diagramas y selectores de cursor.
 * EN: Isolated visual theme for Live Preview mode in CodeMirror 6.
 *     Styles rendered lines, headings, HTML/code/diagram blocks, and cursor selectors.
 */

import { EditorView } from "@codemirror/view";

export const livePreviewTheme = EditorView.baseTheme({
  "&.cm-live-preview-mode": {
    position: "relative",
  },
  /* ES: Lienzo exterior diferenciado y hoja central con su propio tono para delimitar el área de escritura */
  /* EN: Differentiated outer canvas and central sheet with its own tone to delimit the writing area */
  "&.cm-live-preview-mode .cm-scroller": {
    fontFamily:
      'var(--font-sans, "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
    lineHeight: "1.7",
    backgroundColor:
      "color-mix(in srgb, var(--cm-palette-bg, #16181d) 90%, #64748b 10%) !important",
    backgroundImage:
      "linear-gradient(to right, var(--cm-palette-bg, #16181d), var(--cm-palette-bg, #16181d)) !important",
    backgroundSize: "var(--live-sheet-actual-px, min(1076px, 100%)) 100% !important",
    backgroundPosition: "center top !important",
    backgroundRepeat: "no-repeat !important",
  },
  /* ES: Sin padding horizontal en .cm-content para que la selección de CM6 jamás desborde los bloques */
  /* EN: Zero horizontal padding on .cm-content so CM6 selection never overflows blocks */
  "&.cm-live-preview-mode .cm-content": {
    boxSizing: "border-box",
    width: "min(var(--live-max-width, 1020px), calc(100% - 64px)) !important",
    maxWidth: "min(var(--live-max-width, 1020px), calc(100% - 64px)) !important",
    margin: "0 auto",
    padding: "28px 0 72px !important",
    fontSize: "1.02rem",
    caretColor: "var(--accent-color, #5fb3a3)",
  },
  /* ES: Modo de código fuente Markdown dentro de Live Preview (activado con Ctrl+E) */
  /* EN: Raw Markdown source mode inside Live Preview (toggled with Ctrl+E) */
  "&.cm-live-preview-mode.cm-live-raw-source-active .cm-content": {
    fontFamily:
      'var(--font-mono, "JetBrains Mono", "Fira Code", ui-monospace, monospace)',
    fontSize: "0.95rem",
    lineHeight: "1.65",
  },
  "&.cm-live-preview-mode .cm-line": {
    padding: "3px 4px",
    borderRadius: "4px",
  },
  "&.cm-live-preview-mode .cm-activeLine": {
    backgroundColor: "transparent !important",
  },
  /* ES: Líneas secundarias colapsadas de bloques multilínea inactivos */
  /* EN: Collapsed secondary lines of inactive multiline blocks */
  "&.cm-live-preview-mode .cm-line.cm-live-collapsed-line": {
    height: "0 !important",
    minHeight: "0 !important",
    padding: "0 !important",
    margin: "0 !important",
    overflow: "hidden !important",
    fontSize: "0 !important",
    lineHeight: "0 !important",
    border: "none !important",
  },
  /* ES: Línea en blanco estructural entre bloques o párrafos (espaciado uniforme ~12px) */
  /* EN: Structural blank line between blocks or paragraphs (uniform spacing ~12px) */
  "&.cm-live-preview-mode .cm-line.cm-md-gap": {
    height: "var(--cm-gap-height, 0.75em) !important",
    minHeight: "var(--cm-gap-height, 0.75em) !important",
    lineHeight: "var(--cm-gap-height, 0.75em) !important",
    padding: "0 4px !important",
    margin: "0 !important",
    fontSize: "1rem",
    border: "none !important",
    backgroundColor: "transparent !important",
  },
  /* ES: Fila activa con el cursor en bloque redondeado con fondo verdoso menos transparente */
  /* EN: Active row with cursor inside a rounded block with less transparent greenish background */
  "&.cm-live-preview-mode .cm-line.cm-live-active-raw-line": {
    fontFamily:
      'var(--font-mono, "JetBrains Mono", "Fira Code", ui-monospace, monospace)',
    fontSize: "0.96rem",
    backgroundColor:
      "color-mix(in srgb, var(--accent-color, #5fb3a3) 22%, var(--cm-palette-bg, #16181d)) !important",
    border:
      "1px solid color-mix(in srgb, var(--accent-color, #5fb3a3) 55%, transparent) !important",
    borderRadius: "8px !important",
    padding: "6px 14px !important",
    margin: "0 !important",
    boxShadow: "none !important",
    transition: "background-color 100ms ease, border-color 100ms ease",
  },
  ".cm-live-empty-placeholder": {
    color: "color-mix(in srgb, var(--cm-palette-fg, #cbd5e1) 48%, transparent) !important",
    fontFamily:
      'var(--font-sans, "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
    fontSize: "0.96rem",
    fontWeight: "400",
    pointerEvents: "none",
    userSelect: "none",
  },
  /* ES: Bloque multilínea activo: una sola caja verdosa continua menos transparente */
  /* EN: Active multiline block: one continuous greenish box with lower transparency */
  "&.cm-live-preview-mode .cm-line.cm-live-active-raw-block": {
    fontFamily:
      'var(--font-mono, "JetBrains Mono", "Fira Code", ui-monospace, monospace)',
    fontSize: "0.92rem",
    lineHeight: "1.6",
    backgroundColor:
      "color-mix(in srgb, var(--accent-color, #5fb3a3) 22%, var(--cm-palette-bg, #16181d)) !important",
    borderLeft:
      "1px solid color-mix(in srgb, var(--accent-color, #5fb3a3) 55%, transparent) !important",
    borderRight:
      "1px solid color-mix(in srgb, var(--accent-color, #5fb3a3) 55%, transparent) !important",
    borderTop: "0 !important",
    borderBottom: "0 !important",
    padding: "1px 14px !important",
    margin: "0 !important",
    borderRadius: "0 !important",
  },
  "&.cm-live-preview-mode .cm-line.cm-live-active-raw-block-start": {
    borderTop:
      "1px solid color-mix(in srgb, var(--accent-color, #5fb3a3) 55%, transparent) !important",
    borderTopLeftRadius: "8px !important",
    borderTopRightRadius: "8px !important",
    paddingTop: "8px !important",
  },
  "&.cm-live-preview-mode .cm-line.cm-live-active-raw-block-end": {
    borderBottom:
      "1px solid color-mix(in srgb, var(--accent-color, #5fb3a3) 55%, transparent) !important",
    borderBottomLeftRadius: "8px !important",
    borderBottomRightRadius: "8px !important",
    paddingBottom: "8px !important",
  },
  /* ES: Encabezado activo con cursor dentro del mismo bloque verdoso redondeado */
  /* EN: Active heading with cursor inside the same rounded greenish block */
  "&.cm-live-preview-mode .cm-line.cm-live-active-heading": {
    backgroundColor:
      "color-mix(in srgb, var(--accent-color, #5fb3a3) 22%, var(--cm-palette-bg, #16181d)) !important",
    border:
      "1px solid color-mix(in srgb, var(--accent-color, #5fb3a3) 55%, transparent) !important",
    borderRadius: "8px !important",
    paddingLeft: "12px !important",
    paddingRight: "12px !important",
    transition: "background-color 100ms ease, border-color 100ms ease",
  },
  ".cm-live-hash-marker": {
    color: "var(--accent-color, #5fb3a3)",
    opacity: "0.65",
    userSelect: "none",
    marginRight: "4px",
    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
    transition: "opacity 100ms ease",
  },
  /* ES: Encabezados limpios cuando el cursor no está en la línea */
  /* EN: Clean headings when the cursor is not in the line */
  "&.cm-live-preview-mode .cm-line.cm-live-h1": {
    fontSize: "1.85rem",
    fontWeight: "800",
    lineHeight: "1.28",
    paddingTop: "16px",
    paddingBottom: "4px",
    marginTop: "0 !important",
    marginBottom: "0 !important",
  },
  "&.cm-live-preview-mode .cm-line.cm-live-h2": {
    fontSize: "1.38rem",
    fontWeight: "750",
    lineHeight: "1.32",
    paddingTop: "14px",
    paddingBottom: "3px",
    marginTop: "0 !important",
    marginBottom: "0 !important",
  },
  "&.cm-live-preview-mode .cm-line.cm-live-h3": {
    fontSize: "1.16rem",
    fontWeight: "700",
    lineHeight: "1.38",
    paddingTop: "10px",
    paddingBottom: "2px",
    marginTop: "0 !important",
    marginBottom: "0 !important",
  },
  "&.cm-live-preview-mode .cm-line.cm-live-h4, &.cm-live-preview-mode .cm-line.cm-live-h5, &.cm-live-preview-mode .cm-line.cm-live-h6":
  {
    fontSize: "1.02rem",
    fontWeight: "650",
    paddingTop: "6px",
    paddingBottom: "2px",
    marginTop: "0 !important",
    marginBottom: "0 !important",
  },
  /* ES: Bloques HTML renderizados (código cercado, tablas, alertas GFM, KaTeX, details) */
  /* EN: Rendered HTML blocks (fenced code, tables, GFM alerts, KaTeX, details) */
  ".reading-table-content.cm-live-html-block": {
    maxWidth: "100% !important",
    margin: "0 !important",
    padding: "0 !important",
    whiteSpace: "normal !important",
    cursor: "text !important",
  },
  ".reading-table-content.cm-live-html-block pre, .reading-table-content.cm-live-html-block code, .reading-table-content.cm-live-html-block table, .reading-table-content.cm-live-html-block td, .reading-table-content.cm-live-html-block th, .reading-table-content.cm-live-html-block p, .reading-table-content.cm-live-html-block blockquote":
  {
    cursor: "text !important",
  },
  /* ES: Cursor puntero exclusivamente para elementos interactivos */
  /* EN: Pointer cursor exclusively for interactive elements */
  ".reading-table-content.cm-live-html-block a, .reading-table-content.cm-live-html-block button, .reading-table-content.cm-live-html-block summary, .reading-table-content.cm-live-html-block input[type='checkbox'], .cm-live-checkbox, .code-copy-btn, .cm-live-expand-btn, .cm-live-details-edit-btn, .cm-live-link":
  {
    cursor: "pointer !important",
  },
  ".reading-table-content.cm-live-html-block .code-block-wrapper": {
    margin: "0 !important",
    maxWidth: "100% !important",
  },
  ".reading-table-content.cm-live-html-block .table-container": {
    margin: "0 !important",
    maxWidth: "100% !important",
  },
  ".reading-table-content.cm-live-html-block > *": {
    marginTop: "0 !important",
    marginBottom: "0 !important",
  },
  ".cm-live-details-edit-btn": {
    float: "right",
    fontSize: "0.7rem",
    padding: "2px 8px",
    borderRadius: "4px",
    border: "1px solid rgba(128, 138, 155, 0.25)",
    background: "rgba(128, 138, 155, 0.12)",
    color: "var(--text-secondary, #94a3b8)",
    cursor: "pointer",
  },
  /* ES: Contenedor Mermaid en vivo (inactivo y vista previa bajo código activo) */
  /* EN: Live Mermaid container (inactive and live preview under active code) */
  ".cm-live-mermaid-box": {
    position: "relative",
    display: "block",
    width: "100%",
    backgroundColor: "var(--reading-diagram-bg, rgba(20, 23, 29, 0.82))",
    border: "1px solid rgba(128, 138, 155, 0.16)",
    borderRadius: "10px",
    padding: "18px 16px",
    margin: "0 !important",
    overflowX: "auto",
  },
  ".cm-live-mermaid-box.is-inactive-block": {
    cursor: "text !important",
    margin: "0 !important",
  },
  ".cm-live-mermaid-toolbar": {
    position: "absolute",
    top: "10px",
    right: "12px",
    zIndex: "3",
    display: "flex",
    gap: "6px",
  },
  ".cm-live-expand-btn": {
    border: "1px solid rgba(128, 138, 155, 0.24)",
    backgroundColor: "rgba(30, 34, 42, 0.88)",
    color: "var(--text-primary, #e2e8f0)",
    fontSize: "0.75rem",
    fontWeight: "500",
    padding: "4px 10px",
    borderRadius: "6px",
    cursor: "pointer",
    fontFamily: "var(--font-sans, inherit)",
  },
  ".cm-live-expand-btn:hover": {
    borderColor: "var(--accent-color, #5fb3a3)",
    color: "var(--accent-color, #5fb3a3)",
  },
  ".cm-live-mermaid-viewport": {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "80px",
  },
  ".cm-live-mermaid-error": {
    padding: "10px 12px",
    borderRadius: "6px",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    color: "#f87171",
    fontSize: "0.82rem",
  },
  ".cm-live-mermaid-error-title": {
    fontWeight: "700",
    marginBottom: "4px",
  },
  ".cm-live-mermaid-error-msg": {
    margin: "0",
    whiteSpace: "pre-wrap",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: "0.78rem",
  },
  /* ES: Widgets inline y glifos */
  /* EN: Inline widgets and glyphs */
  ".cm-live-bullet": {
    display: "inline-block",
    width: "1.1rem",
    color: "var(--text-secondary, #94a3b8)",
    fontWeight: "700",
    userSelect: "none",
  },
  ".cm-live-checkbox": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "17px",
    height: "17px",
    borderRadius: "4px",
    border: "1.5px solid var(--text-faint, #64748b)",
    marginRight: "8px",
    verticalAlign: "text-bottom",
    cursor: "pointer",
    userSelect: "none",
  },
  ".cm-live-checkbox.is-checked": {
    backgroundColor: "var(--accent-color, #5fb3a3)",
    borderColor: "var(--accent-color, #5fb3a3)",
    color: "#0f172a",
  },
  /* ES: Marcador de lista ordenada con el color del texto, igual que en Vista previa */
  /* EN: Ordered list marker using the text color, same as in Preview */
  ".cm-live-ol-marker, .cm-live-ol-marker *": {
    color: "var(--cm-palette-fg, inherit) !important",
    fontVariantNumeric: "tabular-nums",
  },
  /* ES: Líneas inactivas en blanco/negro según tema; la línea o bloque con foco muestra los colores del tema del editor */
  /* EN: Inactive lines in white/black by theme; the focused line or block shows the editor theme colors */
  "&.cm-live-preview-mode:not(.cm-live-raw-source-active) .cm-line.cm-live-inactive-line > span:not(.cm-live-link):not(.cm-live-footnote-ref), &.cm-live-preview-mode:not(.cm-live-raw-source-active) .cm-line.cm-live-inactive-line .cm-live-bold, &.cm-live-preview-mode:not(.cm-live-raw-source-active) .cm-line.cm-live-inactive-line .cm-live-bold *, &.cm-live-preview-mode:not(.cm-live-raw-source-active) .cm-line.cm-live-inactive-line .cm-live-italic, &.cm-live-preview-mode:not(.cm-live-raw-source-active) .cm-line.cm-live-inactive-line .cm-live-italic *, &.cm-live-preview-mode:not(.cm-live-raw-source-active) .cm-line.cm-live-inactive-line .cm-live-strike, &.cm-live-preview-mode:not(.cm-live-raw-source-active) .cm-line.cm-live-inactive-line .cm-live-strike *, &.cm-live-preview-mode:not(.cm-live-raw-source-active) .cm-line.cm-live-inactive-line .cm-live-inline-code, &.cm-live-preview-mode:not(.cm-live-raw-source-active) .cm-line.cm-live-inactive-line .cm-live-inline-code *":
    {
      color: "var(--cm-palette-fg, inherit) !important",
    },
  ".cm-live-footnote-ref, .cm-live-footnote-ref *": {
    verticalAlign: "super",
    fontSize: "0.76em",
    fontWeight: "650",
    lineHeight: "0",
    color: "var(--accent-color, #5fb3a3) !important",
  },
  ".cm-live-bold": { fontWeight: "700" },
  ".cm-live-italic": { fontStyle: "italic" },
  ".cm-live-strike": { textDecoration: "line-through", opacity: "0.78" },
  ".cm-live-sup": { verticalAlign: "super", fontSize: "0.75em", lineHeight: "0" },
  ".cm-live-sub": { verticalAlign: "sub", fontSize: "0.75em", lineHeight: "0" },
  ".cm-live-mark": {
    backgroundColor: "rgba(250, 204, 21, 0.28)",
    color: "inherit",
    padding: "1px 4px",
    borderRadius: "3px",
  },
  ".cm-live-abbr": {
    textDecoration: "underline dotted",
    textUnderlineOffset: "3px",
    cursor: "help",
  },
  ".cm-live-kbd": {
    fontFamily: 'var(--font-mono, "JetBrains Mono", ui-monospace, monospace)',
    fontSize: "0.8em",
    backgroundColor: "var(--bg-elevated, #20232a)",
    border: "1px solid var(--reading-border, #2b303c)",
    borderBottomWidth: "2px",
    borderRadius: "4px",
    padding: "1px 6px",
  },
  ".cm-live-inline-code": {
    fontFamily: 'var(--font-mono, "JetBrains Mono", ui-monospace, monospace)',
    fontSize: "0.86em",
    backgroundColor: "rgba(128, 138, 155, 0.16)",
    border: "1px solid rgba(128, 138, 155, 0.25)",
    borderRadius: "5px",
    padding: "1px 6px",
  },
  ".cm-live-link": {
    color: "var(--accent-color, #5fb3a3)",
    textDecoration: "underline",
    textUnderlineOffset: "3px",
  },
  ".cm-live-hr-widget": {
    display: "block",
    width: "100%",
    height: "1px",
    backgroundColor: "var(--border-color, rgba(128, 138, 155, 0.22))",
    margin: "0 !important",
    padding: "0 !important",
  },
  "&.cm-live-preview-mode .cm-line:has(.cm-live-hr-widget)": {
    padding: "8px 4px !important",
    margin: "0 !important",
  },
  ".cm-live-katex-inline": { cursor: "text !important", padding: "0 2px" },
});
