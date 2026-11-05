<script lang="ts">
  /**
   * Componente orquestador Preview de Markdown Studio.
   * Coordina el renderizado reactivo de Markdown + KaTeX, diagramas Mermaid con caché
   * e interacciones del DOM (botones de copiar, tareas y anclas).
   */
  import { onMount, tick } from "svelte";
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
  let previousScrollTop = $state<number>(0);
  let isLocalTaskToggle = $state<boolean>(false);
  let lastDocumentId = $state<string>("");

  const mermaidCache = new Map<string, string>();
  const diagramZoomLevels = new Map<number, number>();

  // Resetear scroll al cambiar de documento
  $effect(() => {
    if (documentId && documentId !== lastDocumentId) {
      lastDocumentId = documentId;
      previousScrollTop = 0;
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
      }
    }
  });

  // Actualizar HTML reactivamente
  $effect(() => {
    const rawContent = content;

    if (isLocalTaskToggle) {
      isLocalTaskToggle = false;
      return;
    }

    renderedHtml = processMathAndMarkdown(rawContent);
  });

  // Post-procesado tras actualizar HTML: botones de copia, checkboxes y Mermaid
  $effect(() => {
    const _ = renderedHtml;
    const dark = isDark;
    const targetScroll = previousScrollTop;

    tick().then(() => {
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
      ).finally(() => {
        if (scrollContainer && targetScroll > 0) {
          scrollContainer.scrollTop = targetScroll;
        }
      });
      if (scrollContainer && targetScroll > 0) {
        scrollContainer.scrollTop = targetScroll;
      }
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

  export async function prepareForPrint(): Promise<void> {
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

    if (isDark) {
      await renderMermaidContainers(
        scrollContainer,
        false,
        mermaidCache,
        diagramZoomLevels,
      );
    }
  }

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

  export async function restoreAfterPrint(): Promise<void> {
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
