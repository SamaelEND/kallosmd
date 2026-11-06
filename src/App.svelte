<script lang="ts">
  /**
   * ES: Componente principal que coordina los paneles del área de trabajo, sincronización de desplazamiento, exportación y atajos globales.
   * EN: Main component coordinating workspace panels, scroll synchronization, export, and global shortcuts.
   */
  import { onDestroy, onMount, tick } from "svelte";
  import Editor from "./components/editor/Editor.svelte";
  import Preview from "./components/preview/Preview.svelte";
  import Sidebar from "./components/sidebar/Sidebar.svelte";
  import Toolbar from "./components/toolbar/Toolbar.svelte";
  import DropOverlay from "./components/workspace/DropOverlay.svelte";
  import Resizer from "./components/workspace/Resizer.svelte";
  import StatusBar from "./components/workspace/StatusBar.svelte";
  import { buildHtmlDocument, downloadTextFile } from "./lib/htmlExport";
  import {
    computeDocumentStats,
    isValidImportFile,
    readTextFile,
    type DocumentStats,
  } from "./lib/utils/formatters";
  import { documentStore } from "./stores/documents.svelte";

  let sidebarOpen = $state(
    typeof window !== "undefined" ? window.innerWidth > 768 : true,
  );
  let editorComponent = $state<ReturnType<typeof Editor> | null>(null);
  let previewComponent = $state<ReturnType<typeof Preview> | null>(null);

  let isDraggingFile = $state(false);
  let saveNoticeVisible = $state(false);

  const activeDoc = $derived(documentStore.activeDocument);
  const activeContent = $derived(activeDoc?.content || "");
  const isDark = $derived(documentStore.isDark);
  const settings = $derived(documentStore.settings);
  const splitRatio = $derived(settings.splitRatio);
  const viewMode = $derived(settings.viewMode);

  // ES: Estadísticas del documento actualizadas de forma inmediata al cambiar de archivo y con debounce al escribir.
  // EN: Document statistics updated immediately on file switch and debounced while typing.
  let stats = $state<DocumentStats>({ lines: 0, words: 0, readingTime: 0 });
  let lastStatsDocId = "";
  let statsDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    const currentId = documentStore.activeId;
    const text = activeContent;

    if (currentId !== lastStatsDocId) {
      lastStatsDocId = currentId;
      if (statsDebounceTimer) {
        clearTimeout(statsDebounceTimer);
        statsDebounceTimer = null;
      }
      stats = computeDocumentStats(text);
      return;
    }

    if (statsDebounceTimer) {
      clearTimeout(statsDebounceTimer);
    }
    statsDebounceTimer = setTimeout(() => {
      stats = computeDocumentStats(text);
    }, 150);
  });

  // ES: Sincroniza el atributo data-theme y la clase de tema en el elemento raíz <html>.
  // EN: Synchronizes the data-theme attribute and theme class on the root <html> element.
  $effect(() => {
    if (typeof document !== "undefined") {
      documentStore.applyTheme(isDark ? "dark" : "light");
    }
  });

  // ES: Actualiza la regla de estilo de impresión para mostrar u ocultar la URL en el pie de página del PDF.
  // EN: Updates the print style rule to show or hide the URL in the PDF footer.
  $effect(() => {
    if (typeof document === "undefined") return;
    let styleEl = document.getElementById(
      "md-studio-print-page-style",
    ) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "md-studio-print-page-style";
      document.head.appendChild(styleEl);
    }

    const currentUrl =
      typeof window !== "undefined"
        ? window.location.href
        : "https://markdown-studio.xyz/";
    const urlContent = settings.includePdfUrl
      ? JSON.stringify(currentUrl)
      : '""';

    styleEl.textContent = `
      @media print {
        @page {
          @bottom-left {
            content: ${urlContent};
            font-size: 8.5pt;
            font-family: inherit;
            color: rgba(110, 119, 129, 0.65);
          }
        }
      }
    `;
  });

  // ES: Sincronización inteligente por líneas/bloques entre editor y vista previa.
  // EN: Smart line/block-based scroll synchronization between editor and preview.
  let activeScrollSource: "editor" | "preview" | null = null;
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

  function syncScroll(source: "editor" | "preview"): void {
    if (!settings.syncScroll || viewMode !== "split") return;
    if (activeScrollSource && activeScrollSource !== source) return;

    const editorEl = editorComponent?.getScrollerElement();
    const previewEl = previewComponent?.getScrollElement();
    if (!editorEl || !previewEl) return;

    activeScrollSource = source;

    if (source === "editor") {
      const lineInfo = editorComponent?.getVisibleLineRange?.();
      if (lineInfo && previewComponent?.scrollToSourceLine) {
        previewComponent.scrollToSourceLine(lineInfo.line, lineInfo.fraction);
      } else {
        const maxEditor = editorEl.scrollHeight - editorEl.clientHeight;
        const maxPreview = previewEl.scrollHeight - previewEl.clientHeight;
        if (maxEditor > 0 && maxPreview > 0) {
          previewEl.scrollTop = (editorEl.scrollTop / maxEditor) * maxPreview;
        }
      }
    } else {
      const lineInfo = previewComponent?.getVisibleSourceLine?.();
      if (lineInfo && editorComponent?.scrollToSourceLine) {
        editorComponent.scrollToSourceLine(lineInfo.line, lineInfo.fraction);
      } else {
        const maxEditor = editorEl.scrollHeight - editorEl.clientHeight;
        const maxPreview = previewEl.scrollHeight - previewEl.clientHeight;
        if (maxEditor > 0 && maxPreview > 0) {
          editorEl.scrollTop = (previewEl.scrollTop / maxPreview) * maxEditor;
        }
      }
    }

    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      activeScrollSource = null;
    }, 80);
  }

  function handleInsertSnippet(
    prefix: string,
    suffix = "",
    placeholder = "",
  ): void {
    editorComponent?.insertSnippet?.(prefix, suffix, placeholder);
  }

  /**
   * ES: Prepara el documento y ejecuta el diálogo de impresión del navegador para exportar a PDF.
   * EN: Prepares the document and triggers the browser print dialog to export to PDF.
   */
  async function handleExportPdf(): Promise<void> {
    const originalTitle = typeof document !== "undefined" ? document.title : "";
    const docTitle = activeDoc?.title
      ? activeDoc.title.replace(/\.md$/i, "")
      : "documento";
    if (typeof document !== "undefined") {
      document.title = docTitle;
    }

    const previousMode = viewMode;
    if (previousMode === "editor") {
      documentStore.setViewMode("preview");
      await tick();
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    if (previewComponent?.prepareForPrint) {
      await previewComponent.prepareForPrint();
      await tick();
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    window.print();

    if (previewComponent?.restoreAfterPrint) {
      await previewComponent.restoreAfterPrint();
    }

    if (previousMode === "editor") {
      documentStore.setViewMode("editor");
    }
    if (typeof document !== "undefined") {
      document.title = originalTitle;
    }
  }

  /**
   * ES: Exporta la vista previa activa como un documento HTML5 autónomo.
   * EN: Exports the active preview as a self-contained HTML5 document.
   */
  async function handleExportHtml(): Promise<void> {
    if (!previewComponent) return;
    const title = activeDoc?.title
      ? activeDoc.title.replace(/\.md$/i, "")
      : "documento";

    const previousMode = viewMode;
    if (previousMode === "editor") {
      documentStore.setViewMode("preview");
      await tick();
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    const body = await previewComponent.getExportHtml();
    downloadTextFile(
      `${title}.html`,
      await buildHtmlDocument(title, body, settings.codeTheme),
      "text/html",
    );

    if (previousMode === "editor") {
      documentStore.setViewMode("editor");
    }
  }

  // ES: Gestión global de arrastrar y soltar para importar archivos de texto Markdown.
  // EN: Global drag-and-drop handling for importing Markdown text files.
  function handleDragOver(e: DragEvent): void {
    e.preventDefault();
    isDraggingFile = true;
  }

  function handleDragLeave(e: DragEvent): void {
    if (
      e.clientX <= 0 ||
      e.clientY <= 0 ||
      e.clientX >= window.innerWidth ||
      e.clientY >= window.innerHeight
    ) {
      isDraggingFile = false;
    }
  }

  async function handleDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    isDraggingFile = false;

    const file = e.dataTransfer?.files?.[0];
    if (!file || !isValidImportFile(file)) return;

    try {
      const content = await readTextFile(file);
      documentStore.importDocument(file.name, content);
    } catch (error) {
      console.error("Error al importar archivo arrastrado:", error);
    }
  }

  function handleGlobalKeyDown(event: KeyboardEvent): void {
    const isMeta = event.ctrlKey || event.metaKey;

    if (isMeta && event.key.toLowerCase() === "b") {
      event.preventDefault();
      sidebarOpen = !sidebarOpen;
    }

    if (isMeta && event.key.toLowerCase() === "s") {
      event.preventDefault();
      documentStore.flushPendingSave();
      saveNoticeVisible = true;
      setTimeout(() => {
        saveNoticeVisible = false;
      }, 1800);
    }

    if (isMeta && event.key.toLowerCase() === "p") {
      event.preventDefault();
      handleExportPdf();
    }
  }

  onMount(() => {
    if (window.innerWidth <= 1024) {
      sidebarOpen = false;
    }
  });

  onDestroy(() => {
    if (statsDebounceTimer) {
      clearTimeout(statsDebounceTimer);
    }
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }
  });
</script>

<svelte:window
  onkeydown={handleGlobalKeyDown}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
/>

<div class="studio-root" class:dark={isDark}>
  <DropOverlay visible={isDraggingFile} />

  {#if sidebarOpen}
    <div
      class="sidebar-backdrop"
      onclick={() => (sidebarOpen = false)}
      role="presentation"
      aria-hidden="true"
    ></div>
  {/if}

  <Sidebar isOpen={sidebarOpen} onClose={() => (sidebarOpen = false)} />

  <main class="studio-main">
    <Toolbar
      {sidebarOpen}
      onToggleSidebar={() => (sidebarOpen = !sidebarOpen)}
      onInsertSnippet={handleInsertSnippet}
      onExportPdf={handleExportPdf}
      onExportHtml={handleExportHtml}
    />

    <div class="workspace-container mode-{viewMode}" id="workspace">
      <section
        class="pane editor-pane no-print"
        style="width: {viewMode === 'split' ? splitRatio + '%' : '100%'};"
        class:hidden-pane={viewMode === "preview"}
        aria-label="Editor Markdown"
      >
        {#key documentStore.activeId}
          <Editor
            bind:this={editorComponent}
            documentId={documentStore.activeId}
            value={activeContent}
            {isDark}
            codeTheme={settings.codeTheme}
            showMinimapEnabled={settings.minimap}
            showLineNumbersEnabled={settings.lineNumbers}
            wordWrapEnabled={settings.wordWrap}
            onChange={(val) => documentStore.updateActiveContent(val)}
            onEditorScroll={() => syncScroll("editor")}
          />
        {/key}
      </section>

      {#if viewMode === "split"}
        <Resizer
          {splitRatio}
          min={18}
          max={82}
          onResize={(ratio) =>
            documentStore.updateSettings({ splitRatio: ratio })}
          onReset={() => documentStore.resetSplitRatio()}
        />
      {/if}

      <section
        class="pane preview-pane"
        style="width: {viewMode === 'split' ? 100 - splitRatio + '%' : '100%'};"
        class:hidden-pane={viewMode === "editor"}
        aria-label="Vista previa de lectura"
      >
        {#key documentStore.activeId}
          <Preview
            bind:this={previewComponent}
            documentId={documentStore.activeId}
            content={activeContent}
            {isDark}
            codeTheme={settings.codeTheme}
            fontSize={settings.fontSize}
            onContainerScroll={() => syncScroll("preview")}
          />
        {/key}
      </section>
    </div>

    <StatusBar {stats} {saveNoticeVisible} />
  </main>
</div>

<style>
  .studio-root {
    position: fixed;
    inset: 0;
    display: flex;
    width: 100%;
    height: 100%;
    height: 100dvh;
    overflow: hidden;
    background-color: var(--bg-app, #151617);
    color: var(--text-primary, #e8e6e1);
    padding-top: env(safe-area-inset-top, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  .studio-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100%;
    overflow: hidden;
  }

  .workspace-container {
    flex: 1;
    display: flex;
    width: 100%;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  .pane {
    height: 100%;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .editor-pane {
    background-color: var(--editor-bg, #1e1e1e);
  }

  .preview-pane {
    background-color: var(--bg-reader, #1e1f22);
    overscroll-behavior-y: contain;
  }

  .hidden-pane {
    display: none !important;
  }

  @media (max-width: 640px) {
    .workspace-container.mode-split .editor-pane {
      width: 100% !important;
    }

    .workspace-container.mode-split .preview-pane {
      display: none !important;
    }

    :global(.resizer-divider) {
      display: none !important;
    }
  }

  .sidebar-backdrop {
    display: none;
  }

  @media (max-width: 1024px) {
    .sidebar-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      z-index: 95;
      animation: fadeInScrim 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes fadeInScrim {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  }
</style>
