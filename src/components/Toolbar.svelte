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
    ChevronDown,
    Printer,
    Sun,
    Moon,
    Type,
    Palette,
    Check,
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
  } from "lucide-svelte";
  import { documentStore } from "../stores/documents.svelte";
  import type { CodeThemeId, FontSize, ViewMode } from "../types";
  import { CODE_THEMES, getPalette } from "../lib/codeThemes";

  interface Props {
    sidebarOpen: boolean;
    onToggleSidebar: () => void;
    onInsertSnippet?: (
      prefix: string,
      suffix?: string,
      placeholder?: string,
    ) => void;
    onExportPdf?: () => void;
    onExportHtml?: () => void;
  }

  let {
    sidebarOpen,
    onToggleSidebar,
    onInsertSnippet,
    onExportPdf,
    onExportHtml,
  }: Props = $props();

  let fontPopoverOpen = $state(false);
  let exportMenuOpen = $state(false);
  let codeThemeOpen = $state(false);
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

  function setCodeTheme(id: CodeThemeId): void {
    documentStore.updateSettings({ codeTheme: id });
    codeThemeOpen = false;
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
</script>

<svelte:document
  onclick={(e) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".font-popover-wrap")) {
      fontPopoverOpen = false;
    }
    if (!target.closest(".code-theme-wrap")) {
      codeThemeOpen = false;
    }
    if (!target.closest(".export-menu-wrap")) {
      exportMenuOpen = false;
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
        class="seg-btn"
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
    <!-- Popover de tamaño de fuente -->
    <div class="font-popover-wrap">
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

    <!-- Tema de colores del código (editor y vista previa) -->
    <div class="code-theme-wrap">
      <button
        type="button"
        class="toolbar-btn icon-only"
        class:active={codeThemeOpen}
        onclick={(e) => {
          e.stopPropagation();
          codeThemeOpen = !codeThemeOpen;
        }}
        title="Tema de colores del código"
        aria-label="Tema de colores del código"
        aria-haspopup="true"
        aria-expanded={codeThemeOpen}
      >
        <Palette size={16} />
      </button>

      {#if codeThemeOpen}
        <div class="export-menu" role="menu" tabindex="-1">
          <span class="popover-title menu-title">Colores del código</span>
          {#each CODE_THEMES as theme (theme.id)}
            {@const pal = getPalette(theme.id, documentStore.isDark)}
            <button
              type="button"
              class="menu-action-btn theme-option"
              class:selected={documentStore.settings.codeTheme === theme.id}
              role="menuitemradio"
              aria-checked={documentStore.settings.codeTheme === theme.id}
              onclick={() => setCodeTheme(theme.id)}
            >
              <span
                class="theme-swatch"
                style="background:{pal.bg};border-color:{pal.border}"
                aria-hidden="true"
              >
                <i style="background:{pal.keyword}"></i>
                <i style="background:{pal.string}"></i>
                <i style="background:{pal.fn}"></i>
                <i style="background:{pal.comment}"></i>
              </span>
              <span class="theme-text">
                <span class="theme-name">{theme.label}</span>
                <span class="theme-desc">{theme.description}</span>
              </span>
              {#if documentStore.settings.codeTheme === theme.id}
                <Check size={14} />
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Sincronizar Scroll -->
    <button
      type="button"
      class="toolbar-btn icon-only"
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

    <!-- Números de línea -->
    <button
      type="button"
      class="toolbar-btn icon-only"
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

    <!-- Minimapa -->
    <button
      type="button"
      class="toolbar-btn icon-only"
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

    <!-- Cambio de Tema -->
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

    <div class="divider-v"></div>

    <!-- Menú desplegable de exportación (Markdown, PDF, HTML) -->
    <div class="export-menu-wrap">
      <button
        type="button"
        class="toolbar-btn btn-primary"
        class:active={exportMenuOpen}
        onclick={(e) => {
          e.stopPropagation();
          exportMenuOpen = !exportMenuOpen;
        }}
        title="Exportar documento"
        aria-haspopup="true"
        aria-expanded={exportMenuOpen}
      >
        <Download size={15} />
        <span class="btn-label">Exportar</span>
        <ChevronDown size={13} />
      </button>

      {#if exportMenuOpen}
        <div class="export-menu" role="menu" tabindex="-1">
          <button
            type="button"
            class="menu-action-btn"
            role="menuitem"
            onclick={() => {
              exportMenuOpen = false;
              exportMarkdown();
            }}
          >
            <FileText size={15} />
            <span>Exportar Markdown (.md)</span>
          </button>
          <button
            type="button"
            class="menu-action-btn"
            role="menuitem"
            onclick={() => {
              exportMenuOpen = false;
              onExportPdf?.();
            }}
          >
            <Printer size={15} />
            <span>Exportar PDF</span>
          </button>
          <button
            type="button"
            class="menu-action-btn"
            role="menuitem"
            onclick={() => {
              exportMenuOpen = false;
              onExportHtml?.();
            }}
          >
            <Code size={15} />
            <span>Exportar HTML5</span>
          </button>

          <div class="menu-divider"></div>

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
              <span>URL en pie del PDF</span>
            </div>
            <span
              class="toggle-pill"
              class:on={documentStore.settings.includePdfUrl}
            >
              {documentStore.settings.includePdfUrl ? "ON" : "OFF"}
            </span>
          </button>
        </div>
      {/if}
    </div>
  </div>
</header>

<style>
  .studio-toolbar {
    position: relative;
    min-height: 52px;
    background-color: var(--bg-surface, #1a1b1d);
    border-bottom: 1px solid var(--border-color, #2b2d31);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    padding: 0.4rem 0.75rem;
    gap: 0.4rem 0.65rem;
    user-select: none;
    z-index: 50;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
    flex: 1 1 auto;
    order: 1;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex: 0 1 auto;
    flex-wrap: wrap;
    justify-content: flex-end;
    margin-left: auto;
    order: 2;
  }

  /* Centro: ocupa su propia fila en pantallas angostas; el formato hace scroll horizontal */
  .toolbar-center {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1 1 100%;
    min-width: 0;
    order: 3;
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
    flex: 0 1 240px;
  }

  .title-input {
    background: transparent;
    border: none;
    outline: none;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary, #e8e6e1);
    font-family: inherit;
    flex: 1 1 auto;
    width: 100%;
    min-width: 40px;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }

  .title-input:focus {
    color: var(--accent-color, #5fb3a3);
  }

  .save-status {
    display: none;
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
    flex: 0 1 auto;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .quick-format-group::-webkit-scrollbar {
    display: none;
  }

  .format-btn {
    flex-shrink: 0;
    border: none;
    background: transparent;
    color: var(--text-secondary, #9b9a94);
    width: 28px;
    height: 28px;
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
    flex-shrink: 0;
    white-space: nowrap;
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

  /* Popover de tamaño tipográfico (anclado a la barra) */

  .font-popover {
    position: absolute;
    top: calc(100% + 6px);
    right: 0.75rem;
    background-color: var(--bg-surface, #1a1b1d);
    border: 1px solid var(--border-color, #2b2d31);
    border-radius: 8px;
    padding: 10px 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    z-index: 70;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 220px;
    max-width: calc(100vw - 1.5rem);
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

  /* Menú desplegable de exportación (anclado a la barra) */
  .export-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0.75rem;
    background-color: var(--bg-surface, #1a1b1d);
    border: 1px solid var(--border-color, #2b2d31);
    border-radius: 10px;
    padding: 6px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    z-index: 70;
    width: 290px;
    max-width: calc(100vw - 1.5rem);
    display: flex;
    flex-direction: column;
    gap: 2px;
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

  .menu-title {
    padding: 4px 10px 6px;
  }

  .theme-option {
    gap: 10px;
  }

  .theme-option.selected {
    background-color: var(--bg-elevated, #26282b);
    color: var(--accent-color, #5fb3a3);
  }

  .theme-swatch {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 6px;
    border: 1px solid;
    border-radius: 6px;
    flex-shrink: 0;
  }

  .theme-swatch i {
    width: 6px;
    height: 14px;
    border-radius: 2px;
    display: block;
  }

  .theme-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .theme-name {
    font-weight: 600;
  }

  .theme-desc {
    font-size: 0.68rem;
    color: var(--text-secondary, #9b9a94);
    font-weight: 400;
    line-height: 1.3;
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

  .menu-divider {
    height: 1px;
    background-color: var(--border-subtle, #232427);
    margin: 4px 0;
  }

  .menu-tool-toggle {
    border: none;
    background: transparent;
    color: var(--text-primary, #e8e6e1);
    padding: 7px 10px;
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

  /* ==========================================================================
     RESPONSIVO: todas las opciones están siempre disponibles.
     La barra fluye en filas (flex-wrap) según el ancho; sin elementos ocultos.
     ========================================================================== */

  /* Pantallas pequeñas: solo íconos para ahorrar espacio */
  @media (max-width: 640px) {
    .seg-label,
    .btn-label {
      display: none;
    }

    .studio-toolbar {
      padding: 0.35rem 0.5rem;
      gap: 0.35rem;
    }

    .toolbar-btn.btn-primary {
      padding: 0 8px;
    }

    .export-menu,
    .font-popover {
      right: 0.5rem;
    }
  }

  /* Tablets y pantallas medianas: etiquetas visibles, centro en su propia fila */
  @media (min-width: 641px) {
    .toolbar-center {
      justify-content: center;
    }

    .quick-format-group {
      flex: 0 1 auto;
    }
  }

  /* Pantallas grandes: una sola fila (izquierda · centro · derecha) */
  @media (min-width: 1280px) {
    .studio-toolbar {
      padding: 0 0.85rem;
      flex-wrap: nowrap;
    }

    .toolbar-left {
      flex: 0 1 auto;
      order: 1;
    }

    .toolbar-center {
      flex: 0 1 auto;
      order: 2;
    }

    .toolbar-right {
      flex-wrap: nowrap;
      margin-left: 0;
      order: 3;
    }

    .save-status {
      display: inline;
    }
  }
</style>
