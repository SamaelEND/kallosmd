<script lang="ts">
  /**
   * ES: Componente de vista previa que coordina el renderizado de Markdown, KaTeX, diagramas Mermaid e interacciones del DOM.
   * EN: Preview component coordinating Markdown rendering, KaTeX, Mermaid diagrams, and DOM interactions.
   */
  import { onMount, onDestroy, tick } from "svelte";
  import { documentStore } from "../../stores/documents.svelte";
  import type { CodeThemeId, FontSize } from "../../types";
  import { getPalette, paletteToCssText } from "../../lib/codeThemes";
  import { cleanPreviewHtml } from "../../lib/htmlExport";
  import { processMathAndMarkdown } from "../../lib/markdown/markdownRenderer";
  import { renderMermaidContainers } from "../../lib/markdown/mermaidRenderer";
  import {
    handlePreviewLinkClick,
    setupCopyButtons,
    setupTaskCheckboxes,
  } from "../../lib/markdown/previewInteractions";
  import "./preview-content.css";

  interface Props {
    documentId?: string;
    content: string;
    isDark?: boolean;
    fontSize?: FontSize;
    codeTheme?: CodeThemeId;
    onContainerScroll?: (e: Event) => void;
  }

  let {
    documentId = "",
    content = "",
    isDark = false,
    fontSize = "medium",
    codeTheme = "vscode",
    onContainerScroll,
  }: Props = $props();

  const codeVars = $derived(paletteToCssText(getPalette(codeTheme, isDark)));

  let scrollContainer = $state<HTMLDivElement | null>(null);
  let renderedHtml = $state<string>("");

  // ES: Variables internas de control de estado que no requieren seguimiento reactivo en plantilla.
  // EN: Internal state control variables that do not require reactive template tracking.
  let previousScrollTop = 0;
  let isLocalTaskToggle = false;
  let isFirstRender = true;
  let lastDocumentId = "";
  let isPrintingActive = false;
  let openDetailsIndices: Set<number> = new Set();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const mermaidCache = new Map<string, string>();
  const diagramZoomLevels = new Map<number, number>();

  /**
   * ES: Registra los índices de los elementos <details> actualmente expandidos en la vista previa.
   * EN: Records the indices of currently expanded <details> elements in the preview.
   */
  function captureOpenDetails(): void {
    openDetailsIndices.clear();
    if (!scrollContainer) return;
    const detailsList =
      scrollContainer.querySelectorAll<HTMLDetailsElement>("details");
    detailsList.forEach((el, index) => {
      if (el.open) {
        openDetailsIndices.add(index);
      }
    });
  }

  /**
   * ES: Restaura el estado expandido de los elementos <details> tras actualizar el HTML.
   * EN: Restores the expanded state of <details> elements after updating the HTML.
   */
  function restoreOpenDetails(): void {
    if (!scrollContainer || openDetailsIndices.size === 0) return;
    const detailsList =
      scrollContainer.querySelectorAll<HTMLDetailsElement>("details");
    detailsList.forEach((el, index) => {
      if (openDetailsIndices.has(index)) {
        el.open = true;
      }
    });
  }

  onDestroy(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  });

  // ES: Restablece la posición de desplazamiento, bloques desplegables y zoom al cambiar de documento.
  // EN: Resets scroll position, collapsible blocks, and zoom levels when switching documents.
  $effect(() => {
    const currentDocId = documentId;
    if (currentDocId && currentDocId !== lastDocumentId) {
      lastDocumentId = currentDocId;
      previousScrollTop = 0;
      openDetailsIndices.clear();
      diagramZoomLevels.clear();
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
      }
    }
  });

  // ES: Compila el contenido Markdown a HTML de forma inmediata en la carga inicial y con debounce al editar.
  // EN: Compiles Markdown content to HTML immediately on initial load and with debounce when editing.
  $effect(() => {
    const rawContent = content;

    if (isLocalTaskToggle) {
      isLocalTaskToggle = false;
      return;
    }

    if (isFirstRender) {
      isFirstRender = false;
      renderedHtml = processMathAndMarkdown(rawContent);
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      captureOpenDetails();
      renderedHtml = processMathAndMarkdown(rawContent);
    }, 90);
  });

  // ES: Vincula controles interactivos y renderiza diagramas Mermaid cuando cambia el HTML compilado o el tema.
  // EN: Binds interactive controls and renders Mermaid diagrams when compiled HTML or theme changes.
  $effect(() => {
    const _ = renderedHtml;
    const dark = isDark;

    tick().then(() => {
      restoreOpenDetails();
      setupCopyButtons(scrollContainer);
      setupTaskCheckboxes(scrollContainer, (idx, checked) => {
        isLocalTaskToggle = true;
        if (scrollContainer) {
          previousScrollTop = scrollContainer.scrollTop;
        }
        documentStore.toggleTaskCheckbox(idx, checked);
      });
      renderMermaidContainers(
        scrollContainer,
        dark,
        mermaidCache,
        diagramZoomLevels,
      );
    });
  });

  function handleScroll(e: Event): void {
    if (scrollContainer) {
      previousScrollTop = scrollContainer.scrollTop;
    }
    onContainerScroll?.(e);
  }

  export function getScrollElement(): HTMLDivElement | null {
    return scrollContainer;
  }

  /**
   * ES: Expande bloques desplegables y adapta diagramas al tema claro antes de imprimir o exportar.
   * EN: Expands collapsible blocks and adapts diagrams to the light theme before printing or exporting.
   */
  export async function prepareForPrint(): Promise<void> {
    if (isPrintingActive) return;
    isPrintingActive = true;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    captureOpenDetails();
    renderedHtml = processMathAndMarkdown(content);
    await tick();
    restoreOpenDetails();

    if (scrollContainer) {
      const detailsList =
        scrollContainer.querySelectorAll<HTMLDetailsElement>("details");
      detailsList.forEach((detailsEl) => {
        if (!detailsEl.open) {
          detailsEl.dataset.printOpened = "true";
          detailsEl.open = true;
        }
      });
    }

    // ES: Renderiza SIEMPRE los diagramas Mermaid en tema claro optimizado para impresión/PDF.
    // EN: ALWAYS renders Mermaid diagrams in print-optimized light theme before print/PDF.
    await renderMermaidContainers(
      scrollContainer,
      false,
      mermaidCache,
      diagramZoomLevels,
    );
  }

  /**
   * ES: Obtiene el HTML limpio del artículo renderizado para exportación a archivo HTML5.
   * EN: Retrieves clean HTML from the rendered article for HTML5 file export.
   */
  export async function getExportHtml(): Promise<string> {
    await prepareForPrint();
    await tick();
    const article = scrollContainer?.querySelector<HTMLElement>(
      ".reading-table-content",
    );
    const html = article ? cleanPreviewHtml(article) : "";
    await restoreAfterPrint();
    return html;
  }

  /**
   * ES: Restaura el estado de los bloques desplegables y el tema de los diagramas tras la impresión.
   * EN: Restores the state of collapsible blocks and diagram themes after printing.
   */
  export async function restoreAfterPrint(): Promise<void> {
    if (!isPrintingActive) return;
    isPrintingActive = false;

    if (scrollContainer) {
      const openedDetails =
        scrollContainer.querySelectorAll<HTMLDetailsElement>(
          'details[data-print-opened="true"]',
        );
      openedDetails.forEach((detailsEl) => {
        detailsEl.open = false;
        delete detailsEl.dataset.printOpened;
      });
    }

    if (isDark) {
      await renderMermaidContainers(
        scrollContainer,
        true,
        mermaidCache,
        diagramZoomLevels,
      );
    }
  }

  onMount(() => {
    renderMermaidContainers(
      scrollContainer,
      isDark,
      mermaidCache,
      diagramZoomLevels,
    );

    const handleBeforePrint = () => {
      prepareForPrint();
    };

    const handleAfterPrint = () => {
      restoreAfterPrint();
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="preview-scroll-container font-size-{fontSize}"
  bind:this={scrollContainer}
  onscroll={handleScroll}
  onclick={(e) => handlePreviewLinkClick(e, scrollContainer)}
>
  <article class="reading-table-content" style={codeVars}>
    {@html renderedHtml}
  </article>
</div>

<style>
  .preview-scroll-container {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    background-color: var(--reading-bg, #1e1f22);
    color: var(--reading-text, #e8e6e1);
  }
</style>
