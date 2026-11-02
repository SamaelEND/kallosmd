<script lang="ts">
  /**
   * Componente Toolbar de MD Studio.
   * Barra superior inspirada en el diseño original:
   * - Conmutador de modos de vista (Editor, Dividido, Lectura)
   * - Popover de tamaño de fuente
   * - Sincronización de scroll, números de línea y minimapa
   * - Descarga .md y exportación profesional a PDF
   */
  import {
    Columns2,
    Eye,
    Code,
    Download,
    Printer,
    Sun,
    Moon,
    Type,
    Bold,
    Italic,
    Heading,
    Link,
    Table,
    Sigma,
    Workflow,
    CheckSquare,
    X,
    FileText,
    ListOrdered,
    Map,
    MoreVertical,
  } from "lucide-svelte";
  import { documentStore } from "../stores/documents.svelte";
  import type { FontSize, ViewMode } from "../types";

  interface Props {
    sidebarOpen: boolean;
    onToggleSidebar: () => void;
    onInsertSnippet?: (
      prefix: string,
      suffix?: string,
      placeholder?: string,
    ) => void;
    onExportPdf?: () => void;
  }

  let { sidebarOpen, onToggleSidebar, onInsertSnippet, onExportPdf }: Props =
    $props();

  let fontPopoverOpen = $state(false);
  let moreMenuOpen = $state(false);
  let titleInputValue = $state("");

  const activeDoc = $derived(documentStore.activeDocument);
  const docTitle = $derived(activeDoc?.title || "documento.md");
  const currentViewMode = $derived(documentStore.settings.viewMode);
  const currentFontSize = $derived(documentStore.settings.fontSize);

  // Sincronizar input con el título activo
  $effect(() => {
    titleInputValue = docTitle;
  });

  function handleTitleBlur(): void {
    if (titleInputValue.trim()) {
      documentStore.updateActiveTitle(titleInputValue);
    } else {
      titleInputValue = docTitle;
    }
  }

  function handleTitleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      (event.target as HTMLInputElement).blur();
    } else if (event.key === "Escape") {
      titleInputValue = docTitle;
      (event.target as HTMLInputElement).blur();
    }
  }

  function handleCloseDoc(): void {
    if (activeDoc) {
      documentStore.deleteDocument(activeDoc.id);
    }
  }

  function setView(mode: ViewMode): void {
    documentStore.setViewMode(mode);
  }

  function setSize(size: FontSize): void {
    documentStore.setFontSize(size);
    fontPopoverOpen = false;
  }

  function exportMarkdown(): void {
    if (!activeDoc) return;
    const blob = new Blob([activeDoc.content], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeDoc.title;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function insert(prefix: string, suffix = "", placeholder = ""): void {
    if (onInsertSnippet) onInsertSnippet(prefix, suffix, placeholder);
  }

  function insertTable(): void {
    insert(
      "\n| Encabezado 1 | Encabezado 2 |\n| :--- | :--- |\n| Celda 1 | Celda 2 |\n\n",
    );
  }

  function insertMermaid(): void {
    insert(
      "\n```mermaid\nflowchart TD\n    A[Inicio] --> B(Proceso)\n    B --> C[Fin]\n```\n\n",
    );
  }

  function insertMath(): void {
    insert("\n$$\n\\int_{a}^{b} f(x) dx = F(b) - F(a)\n$$\n\n");
  }

  function handleMenuInsert(
    prefix: string,
    suffix = "",
    placeholder = "",
  ): void {
    insert(prefix, suffix, placeholder);
    moreMenuOpen = false;
  }

  function handleMenuInsertTable(): void {
    insertTable();
    moreMenuOpen = false;
  }

  function handleMenuInsertMermaid(): void {
    insertMermaid();
    moreMenuOpen = false;
  }

  function handleMenuInsertMath(): void {
    insertMath();
    moreMenuOpen = false;
  }
</script>

<svelte:document
  onclick={(e) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".font-popover-wrap")) {
      fontPopoverOpen = false;
    }
    if (!target.closest(".more-menu-wrap")) {
      moreMenuOpen = false;
    }
  }}
