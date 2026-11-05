<script lang="ts">
  /**
   * ES: Componente Editor basado en CodeMirror 6 con resaltado Markdown, números de línea, minimapa y temas.
   * EN: CodeMirror 6 Editor component with Markdown highlighting, line numbers, minimap, and themes.
   */
  import { onMount, onDestroy } from "svelte";
  import {
    EditorView,
    lineNumbers,
    highlightActiveLineGutter,
    highlightSpecialChars,
    drawSelection,
    dropCursor,
    rectangularSelection,
    crosshairCursor,
    highlightActiveLine,
    keymap,
  } from "@codemirror/view";
  import { EditorState, Compartment, type Extension } from "@codemirror/state";
  import {
    defaultKeymap,
    history,
    historyKeymap,
    indentWithTab,
  } from "@codemirror/commands";
  import { markdown } from "@codemirror/lang-markdown";
  import { languages } from "@codemirror/language-data";
  import { foldGutter, bracketMatching } from "@codemirror/language";
  import { buildEditorExtensions, getPalette } from "../../lib/codeThemes";
  import type { CodeThemeId } from "../../types";
  import { showMinimap } from "@replit/codemirror-minimap";

  interface Props {
    documentId?: string;
    value: string;
    isDark?: boolean;
    codeTheme?: CodeThemeId;
    showMinimapEnabled?: boolean;
    showLineNumbersEnabled?: boolean;
    wordWrapEnabled?: boolean;
    onChange?: (value: string) => void;
    onEditorScroll?: (e: Event) => void;
  }

  let {
    documentId: _documentId = "",
    value = "",
    isDark = true,
    codeTheme = "vscode",
    showMinimapEnabled = true,
    showLineNumbersEnabled = true,
    wordWrapEnabled = true,
    onChange,
    onEditorScroll,
  }: Props = $props();

  let editorContainer = $state<HTMLDivElement | null>(null);
  let view = $state<EditorView | null>(null);

  const themeCompartment = new Compartment();
  const minimapCompartment = new Compartment();
  const lineNumbersCompartment = new Compartment();
  const wordWrapCompartment = new Compartment();

  const currentPalette = $derived(getPalette(codeTheme, isDark));

  function themeExtensions(): Extension {
    return buildEditorExtensions(currentPalette, isDark);
  }

  function createMinimapExtension() {
    return showMinimap.compute(["doc"], () => ({
      create: () => ({ dom: document.createElement("div") }),
      displayText: "blocks",
      showOverlay: "always",
    }));
  }

  /**
   * ES: Inicializa la instancia de EditorView con sus extensiones y escuchadores de eventos.
   * EN: Initializes the EditorView instance with its extensions and event listeners.
   */
  function initEditor(): void {
    if (!editorContainer) return;

    const currentThemeExt = themeExtensions();
    const minimapExt = showMinimapEnabled ? createMinimapExtension() : [];
    const lineNumbersExt = showLineNumbersEnabled
      ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()]
      : [];
    const wordWrapExt = wordWrapEnabled ? EditorView.lineWrapping : [];

    const state = EditorState.create({
      doc: value,
      extensions: [
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        bracketMatching(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        markdown({ codeLanguages: languages }),
        themeCompartment.of(currentThemeExt),
        minimapCompartment.of(minimapExt),
        lineNumbersCompartment.of(lineNumbersExt),
        wordWrapCompartment.of(wordWrapExt),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && onChange) {
            const docString = update.state.doc.toString();
            onChange(docString);
          }
        }),
      ],
    });

    view = new EditorView({
      state,
      parent: editorContainer,
    });

    if (view.scrollDOM) {
      view.scrollDOM.addEventListener("scroll", (e) => {
        onEditorScroll?.(e);
      });
    }
  }

  // ES: Aplica cambios externos de contenido preservando la selección y el desplazamiento.
  // EN: Applies external content changes while preserving selection and scroll position.
  $effect(() => {
    const docValue = value;
    if (!view) return;
    const currentDocString = view.state.doc.toString();
    if (docValue !== currentDocString) {
      const prevScrollTop = view.scrollDOM ? view.scrollDOM.scrollTop : 0;
      const prevSelection = view.state.selection;

      let start = 0;
      while (
        start < currentDocString.length &&
        start < docValue.length &&
        currentDocString[start] === docValue[start]
      ) {
        start++;
      }
      let oldEnd = currentDocString.length;
      let newEnd = docValue.length;
      while (
        oldEnd > start &&
        newEnd > start &&
        currentDocString[oldEnd - 1] === docValue[newEnd - 1]
      ) {
        oldEnd--;
        newEnd--;
      }

      view.dispatch({
        changes: {
          from: start,
          to: oldEnd,
          insert: docValue.slice(start, newEnd),
        },
        selection:
          prevSelection.main.to <= docValue.length ? prevSelection : undefined,
        scrollIntoView: false,
      });

      if (view.scrollDOM && view.scrollDOM.scrollTop !== prevScrollTop) {
        view.scrollDOM.scrollTop = prevScrollTop;
      }
    }
  });

  // ES: Reconfigura el tema de colores del editor cuando cambia la paleta o el modo oscuro.
  // EN: Reconfigures the editor color theme when the palette or dark mode changes.
  $effect(() => {
    const themeExt = themeExtensions();
    if (!view) return;
    view.dispatch({
      effects: themeCompartment.reconfigure(themeExt),
    });
  });

  // ES: Activa o desactiva la extensión del minimapa de forma reactiva.
  // EN: Reactively enables or disables the minimap extension.
  $effect(() => {
    const minimapActive = showMinimapEnabled;
    if (!view) return;
    const minimapExt = minimapActive ? createMinimapExtension() : [];
    view.dispatch({
      effects: minimapCompartment.reconfigure(minimapExt),
    });
  });

  // ES: Activa o desactiva el margen de números de línea y plegado de código.
  // EN: Enables or disables the line numbers and code folding gutter.
  $effect(() => {
    const lineNumbersActive = showLineNumbersEnabled;
    if (!view) return;
    const lineNumbersExt = lineNumbersActive
      ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()]
      : [];
    view.dispatch({
      effects: lineNumbersCompartment.reconfigure(lineNumbersExt),
    });
  });

  // ES: Activa o desactiva el ajuste automático de línea (word wrap).
  // EN: Enables or disables automatic line wrapping (word wrap).
  $effect(() => {
    const wrapActive = wordWrapEnabled;
    if (!view) return;
    const wordWrapExt = wrapActive ? EditorView.lineWrapping : [];
    view.dispatch({
      effects: wordWrapCompartment.reconfigure(wordWrapExt),
    });
  });

  onMount(() => {
    initEditor();
  });

  onDestroy(() => {
    if (view) {
      view.destroy();
      view = null;
    }
  });

  /**
   * ES: Inserta un fragmento de sintaxis Markdown alrededor de la selección actual.
   * EN: Inserts a Markdown syntax snippet around the current selection.
   */
  export function insertSnippet(
    prefix: string,
    suffix = "",
    placeholder = "",
  ): void {
    if (!view) return;

    const { state } = view;
    const { from, to } = state.selection.main;
    const selectedText = state.sliceDoc(from, to) || placeholder;
    const replacement = `${prefix}${selectedText}${suffix}`;

    view.dispatch({
      changes: { from, to, insert: replacement },
      selection: {
        anchor: from + prefix.length,
        head: from + prefix.length + selectedText.length,
      },
    });

    view.focus();
  }

  export function getScrollerElement(): HTMLElement | null {
    return view?.scrollDOM || null;
  }

  export function focus(): void {
    if (view) view.focus();
  }
