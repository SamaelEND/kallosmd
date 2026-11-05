<script lang="ts">
  /**
   * Componente principal de Markdown Studio.
   * Orquesta los módulos principales (Sidebar, Toolbar, Editor, Preview, Resizer, StatusBar),
   * la sincronización proporcional de scroll, la exportación a PDF/HTML y atajos globales.
   */
  import { onMount, tick } from "svelte";
  import Editor from "./components/editor/Editor.svelte";
  import Preview from "./components/preview/Preview.svelte";
  import Sidebar from "./components/sidebar/Sidebar.svelte";
  import Toolbar from "./components/toolbar/Toolbar.svelte";
  import DropOverlay from "./components/workspace/DropOverlay.svelte";
  import Resizer from "./components/workspace/Resizer.svelte";
  import StatusBar from "./components/workspace/StatusBar.svelte";
  import { buildHtmlDocument, downloadTextFile } from "./lib/htmlExport";
  import { computeDocumentStats, readTextFile } from "./lib/utils/formatters";
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

  // Estadísticas del documento para la barra de estado inferior
  const stats = $derived(computeDocumentStats(activeContent));

  // Sincronización del atributo data-theme y clase dark en <html>
  $effect(() => {
    if (typeof document !== "undefined") {
      documentStore.applyTheme(isDark ? "dark" : "light");
    }
  });

  // Sincronización dinámica de opciones de página en PDF (URL en pie de página)
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

  // --- Sincronización de Scroll Proporcional ---
  let activeScrollSource: "editor" | "preview" | null = null;
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

  function syncScroll(source: "editor" | "preview"): void {
    if (!settings.syncScroll || viewMode !== "split") return;
    if (activeScrollSource && activeScrollSource !== source) return;

    const editorEl = editorComponent?.getScrollerElement();
    const previewEl = previewComponent?.getScrollElement();
    if (!editorEl || !previewEl) return;

    activeScrollSource = source;

    const maxEditor = editorEl.scrollHeight - editorEl.clientHeight;
    const maxPreview = previewEl.scrollHeight - previewEl.clientHeight;
    if (maxEditor > 0 && maxPreview > 0) {
      if (source === "editor") {
        previewEl.scrollTop = (editorEl.scrollTop / maxEditor) * maxPreview;
      } else {
        editorEl.scrollTop = (previewEl.scrollTop / maxPreview) * maxEditor;
      }
    }

    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      activeScrollSource = null;
    }, 60);
  }

  function handleInsertSnippet(
    prefix: string,
    suffix = "",
    placeholder = "",
  ): void {
    editorComponent?.insertSnippet?.(prefix, suffix, placeholder);
  }

  /**
   * Exportación limpia a PDF con preparación de página y temas.
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
      await new Promise((resolve) => setTimeout(resolve, 80));
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
   * Exporta la vista previa como documento HTML5 autónomo.
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

  // --- Manejo Global de Drag & Drop de Archivos .md ---
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
    if (!file) return;

    const content = await readTextFile(file);
    documentStore.importDocument(file.name, content);
  }

  function handleGlobalKeyDown(event: KeyboardEvent): void {
    const isMeta = event.ctrlKey || event.metaKey;

    if (isMeta && event.key.toLowerCase() === "b") {
      event.preventDefault();
      sidebarOpen = !sidebarOpen;
    }

    if (isMeta && event.key.toLowerCase() === "s") {
      event.preventDefault();
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
        <Preview
          bind:this={previewComponent}
          documentId={documentStore.activeId}
          content={activeContent}
          {isDark}
          codeTheme={settings.codeTheme}
          fontSize={settings.fontSize}
          onContainerScroll={() => syncScroll("preview")}
        />
      </section>
    </div>

    <StatusBar {stats} {saveNoticeVisible} />
  </main>
</div>

<style>
  .studio-root {
    display: flex;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    background-color: var(--bg-app, #151617);
    color: var(--text-primary, #e8e6e1);
    padding-top: env(safe-area-inset-top, 0px);
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