/>

<header class="studio-toolbar no-print">
  <!-- Grupo izquierdo: Lateral y Título -->
  <div class="toolbar-left">
    <button
      type="button"
      class="toolbar-btn toggle-sidebar-btn"
      class:active={sidebarOpen}
      onclick={onToggleSidebar}
      title="Mostrar u ocultar el panel lateral (Ctrl+B)"
      aria-label="Alternar panel lateral"
    >
      <FileText size={16} />
      <span class="badge">{documentStore.documents.length}</span>
    </button>

    <div class="title-group">
      <input
        type="text"
        class="title-input"
        bind:value={titleInputValue}
        onblur={handleTitleBlur}
        onkeydown={handleTitleKeyDown}
        placeholder="archivo.md"
        spellcheck="false"
        aria-label="Nombre del archivo"
      />
      <span class="save-status">Guardado</span>
      <button
        type="button"
        class="toolbar-btn icon-only danger-soft"
        onclick={handleCloseDoc}
        title="Cerrar y eliminar este archivo"
        aria-label="Cerrar y eliminar este archivo"
      >
        <X size={14} />
      </button>
    </div>
  </div>

  <!-- Grupo central: Selector de Modo de Vista y Formato -->
  <div class="toolbar-center">
    <div class="segmented-control" role="group" aria-label="Modo de vista">
      <button
        type="button"
        class="seg-btn"
        class:active={currentViewMode === "editor"}
        onclick={() => setView("editor")}
        title="Solo editor de código"
      >
        <Code size={15} />
        <span class="seg-label">Editor</span>
      </button>

      <button
        type="button"
        class="seg-btn seg-btn-split"
        class:active={currentViewMode === "split"}
        onclick={() => setView("split")}
        title="Vista dividida (Editor + Vista previa)"
      >
        <Columns2 size={15} />
        <span class="seg-label">Dividido</span>
      </button>

      <button
        type="button"
        class="seg-btn"
        class:active={currentViewMode === "preview"}
        onclick={() => setView("preview")}
        title="Solo lectura y vista previa"
      >
        <Eye size={15} />
        <span class="seg-label">Lectura</span>
      </button>
    </div>

    <!-- Botones rápidos de formato Markdown -->
    <div class="quick-format-group">
      <button
        type="button"
        class="format-btn"
        onclick={() => insert("**", "**", "negrita")}
        title="Negrita (**)"
      >
        <Bold size={14} />
      </button>
      <button
        type="button"
        class="format-btn"
        onclick={() => insert("*", "*", "cursiva")}
        title="Cursiva (*)"
      >
        <Italic size={14} />
      </button>
      <button
        type="button"
        class="format-btn"
        onclick={() => insert("## ", "\n", "Encabezado")}
        title="Encabezado (##)"
      >
        <Heading size={14} />
      </button>
      <button
        type="button"
        class="format-btn"
        onclick={() => insert("[", "](https://)", "enlace")}
        title="Enlace [texto](url)"
      >
        <Link size={14} />
      </button>
      <button
        type="button"
        class="format-btn"
        onclick={() => insert("- [ ] ", "", "Tarea")}
        title="Tarea (- [ ])"
      >
        <CheckSquare size={14} />
      </button>
      <button
        type="button"
        class="format-btn"
        onclick={insertTable}
        title="Insertar tabla"
      >
        <Table size={14} />
      </button>
      <button
        type="button"
        class="format-btn"
        onclick={insertMath}
        title="Fórmula KaTeX ($$)"
      >
        <Sigma size={14} />
      </button>
      <button
        type="button"
        class="format-btn"
        onclick={insertMermaid}
        title="Diagrama Mermaid"
      >
        <Workflow size={14} />
      </button>
    </div>
  </div>

  <!-- Grupo derecho: Opciones de lectura, tema y exportación -->
  <div class="toolbar-right">
    <!-- Popover de tamaño de fuente (Escritorio) -->
    <div class="font-popover-wrap desktop-only">
      <button
        type="button"
        class="toolbar-btn icon-only"
        class:active={fontPopoverOpen}
        onclick={(e) => {
          e.stopPropagation();
          fontPopoverOpen = !fontPopoverOpen;
        }}
        title="Tamaño del texto de lectura"
        aria-haspopup="true"
        aria-expanded={fontPopoverOpen}
      >
        <Type size={16} />
      </button>

      {#if fontPopoverOpen}
        <div class="font-popover">
          <span class="popover-title">Tamaño del texto</span>
          <div class="popover-buttons" role="group">
            <button
              type="button"
              class="pop-btn"
              class:active={currentFontSize === "small"}
              onclick={() => setSize("small")}
            >
              Pequeño
            </button>
            <button
              type="button"
              class="pop-btn"
              class:active={currentFontSize === "medium"}
              onclick={() => setSize("medium")}
            >
              Medio
            </button>
            <button
              type="button"
              class="pop-btn"
              class:active={currentFontSize === "large"}
              onclick={() => setSize("large")}
            >
              Grande
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Sincronizar Scroll (Escritorio) -->
    <button
      type="button"
      class="toolbar-btn icon-only desktop-only"
      class:active={documentStore.settings.syncScroll}
      onclick={() =>
        documentStore.updateSettings({
          syncScroll: !documentStore.settings.syncScroll,
        })}
      title={documentStore.settings.syncScroll
        ? "Sincronización de scroll activa"
        : "Sincronización de scroll desactivada"}
      aria-label="Sincronizar scroll"
    >
      <span
        class="status-indicator-dot"
        class:on={documentStore.settings.syncScroll}
      ></span>
      <span class="btn-micro-label">SYNC</span>
    </button>

    <!-- Números de línea (Escritorio) -->
    <button
      type="button"
      class="toolbar-btn icon-only desktop-only"
      class:active={documentStore.settings.lineNumbers}
      onclick={() =>
        documentStore.updateSettings({
          lineNumbers: !documentStore.settings.lineNumbers,
        })}
      title={documentStore.settings.lineNumbers
        ? "Ocultar números de línea"
        : "Mostrar números de línea"}
      aria-label="Números de línea"
    >
      <ListOrdered size={16} />
    </button>

    <!-- Minimapa (Escritorio) -->
    <button
      type="button"
      class="toolbar-btn icon-only desktop-only"
      class:active={documentStore.settings.minimap}
      onclick={() =>
        documentStore.updateSettings({
          minimap: !documentStore.settings.minimap,
        })}
      title={documentStore.settings.minimap
        ? "Ocultar minimapa"
        : "Mostrar minimapa"}
      aria-label="Minimapa"
    >
      <Map size={16} />
    </button>

    <!-- Cambio de Tema (Visible tanto en móvil como en escritorio) -->
    <button
      type="button"
      class="toolbar-btn icon-only theme-toggle-btn"
      onclick={() => documentStore.toggleTheme()}
      title={documentStore.isDark
        ? "Cambiar a modo claro"
        : "Cambiar a modo oscuro"}
      aria-label={documentStore.isDark
        ? "Cambiar a modo claro"
        : "Cambiar a modo oscuro"}
    >
      {#if documentStore.isDark}
        <Moon size={16} />
      {:else}
        <Sun size={16} />
      {/if}
    </button>

    <div class="divider-v desktop-only"></div>

    <!-- Guardar / Descargar Markdown (Escritorio) -->
    <button
      type="button"
      class="toolbar-btn desktop-only"
      onclick={exportMarkdown}
      title="Descargar archivo Markdown (.md)"
    >
      <Download size={15} />
      <span class="btn-label">Guardar .md</span>
    </button>

    <!-- Grupo Exportar a PDF (Visible directamente en Tablet y Escritorio) -->
    <div class="pdf-action-group tablet-and-desktop">
      <button
        type="button"
        class="toolbar-btn btn-primary"
        onclick={onExportPdf}
        title="Exportar únicamente la vista previa a PDF"
      >
        <Printer size={15} />
        <span class="btn-label">PDF</span>
      </button>

      <!-- Botón casi discreto para agregar/quitar URL en el pie de página (Solo pantalla grande) -->
      <button
        type="button"
        class="toolbar-btn icon-only pdf-url-btn desktop-only"
        class:active={documentStore.settings.includePdfUrl}
        onclick={() =>
          documentStore.updateSettings({
            includePdfUrl: !documentStore.settings.includePdfUrl,
          })}
        title={documentStore.settings.includePdfUrl
          ? "URL en pie de página del PDF: Activada (haz clic para ocultar)"
          : "URL en pie de página del PDF: Desactivada (haz clic para incluir)"}
        aria-label="Alternar URL en pie de página del PDF"
      >
        <Link size={13} />
        <span
          class="url-status-dot"
          class:on={documentStore.settings.includePdfUrl}
        ></span>
      </button>
    </div>

    <!-- Menú Más Opciones (Tablets y Móviles: Formato, Herramientas y Exportación) -->
    <div class="more-menu-wrap">
      <button
        type="button"
        class="toolbar-btn icon-only more-toggle-btn"
        class:active={moreMenuOpen}
        onclick={(e) => {
          e.stopPropagation();
          moreMenuOpen = !moreMenuOpen;
        }}
        title="Más opciones de herramientas, formato y exportación"
        aria-haspopup="true"
        aria-expanded={moreMenuOpen}
        aria-label="Más opciones"
      >
        <MoreVertical size={16} />
      </button>

      {#if moreMenuOpen}
        <div class="more-actions-menu" role="menu" tabindex="-1">
          <!-- Exportar a PDF (visible en menú en pantallas móviles) -->
          <button
            type="button"
            class="menu-action-btn primary mobile-only-flex"
            onclick={() => {
              moreMenuOpen = false;
              onExportPdf?.();
            }}
          >
            <Printer size={15} />
            <span>Exportar a PDF</span>
          </button>

          <!-- Descargar Markdown -->
          <button
            type="button"
            class="menu-action-btn"
            onclick={() => {
              moreMenuOpen = false;
              exportMarkdown();
            }}
          >
            <Download size={15} />
            <span>Descargar archivo .md</span>
          </button>

          <div class="menu-divider"></div>

          <!-- Sección Opciones de Exportación PDF -->
          <div class="menu-section">
            <span class="menu-section-title">Opciones de PDF</span>
            <button
              type="button"
              class="menu-tool-toggle"
              onclick={() =>
                documentStore.updateSettings({
                  includePdfUrl: !documentStore.settings.includePdfUrl,
                })}
              title="Incluir u ocultar la URL en el pie de página del PDF"
            >
              <div class="menu-tool-info">
                <Link size={15} />
                <span>URL en pie de página</span>
              </div>
              <span
                class="toggle-pill"
                class:on={documentStore.settings.includePdfUrl}
              >
                {documentStore.settings.includePdfUrl ? "ON" : "OFF"}
              </span>
            </button>
          </div>

          <div class="menu-divider"></div>

          <!-- Sección Formato Markdown (Accesos directos táctiles) -->
          <div class="menu-section">
            <span class="menu-section-title">Formato Markdown</span>
            <div class="format-grid">
              <button
                type="button"
                class="format-chip"
                onclick={() => handleMenuInsert("**", "**", "negrita")}
                title="Negrita (**texto**)"
              >
                <Bold size={14} />
                <span>Negrita</span>
              </button>
              <button
                type="button"
                class="format-chip"
                onclick={() => handleMenuInsert("*", "*", "cursiva")}
                title="Cursiva (*texto*)"
              >
                <Italic size={14} />
                <span>Cursiva</span>
              </button>
              <button
                type="button"
                class="format-chip"
                onclick={() => handleMenuInsert("## ", "\n", "Encabezado")}
                title="Encabezado (##)"
              >
                <Heading size={14} />
                <span>Título</span>
              </button>
              <button
                type="button"
                class="format-chip"
                onclick={() => handleMenuInsert("[", "](https://)", "enlace")}
                title="Enlace [texto](url)"
              >
                <Link size={14} />
                <span>Enlace</span>
              </button>
              <button
                type="button"
                class="format-chip"
                onclick={() => handleMenuInsert("- [ ] ", "", "Tarea")}
                title="Tarea interactiva"
              >
                <CheckSquare size={14} />
                <span>Tarea</span>
              </button>
              <button
                type="button"
                class="format-chip"
                onclick={handleMenuInsertTable}
                title="Insertar tabla"
              >
                <Table size={14} />
                <span>Tabla</span>
              </button>
              <button
                type="button"
                class="format-chip"
                onclick={handleMenuInsertMath}
                title="Ecuación KaTeX ($$)"
              >
                <Sigma size={14} />
                <span>KaTeX</span>
              </button>
              <button
                type="button"
                class="format-chip"
                onclick={handleMenuInsertMermaid}
                title="Diagrama Mermaid"
              >
                <Workflow size={14} />
                <span>Mermaid</span>
              </button>
            </div>
          </div>

          <div class="menu-divider"></div>

          <!-- Selector de tamaño de fuente -->
          <div class="menu-section">
            <span class="menu-section-title">Tamaño de lectura</span>
            <div class="popover-buttons" role="group">
              <button
                type="button"
                class="pop-btn"
                class:active={currentFontSize === "small"}
                onclick={() => setSize("small")}
              >
                Pequeño
              </button>
              <button
                type="button"
                class="pop-btn"
                class:active={currentFontSize === "medium"}
                onclick={() => setSize("medium")}
              >
                Medio
              </button>
              <button
                type="button"
                class="pop-btn"
                class:active={currentFontSize === "large"}
                onclick={() => setSize("large")}
              >
                Grande
              </button>
            </div>
          </div>

          <div class="menu-divider"></div>

          <!-- Herramientas y opciones de visualización -->
          <div class="menu-section">
            <span class="menu-section-title">Herramientas</span>

            <button
              type="button"
              class="menu-tool-toggle"
              onclick={() =>
                documentStore.updateSettings({
                  syncScroll: !documentStore.settings.syncScroll,
                })}
              title="Sincronizar scroll entre editor y vista previa"
            >
              <div class="menu-tool-info">
                <span
                  class="status-indicator-dot"
                  class:on={documentStore.settings.syncScroll}
                ></span>
                <span>Sincronizar Scroll</span>
              </div>
              <span
                class="toggle-pill"
                class:on={documentStore.settings.syncScroll}
              >
                {documentStore.settings.syncScroll ? "ON" : "OFF"}
              </span>
            </button>

            <button
              type="button"
              class="menu-tool-toggle"
              onclick={() =>
                documentStore.updateSettings({
                  lineNumbers: !documentStore.settings.lineNumbers,
                })}
              title="Alternar números de línea en el editor"
            >
              <div class="menu-tool-info">
                <ListOrdered size={15} />
                <span>Números de línea</span>
              </div>
              <span
                class="toggle-pill"
                class:on={documentStore.settings.lineNumbers}
              >
                {documentStore.settings.lineNumbers ? "ON" : "OFF"}
              </span>
            </button>

            <button
              type="button"
              class="menu-tool-toggle"
              onclick={() =>
                documentStore.updateSettings({
                  minimap: !documentStore.settings.minimap,
                })}
              title="Alternar minimapa en el editor"
            >
              <div class="menu-tool-info">
                <Map size={15} />
                <span>Minimapa</span>
              </div>
              <span
                class="toggle-pill"
                class:on={documentStore.settings.minimap}
              >
                {documentStore.settings.minimap ? "ON" : "OFF"}
              </span>
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</header>

<style>
  .studio-toolbar {
    position: relative;
    height: 52px;
    min-height: 52px;
    background-color: var(--bg-surface, #1a1b1d);
    border-bottom: 1px solid var(--border-color, #2b2d31);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0.85rem;
    gap: 0.65rem;
    user-select: none;
    z-index: 50;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
    flex-shrink: 0;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .toolbar-center {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  /* Título editable y status */
  .title-group {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: var(--bg-elevated, #26282b);
    padding: 2px 4px 2px 8px;
    border-radius: 6px;
    border: 1px solid var(--border-subtle, #232427);
    min-width: 0;
    flex-shrink: 1;
  }

  .title-input {
    background: transparent;
    border: none;
    outline: none;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary, #e8e6e1);
    font-family: inherit;
    width: 140px;
    min-width: 35px;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }

  .title-input:focus {
    color: var(--accent-color, #5fb3a3);
  }

  .save-status {
    font-size: 0.7rem;
    color: var(--text-faint, #6f6e69);
    padding: 0 4px;
  }

  /* Segmented Control para Modos de Vista */
  .segmented-control {
    display: flex;
    align-items: center;
    background-color: var(--bg-elevated, #26282b);
    border: 1px solid var(--border-color, #2b2d31);
    border-radius: 6px;
    padding: 2px;
    gap: 2px;
    flex-shrink: 0;
  }

  .seg-btn {
    border: none;
    background: transparent;
    color: var(--text-secondary, #9b9a94);
    font-size: 0.8rem;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;
  }

  .seg-btn:hover {
    color: var(--text-primary, #e8e6e1);
  }

  .seg-btn.active {
    background-color: var(--bg-surface, #1a1b1d);
    color: var(--accent-color, #5fb3a3);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  /* Botones rápidos de formato */
  .quick-format-group {
    display: flex;
    align-items: center;
    background-color: var(--bg-elevated, #26282b);
    border-radius: 6px;
    padding: 2px 4px;
    gap: 2px;
  }

  .format-btn {
    border: none;
    background: transparent;
    color: var(--text-secondary, #9b9a94);
    width: 26px;
    height: 26px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;
  }

  .format-btn:hover {
    background-color: var(--bg-hover, #2e3034);
    color: var(--accent-color, #5fb3a3);
  }

  /* Botones generales de Toolbar */
  .toolbar-btn {
    border: none;
    background: transparent;
    color: var(--text-secondary, #9b9a94);
    height: 32px;
    padding: 0 10px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    font-size: 0.825rem;
    font-weight: 500;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;
  }

  .toolbar-btn.icon-only {
    width: 32px;
    padding: 0;
  }

  .toolbar-btn:hover {
    background-color: var(--bg-hover, #2e3034);
    color: var(--text-primary, #e8e6e1);
  }

  .toolbar-btn.active {
    background-color: var(--bg-elevated, #26282b);
    color: var(--accent-color, #5fb3a3);
  }

  .toolbar-btn.btn-primary {
    background-color: var(--accent-color, #5fb3a3);
    color: var(--accent-ink, #0e1a18);
    font-weight: 600;
    padding: 0 12px;
  }

  .toolbar-btn.btn-primary:hover {
    background-color: var(--accent-hover, #7cc9bb);
  }

  /* Grupo de acción PDF y botón discreto de URL */
  .pdf-action-group {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .pdf-url-btn {
    width: 26px !important;
    height: 32px !important;
    padding: 0 !important;
    position: relative;
    border: 1px solid var(--border-color, #2b2d31);
    background-color: var(--bg-surface, #1a1b1d);
    border-radius: 6px;
    color: var(--text-secondary, #9b9a94);
    transition: all 0.15s ease;
  }

  .pdf-url-btn:hover {
    background-color: var(--bg-hover, #2e3034);
    color: var(--text-primary, #e8e6e1);
    border-color: var(--border-subtle, #36393e);
  }

  .pdf-url-btn.active {
    color: var(--accent-color, #5fb3a3);
    border-color: rgba(95, 179, 163, 0.4);
    background-color: var(--accent-soft, rgba(95, 179, 163, 0.08));
  }

  .url-status-dot {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: var(--text-faint, #6f6e69);
    transition: background-color 0.15s ease;
  }

  .url-status-dot.on {
    background-color: var(--accent-color, #5fb3a3);
    box-shadow: 0 0 4px rgba(95, 179, 163, 0.6);
  }

  .badge {
    background-color: var(--accent-soft, rgba(95, 179, 163, 0.15));
    color: var(--accent-color, #5fb3a3);
    font-size: 0.7rem;
    padding: 1px 5px;
    border-radius: 9999px;
    font-weight: 700;
  }

  .btn-micro-label {
    font-size: 0.675rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .status-indicator-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: var(--text-faint, #6f6e69);
  }

  .status-indicator-dot.on {
    background-color: var(--accent-color, #5fb3a3);
  }

  .danger-soft:hover {
    color: var(--danger-color, #e5736a) !important;
  }

  .divider-v {
    width: 1px;
    height: 20px;
    background-color: var(--border-color, #2b2d31);
    margin: 0 3px;
  }

  /* Popover de tamaño tipográfico */
  .font-popover-wrap {
    position: relative;
  }

  .font-popover {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    background-color: var(--bg-surface, #1a1b1d);
    border: 1px solid var(--border-color, #2b2d31);
    border-radius: 8px;
    padding: 10px 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 180px;
  }

  .popover-title {
    font-size: 0.725rem;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--text-secondary, #9b9a94);
    letter-spacing: 0.05em;
  }

  .popover-buttons {
    display: flex;
    gap: 4px;
    background-color: var(--bg-elevated, #26282b);
    padding: 2px;
    border-radius: 6px;
  }

  .pop-btn {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--text-secondary, #9b9a94);
    font-size: 0.75rem;
    padding: 5px 8px;
    border-radius: 4px;
    cursor: pointer;
  }

  .pop-btn.active {
    background-color: var(--bg-surface, #1a1b1d);
    color: var(--accent-color, #5fb3a3);
    font-weight: 600;
  }

  /* ==========================================================================
     SISTEMA RESPONSIVO EN 3 NIVELES: MÓVIL (BASE) -> TABLET -> ESCRITORIO
     ========================================================================== */

  /* --- 1. REGLAS BASE POR DEFECTO: MÓVILES (<= 640px) ---
     Todo el contenido secundario de escritorio se oculta de forma incondicional.
     La barra es limpia: Título compacto, conmutador Editor/Lectura, Tema y Menú ⋮ */
  .desktop-only,
  button.desktop-only,
  div.desktop-only {
    display: none !important;
  }

  .quick-format-group {
    display: none !important;
  }

  .tablet-and-desktop {
    display: none !important;
  }

  .seg-btn-split {
    display: none !important;
  }

  .more-menu-wrap {
    display: flex !important;
  }

  .mobile-only-flex {
    display: flex !important;
  }

  .save-status {
    display: none !important;
  }

  .studio-toolbar {
    padding: 0 0.5rem;
    gap: 0.35rem;
  }

  .title-group {
    max-width: 110px;
  }

  .title-input {
    max-width: 75px;
    width: 75px;
  }

  /* --- Menú desplegable para Tablets y Móviles --- */
  .more-menu-wrap {
    position: relative;
  }

  .more-actions-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    background-color: var(--bg-surface, #1a1b1d);
    border: 1px solid var(--border-color, #2b2d31);
    border-radius: 10px;
    padding: 8px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    z-index: 70;
    width: 290px;
    max-width: calc(100vw - 20px);
    max-height: calc(100vh - 75px);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    animation: menuPop 0.16s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes menuPop {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .menu-action-btn {
    border: none;
    background: transparent;
    color: var(--text-primary, #e8e6e1);
    padding: 8px 10px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.835rem;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: background-color 0.12s ease;
  }

  .menu-action-btn:hover {
    background-color: var(--bg-hover, #2e3034);
  }

  .menu-action-btn.primary {
    color: var(--accent-color, #5fb3a3);
    font-weight: 600;
  }

  .menu-divider {
    height: 1px;
    background-color: var(--border-subtle, #232427);
    margin: 2px 0;
  }

  .menu-section {
    padding: 4px 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .menu-section-title {
    font-size: 0.68rem;
    text-transform: uppercase;
    color: var(--text-secondary, #9b9a94);
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  /* Grilla de accesos rápidos de formato Markdown */
  .format-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .format-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 2px;
    background-color: var(--bg-elevated, #26282b);
    border: 1px solid var(--border-subtle, #2e3034);
    border-radius: 6px;
    color: var(--text-secondary, #9b9a94);
    font-size: 0.675rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .format-chip:hover,
  .format-chip:active {
    background-color: var(--bg-hover, #2e3034);
    color: var(--accent-color, #5fb3a3);
    border-color: var(--accent-color, #5fb3a3);
  }

  /* Conmutadores de herramientas en el menú */
  .menu-tool-toggle {
    border: none;
    background: transparent;
    color: var(--text-primary, #e8e6e1);
    padding: 7px 8px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    width: 100%;
    transition: background-color 0.12s ease;
  }

  .menu-tool-toggle:hover {
    background-color: var(--bg-hover, #2e3034);
  }

  .menu-tool-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.825rem;
    font-weight: 500;
  }

  .toggle-pill {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    background-color: var(--bg-elevated, #26282b);
    color: var(--text-faint, #6f6e69);
    letter-spacing: 0.04em;
  }

  .toggle-pill.on {
    background-color: var(--accent-soft, rgba(95, 179, 163, 0.18));
    color: var(--accent-color, #5fb3a3);
  }

  /* --- 2. TIER TABLETS (641px a 1024px, ej: Surface Pro 960px, iPads) ---
     - Conmutador con 'Dividido' habilitado para ver Editor + Preview a la vez.
     - Botón PDF en la barra superior.
     - Herramientas secundarias y formato rápido en el menú ⋮ para máxima holgura. */
  @media (min-width: 641px) {
    .tablet-and-desktop {
      display: inline-flex !important;
    }

    .seg-btn-split {
      display: inline-flex !important;
    }

    .mobile-only-flex {
      display: none !important;
    }

    .studio-toolbar {
      padding: 0 0.75rem;
      gap: 0.5rem;
    }

    .title-group {
      max-width: 160px;
    }

    .title-input {
      max-width: 115px;
      width: 115px;
    }
  }

  /* --- 3. TIER ESCRITORIO (> 1024px) ---
     - Se muestran todas las herramientas directamente en la barra superior.
     - Menú ⋮ se oculta.
     - Acceso rápido de formato Markdown visible. */
  @media (min-width: 1025px) {
    .desktop-only {
      display: flex !important;
    }

    button.desktop-only {
      display: inline-flex !important;
    }

    div.divider-v.desktop-only {
      display: block !important;
    }

    .quick-format-group {
      display: flex !important;
    }

    .more-menu-wrap {
      display: none !important;
    }

    .save-status {
      display: inline !important;
    }

    .studio-toolbar {
      padding: 0 0.85rem;
      gap: 0.65rem;
    }

    .title-group {
      max-width: 240px;
    }

    .title-input {
      max-width: 140px;
      width: 140px;
    }
  }

  /* --- MICRO-PANTALLAS (<= 420px) --- */
  @media (max-width: 420px) {
    .seg-label {
      display: none !important;
    }

    .seg-btn {
      padding: 5px 8px;
    }

    .title-group {
      max-width: 85px;
      padding: 2px 4px;
    }

    .title-input {
      max-width: 50px;
      width: 50px;
      font-size: 0.8rem;
    }

    .toolbar-btn {
      padding: 4px;
    }

    .more-actions-menu {
      right: -6px;
      width: 270px;
    }
  }
</style>
