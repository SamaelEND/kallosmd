<script lang="ts">
  /**
   * Componente Editor de MD Studio.
   * Integra CodeMirror 6 con resaltado Markdown nativo, números de línea,
   * minimapa de alta fidelidad, sincronización de temas con la paleta original
   * y soporte para sincronización de scroll.
   */
  import { onMount, onDestroy } from 'svelte';
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
  } from '@codemirror/view';
  import { EditorState, Compartment, type Extension } from '@codemirror/state';
  import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
  import { markdown } from '@codemirror/lang-markdown';
  import { languages } from '@codemirror/language-data';
  import { foldGutter, bracketMatching } from '@codemirror/language';
  import { buildEditorExtensions, getPalette } from '../lib/codeThemes';
  import type { CodeThemeId } from '../types';
  import { showMinimap } from '@replit/codemirror-minimap';

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
    documentId = '',
    value = '',
    isDark = true,
    codeTheme = 'vscode',
    showMinimapEnabled = true,
    showLineNumbersEnabled = true,
    wordWrapEnabled = true,
    onChange,
    onEditorScroll,
  }: Props = $props();

  let editorContainer = $state<HTMLDivElement | null>(null);
  let view = $state<EditorView | null>(null);

  // Compartimentos para reconfiguración dinámica en caliente
  const themeCompartment = new Compartment();
  const minimapCompartment = new Compartment();
  const lineNumbersCompartment = new Compartment();
  const wordWrapCompartment = new Compartment();

  // Tema y resaltado de sintaxis según la paleta de código seleccionada
  function themeExtensions(): Extension {
    return buildEditorExtensions(getPalette(codeTheme, isDark), isDark);
  }

  function createMinimapExtension() {
    return showMinimap.compute(['doc'], () => ({
      create: () => ({ dom: document.createElement('div') }),
      displayText: 'blocks',
      showOverlay: 'always',
    }));
  }

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

    // Enlazar evento de scroll para sincronización proporcional
    if (view.scrollDOM) {
      view.scrollDOM.addEventListener('scroll', (e) => {
        if (onEditorScroll) onEditorScroll(e);
      });
    }
  }

  // Sincronización de valor externo sin cambiar de documento (ej: checkbox interactivo o importación directa)
  $effect(() => {
    const docValue = value;
    if (!view) return;
    const currentDocString = view.state.doc.toString();
    if (docValue !== currentDocString) {
      const prevScrollTop = view.scrollDOM ? view.scrollDOM.scrollTop : 0;
      const prevSelection = view.state.selection;

      // Calcular rango mínimo modificado para no destruir el buffer ni el scroll
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
        changes: { from: start, to: oldEnd, insert: docValue.slice(start, newEnd) },
        selection: prevSelection.main.to <= docValue.length ? prevSelection : undefined,
        scrollIntoView: false,
      });

      if (view.scrollDOM && view.scrollDOM.scrollTop !== prevScrollTop) {
        view.scrollDOM.scrollTop = prevScrollTop;
      }
    }
  });

  // Sincronización reactiva del tema (claro/oscuro y paleta de código)
  $effect(() => {
    const themeExt = themeExtensions();
    if (!view) return;
    view.dispatch({
      effects: themeCompartment.reconfigure(themeExt),
    });
  });

  // Sincronización reactiva de minimapa
  $effect(() => {
    const minimapActive = showMinimapEnabled;
    if (!view) return;
    const minimapExt = minimapActive ? createMinimapExtension() : [];
    view.dispatch({
      effects: minimapCompartment.reconfigure(minimapExt),
    });
  });

  // Sincronización reactiva de números de línea
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

  // Sincronización reactiva de word wrap
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
   * Inserta o envuelve texto en la posición de selección actual.
   */
  export function insertSnippet(prefix: string, suffix = '', placeholder = ''): void {
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
    background-color: var(--editor-bg, #1e1e1e);
  }

  /* Ocultar números de línea inmediatamente mediante CSS cuando se desactiva */
  .editor-wrapper.hide-line-numbers :global(.cm-gutters) {
    display: none !important;
  }

  /* Ocultar minimapa inmediatamente mediante CSS cuando se desactiva */
  .editor-wrapper.hide-minimap :global(.cm-minimap-gutter),
  .editor-wrapper.hide-minimap :global(.cm-minimap-overlay-container) {
    display: none !important;
  }

  :global(.cm-editor) {
    height: 100%;
    width: 100%;
    outline: none !important;
    background-color: var(--editor-bg, #1e1e1e) !important;
    color: var(--editor-text, #d4d4d4) !important;
  }

  :global(.cm-scroller) {
    overflow: auto;
    font-family: inherit;
    background-color: var(--editor-bg, #1e1e1e) !important;
  }

  :global(.cm-gutters) {
    background-color: var(--editor-gutter-bg, #1e1e1e) !important;
    border-right: 1px solid var(--editor-gutter-border, #2b2d31) !important;
  }

  :global(.cm-minimap-gutter) {
    background-color: var(--editor-bg, #1e1e1e) !important;
    border-left: 1px solid var(--border-subtle, #232427) !important;
  }

  @media (max-width: 768px) {
    /* En dispositivos móviles, ocultar automáticamente el minimapa para maximizar el ancho útil */
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
