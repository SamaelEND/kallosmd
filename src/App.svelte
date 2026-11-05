<script lang="ts">
  /**
   * Componente principal de MD Studio.
   * Orquesta:
   * - Modos de vista: Editor, Dividido (50/50 con Resizer) y Lectura.
   * - Sincronización proporcional de scroll entre CodeMirror 6 y Preview.
   * - Drag & Drop de archivos Markdown en pantalla completa.
   * - Exportación inteligente a PDF con adaptación de diagramas y estilos limpios.
   * - Persistencia y sincronización completa con el sistema de diseño original.
   */
  import { onMount, tick } from "svelte";
  import { documentStore } from "./stores/documents.svelte";
  import Sidebar from "./components/Sidebar.svelte";
  import Toolbar from "./components/Toolbar.svelte";
  import Editor from "./components/Editor.svelte";
  import Resizer from "./components/Resizer.svelte";
  import Preview from "./components/Preview.svelte";
  import { buildHtmlDocument, downloadTextFile } from "./lib/htmlExport";
  import DropOverlay from "./components/DropOverlay.svelte";
  import { CheckCircle2, Sparkles } from "lucide-svelte";

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

  // Estadísticas del documento para la barra inferior
  const stats = $derived.by(() => {
    const text = activeContent;
    const lines = text ? text.split("\n").length : 0;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const readingTime = words ? Math.max(1, Math.round(words / 200)) : 0;
    return { lines, words, readingTime };
  });

  // Sincronización del atributo data-theme y clase dark en <html>
  $effect(() => {
    if (typeof document !== "undefined") {
      documentStore.applyTheme(isDark ? "dark" : "light");
    }
  });

  // Sincronización dinámica de opciones de página en PDF (URL en pie de página)
  $effect(() => {
    if (typeof document === "undefined") return;
    let styleEl = document.getElementById("md-studio-print-page-style") as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "md-studio-print-page-style";
      document.head.appendChild(styleEl);
    }

    const currentUrl = typeof window !== "undefined" ? window.location.href : "https://markdown-studio.xyz/";
    const urlContent = settings.includePdfUrl ? JSON.stringify(currentUrl) : '""';

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

    if (source === "editor") {
      const maxEditor = editorEl.scrollHeight - editorEl.clientHeight;
      const maxPreview = previewEl.scrollHeight - previewEl.clientHeight;
      if (maxEditor > 0 && maxPreview > 0) {
        const ratio = editorEl.scrollTop / maxEditor;
        previewEl.scrollTop = ratio * maxPreview;
      }
    } else {
      const maxEditor = editorEl.scrollHeight - editorEl.clientHeight;
      const maxPreview = previewEl.scrollHeight - previewEl.clientHeight;
      if (maxEditor > 0 && maxPreview > 0) {
        const ratio = previewEl.scrollTop / maxPreview;
        editorEl.scrollTop = ratio * maxEditor;
      }
    }

    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      activeScrollSource = null;
    }, 60);
  }

  function handleEditorScroll(): void {
    syncScroll("editor");
  }

  function handlePreviewScroll(): void {
    syncScroll("preview");
  }

  function handleContentChange(newContent: string): void {
    documentStore.updateActiveContent(newContent);
  }

  function handleInsertSnippet(
    prefix: string,
    suffix = "",
    placeholder = "",
  ): void {
    if (editorComponent?.insertSnippet) {
      editorComponent.insertSnippet(prefix, suffix, placeholder);
    }
  }

  function handleResize(newRatio: number): void {
    documentStore.updateSettings({ splitRatio: newRatio });
  }

  function handleResetSplit(): void {
    documentStore.resetSplitRatio();
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
      // Retardo breve para asegurar que el navegador procese el renderizado y diagramas
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    // Si la aplicación está en modo oscuro, convertir diagramas al tema claro estándar para el PDF
    if (previewComponent?.prepareForPrint) {
      await previewComponent.prepareForPrint();
      await tick();
      // Pausa breve para garantizar que el DOM y los SVG se asienten antes del diálogo de impresión
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    window.print();

    // Restaurar los diagramas al tema activo de la interfaz tras cerrar el diálogo de impresión
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
    // Solo ocultar si se sale de la ventana del navegador
    if (
      e.clientX <= 0 ||
      e.clientY <= 0 ||
      e.clientX >= window.innerWidth ||
      e.clientY >= window.innerHeight
    ) {
      isDraggingFile = false;
    }
  }

  function handleDrop(e: DragEvent): void {
    e.preventDefault();
    isDraggingFile = false;

    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || "");
      documentStore.importDocument(file.name, content);
    };
    reader.readAsText(file);
  }

  // Atajos de teclado
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
  <!-- Overlay para soltar archivos .md -->
  <DropOverlay visible={isDraggingFile} />

  <!-- Backdrop scrim para tablets y móviles cuando el sidebar está abierto -->
  {#if sidebarOpen}
    <div
      class="sidebar-backdrop"
      onclick={() => (sidebarOpen = false)}
      role="presentation"
      aria-hidden="true"
    ></div>
  {/if}

  <!-- Barra lateral: Documentos e Índice -->
  <Sidebar isOpen={sidebarOpen} onClose={() => (sidebarOpen = false)} />

  <!-- Área principal de trabajo -->
  <main class="studio-main">
    <!-- Barra superior de herramientas -->
    <Toolbar
      {sidebarOpen}
      onToggleSidebar={() => (sidebarOpen = !sidebarOpen)}
      onInsertSnippet={handleInsertSnippet}
      onExportPdf={handleExportPdf}
      onExportHtml={handleExportHtml}
    />

    <!-- Contenedor de paneles según ViewMode (editor, split, preview) -->
    <div class="workspace-container mode-{viewMode}" id="workspace">
      <!-- Panel Editor -->
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
            onChange={handleContentChange}
            onEditorScroll={handleEditorScroll}
          />
        {/key}
      </section>

      <!-- Divisor interactivo con doble clic 50/50 (Solo en modo split) -->
      {#if viewMode === "split"}
        <Resizer
          {splitRatio}
          min={18}
          max={82}
          onResize={handleResize}
          onReset={handleResetSplit}
        />
      {/if}

      <!-- Panel de Lectura / Vista Previa -->
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
          onContainerScroll={handlePreviewScroll}
        />
      </section>
    </div>

    <!-- Barra de estado inferior -->
    <footer class="studio-statusbar no-print">
      <div class="status-left">
        <span class="editor-stats">
          {stats.lines} líneas · {stats.words} palabras · {stats.readingTime} min
          de lectura
        </span>
        {#if saveNoticeVisible}
          <span class="save-toast">
            <CheckCircle2 size={12} />
            <span>Guardado</span>
          </span>
        {/if}
      </div>

      <div class="status-right">
        <span class="status-tag">
          <Sparkles size={12} />
          <span>KaTeX + Mermaid</span>
        </span>
      </div>
    </footer>
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

  /* Barra de estado */
  .studio-statusbar {
    height: 26px;
    min-height: 26px;
    background-color: var(--bg-app, #151617);
    border-top: 1px solid var(--border-color, #2b2d31);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1rem;
    font-size: 0.725rem;
    color: var(--text-secondary, #9b9a94);
    user-select: none;
    z-index: 10;
  }

  .status-left,
  .status-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .save-toast {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--accent-color, #5fb3a3);
    font-weight: 600;
  }

  .status-tag {
    display: flex;
    align-items: center;
    gap: 4px;
    background-color: var(--bg-elevated, #26282b);
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 0.675rem;
  }

  /* En dispositivos móviles (<= 640px), el modo split colapsa a ancho completo para evitar compresión excesiva */
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

    .status-right {
      display: none;
    }

    .studio-statusbar {
      padding: 0 0.65rem;
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
  }

  /* Backdrop Scrim para Drawer del Sidebar en Tablets y Móviles */
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
