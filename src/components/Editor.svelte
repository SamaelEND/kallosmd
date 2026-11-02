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
  import { EditorState, Compartment } from '@codemirror/state';
  import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
  import { markdown } from '@codemirror/lang-markdown';
  import { languages } from '@codemirror/language-data';
  import {
    foldGutter,
    syntaxHighlighting,
    HighlightStyle,
    bracketMatching,
  } from '@codemirror/language';
  import { tags } from '@lezer/highlight';
  import { showMinimap } from '@replit/codemirror-minimap';

  interface Props {
    documentId?: string;
    value: string;
    isDark?: boolean;
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

  // Temas exactos inspirados en VS Code y la paleta de md-studio original
  const lightEditorTheme = EditorView.theme({
    '&': {
      color: '#24292e',
      backgroundColor: '#ffffff',
      height: '100%',
      fontFamily: '"JetBrains Mono", ui-monospace, Menlo, Monaco, Consolas, monospace',
      fontSize: '15px',
    },
    '.cm-content': {
      caretColor: '#0066b8',
      padding: '20px 24px',
      lineHeight: '1.65',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#0066b8',
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'rgba(173, 214, 255, 0.65) !important',
    },
    '.cm-panels': {
      backgroundColor: '#f8f9fa',
      color: '#24292e',
    },
    '.cm-gutters': {
      backgroundColor: '#f8f9fa',
      color: '#959da5',
      borderRight: '1px solid #e1e4e8',
      paddingLeft: '8px',
      paddingRight: '8px',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(235, 238, 242, 0.4)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#eef1f5',
      color: '#1f7a6d',
      fontWeight: '600',
    },
    '.cm-foldGutter span': {
      color: '#959da5',
    },
  });

  const darkEditorTheme = EditorView.theme({
    '&': {
      color: '#d4d4d4',
      backgroundColor: '#1e1e1e',
      height: '100%',
      fontFamily: '"JetBrains Mono", ui-monospace, Menlo, Monaco, Consolas, monospace',
      fontSize: '15px',
    },
    '.cm-content': {
      caretColor: '#4fc1ff',
      padding: '20px 24px',
      lineHeight: '1.65',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#4fc1ff',
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'rgba(38, 79, 120, 0.65) !important',
    },
    '.cm-gutters': {
      backgroundColor: '#1e1e1e',
      color: '#6e7681',
      borderRight: '1px solid #2b2d31',
      paddingLeft: '8px',
      paddingRight: '8px',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(46, 48, 52, 0.35)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#26282b',
      color: '#5fb3a3',
      fontWeight: '600',
    },
    '.cm-foldGutter span': {
      color: '#6e7681',
    },
  }, { dark: true });

  // HighlightStyle inspirado fielmente en VS Code Dark+ con excelente ergonomía visual
  const vsCodeDarkHighlightStyle = HighlightStyle.define([
    { tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword], color: '#569cd6' },
    { tag: [tags.typeName, tags.className, tags.namespace], color: '#4ec9b0' },
    { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#dcdcaa' },
    { tag: [tags.definition(tags.variableName), tags.variableName, tags.propertyName], color: '#9cdcfe' },
    { tag: [tags.string, tags.special(tags.string)], color: '#ce9178' },
    { tag: [tags.number, tags.integer, tags.float], color: '#b5cea8' },
    { tag: [tags.bool, tags.null], color: '#569cd6' },
    { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: '#6a9955', fontStyle: 'italic' },
    { tag: [tags.meta, tags.annotation, tags.modifier], color: '#4ec9b0' },
    { tag: [tags.operator, tags.punctuation], color: '#d4d4d4' },
    { tag: tags.heading, color: '#569cd6', fontWeight: '600' },
    { tag: tags.heading1, color: '#569cd6', fontWeight: 'bold' },
    { tag: tags.heading2, color: '#569cd6', fontWeight: '600' },
    { tag: tags.heading3, color: '#569cd6', fontWeight: '600' },
    { tag: tags.strong, color: '#569cd6', fontWeight: 'bold' },
    { tag: tags.emphasis, color: '#d4d4d4', fontStyle: 'italic' },
    { tag: tags.link, color: '#9cdcfe', textDecoration: 'underline' },
    { tag: tags.url, color: '#9cdcfe' },
  ]);

  // HighlightStyle inspirado en VS Code Light+
  const vsCodeLightHighlightStyle = HighlightStyle.define([
    { tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword], color: '#0000ff' },
    { tag: [tags.typeName, tags.className, tags.namespace], color: '#267f99' },
    { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#795e26' },
    { tag: [tags.definition(tags.variableName), tags.variableName, tags.propertyName], color: '#001080' },
    { tag: [tags.string, tags.special(tags.string)], color: '#a31515' },
    { tag: [tags.number, tags.integer, tags.float], color: '#098658' },
    { tag: [tags.bool, tags.null], color: '#0000ff' },
    { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: '#008000', fontStyle: 'italic' },
    { tag: [tags.meta, tags.annotation, tags.modifier], color: '#267f99' },
    { tag: [tags.operator, tags.punctuation], color: '#24292e' },
    { tag: tags.heading, color: '#800000', fontWeight: '600' },
    { tag: tags.heading1, color: '#800000', fontWeight: 'bold' },
    { tag: tags.heading2, color: '#800000', fontWeight: '600' },
    { tag: tags.heading3, color: '#800000', fontWeight: '600' },
    { tag: tags.strong, color: '#800000', fontWeight: 'bold' },
    { tag: tags.emphasis, color: '#24292e', fontStyle: 'italic' },
    { tag: tags.link, color: '#001080', textDecoration: 'underline' },
    { tag: tags.url, color: '#001080' },
  ]);

  function createMinimapExtension() {
    return showMinimap.compute(['doc'], () => ({
      create: () => ({ dom: document.createElement('div') }),
      displayText: 'blocks',
      showOverlay: 'always',
    }));
  }

  function initEditor(): void {
    if (!editorContainer) return;

    const currentThemeExt = isDark
      ? [darkEditorTheme, syntaxHighlighting(vsCodeDarkHighlightStyle)]
      : [lightEditorTheme, syntaxHighlighting(vsCodeLightHighlightStyle)];
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

  // Sincronización reactiva del tema oscuro/claro
  $effect(() => {
    const activeIsDark = isDark;
    if (!view) return;
    const themeExt = activeIsDark
      ? [darkEditorTheme, syntaxHighlighting(vsCodeDarkHighlightStyle)]
      : [lightEditorTheme, syntaxHighlighting(vsCodeLightHighlightStyle)];
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
