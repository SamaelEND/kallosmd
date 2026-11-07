<script lang="ts">
  /**
   * Componente de vista previa que coordina el renderizado de Markdown, KaTeX, diagramas Mermaid e interacciones del DOM.
   */
  import { onMount, onDestroy, tick } from "svelte";
  import { documentStore } from "../vault/vaultStore.svelte";
  import type { CodeThemeId, FontSize } from "../../core/types";
  import { getPalette, paletteToCssText } from "../../shared/utils/codeThemes";
  import { cleanPreviewHtml } from "./export/htmlExport";
  import { processMathAndMarkdown } from "../../core/markdown/markdownPipeline";
  import { renderMermaidContainers } from "./mermaidRenderer";
  import {
    handlePreviewLinkClick,
    setupCopyButtons,
    setupTaskCheckboxes,
  } from "./previewInteractions";
  import {
    getContainerVisibleSourceLine,
    scrollContainerToSourceLine,
  } from "./scrollSync";
  import "./styles/preview-content.css";

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
   * Registra los índices de los elementos <details> actualmente expandidos en la vista previa.
   */
  function captureOpenDetails(): void {
    openDetailsIndices.clear();
    if (!scrollContainer) return;
    scrollContainer
      .querySelectorAll<HTMLDetailsElement>("details")
      .forEach((el, index) => {
        if (el.open) openDetailsIndices.add(index);
      });
  }

  /**
   * Restaura el estado expandido de los elementos <details> tras actualizar el HTML.
   */
  function restoreOpenDetails(): void {
    if (!scrollContainer || openDetailsIndices.size === 0) return;
    scrollContainer
      .querySelectorAll<HTMLDetailsElement>("details")
      .forEach((el, index) => {
        if (openDetailsIndices.has(index)) el.open = true;
      });
  }

  onDestroy(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  });

  // Compila el contenido Markdown a HTML de forma inmediata en carga inicial/cambio de documento y con debounce al editar.
  $effect(() => {
    const rawContent = content;
    const currentDocId = documentId;

    if (isLocalTaskToggle) {
      isLocalTaskToggle = false;
      return;
    }

    if (isFirstRender || (currentDocId && currentDocId !== lastDocumentId)) {
      isFirstRender = false;
      lastDocumentId = currentDocId;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      openDetailsIndices.clear();
      diagramZoomLevels.clear();
      previousScrollTop = 0;
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
      }
      renderedHtml = processMathAndMarkdown(rawContent);
      return;
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      captureOpenDetails();
      renderedHtml = processMathAndMarkdown(rawContent);
    }, 60);
  });

  // Vincula controles interactivos y renderiza diagramas Mermaid cuando cambia el HTML compilado o el tema.
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

  export function scrollToSourceLine(targetLine: number, fraction = 0): void {
    scrollContainerToSourceLine(scrollContainer, targetLine, fraction);
  }

  export function getVisibleSourceLine(): {
    line: number;
    fraction: number;
  } | null {
    return getContainerVisibleSourceLine(scrollContainer);
  }

  /**
   * Expande bloques desplegables y adapta diagramas al tema claro antes de imprimir o exportar.
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
      scrollContainer
        .querySelectorAll<HTMLDetailsElement>("details")
        .forEach((detailsEl) => {
          if (!detailsEl.open) {
            detailsEl.dataset.printOpened = "true";
            detailsEl.open = true;
          }
        });
    }

    await renderMermaidContainers(
      scrollContainer,
      false,
      mermaidCache,
      diagramZoomLevels,
    );
  }

  /**
   * Obtiene el HTML limpio del artículo renderizado para exportación a archivo HTML5.
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
   * Restaura el estado de los bloques desplegables y el tema de los diagramas tras la impresión.
   */
  export async function restoreAfterPrint(): Promise<void> {
    if (!isPrintingActive) return;
    isPrintingActive = false;

    if (scrollContainer) {
      scrollContainer
        .querySelectorAll<HTMLDetailsElement>(
          'details[data-print-opened="true"]',
        )
        .forEach((detailsEl) => {
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