</script>

<div
  class="editor-wrapper"
  class:hide-line-numbers={!showLineNumbersEnabled}
  class:hide-minimap={!showMinimapEnabled}
  style="--cm-palette-bg: {currentPalette.bg}; --cm-palette-fg: {currentPalette.fg}; --cm-palette-border: {currentPalette.border};"
  bind:this={editorContainer}
></div>

<style>
  .editor-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background-color: var(--cm-palette-bg, var(--editor-bg, #16181d));
  }

  .editor-wrapper.hide-line-numbers :global(.cm-gutters) {
    display: none !important;
  }

  .editor-wrapper.hide-minimap :global(.cm-minimap-gutter),
  .editor-wrapper.hide-minimap :global(.cm-minimap-overlay-container) {
    display: none !important;
  }

  :global(.cm-editor) {
    height: 100%;
    width: 100%;
    outline: none !important;
    background-color: var(--cm-palette-bg, var(--editor-bg, #16181d));
    color: var(--cm-palette-fg, var(--editor-text, #e2e8f0));
  }

  :global(.cm-scroller) {
    overflow: auto;
    font-family: inherit;
    background-color: var(--cm-palette-bg, var(--editor-bg, #16181d));
  }

  :global(.cm-gutters) {
    background-color: var(--cm-palette-bg, var(--editor-gutter-bg, #16181d));
    border-right: 1px solid
      var(--cm-palette-border, var(--editor-gutter-border, #212429));
  }

  :global(.cm-minimap-gutter) {
    background-color: var(
      --cm-palette-bg,
      var(--editor-bg, #16181d)
    ) !important;
    border-left: 1px solid
      var(--cm-palette-border, var(--border-subtle, #212429)) !important;
  }

  @media (max-width: 768px) {
    .editor-wrapper :global(.cm-minimap-gutter),
    .editor-wrapper :global(.cm-minimap-overlay-container) {
      display: none !important;
    }

    .editor-wrapper :global(.cm-content) {
      padding: 12px 14px !important;
      font-size: 14.5px !important;
    }

    .editor-wrapper :global(.cm-lineNumbers .cm-gutterElement) {
      padding-left: 6px !important;
      padding-right: 6px !important;
      min-width: 28px !important;
      font-size: 12px !important;
    }
  }
</style>
