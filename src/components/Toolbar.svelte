<script lang="ts">
  /**
   * Componente Toolbar de MD Studio.
   * Barra de herramientas responsiva y ergonómica en 3 niveles (Escritorio, Tablet, Móvil):
   * - Fila superior: Acceso a sidebar, nombre de archivo solo lectura ("Sincronizado"),
   *   selector de vistas (conmutador binario en móvil sin split), tema claro/oscuro,
   *   enlace a GitHub directo en escritorio/tablet (en móvil dentro de '...'),
   *   menú de 3 puntos horizontales para herramientas secundarias y botón de exportación
   *   con opción de URL en pie de página del PDF siempre integrada.
   * - Ocultamiento automático de la fila de atajos de formato y del minimapa en modo Preview.
   */
  import {
    Bold,
    Check,
    CheckSquare,
    Code,
    Columns2,
    Download,
    Eye,
    FileText,
    Heading,
    Italic,
    Link,
    ListOrdered,
    Map,
    Menu,
    Moon,
    MoreHorizontal,
    Palette,
    Printer,
    Sigma,
    Sun,
    Table,
    Workflow,
  } from "lucide-svelte";
  import { documentStore } from "../stores/documents.svelte";
  import type { CodeThemeId, ViewMode } from "../types";
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

  let exportMenuOpen = $state(false);
  let codeThemeOpen = $state(false);
  let moreMenuOpen = $state(false);

  const activeDoc = $derived(documentStore.activeDocument);
  const activeDocTitle = $derived(activeDoc?.title || "documento.md");
  const currentViewMode = $derived(documentStore.settings.viewMode);

  // En pantallas móviles (<= 640px), si el usuario está en modo split,
  // conmutar automáticamente a editor para evitar compresión excesiva.
  $effect(() => {
    if (
      typeof window !== "undefined" &&
      window.innerWidth <= 640 &&
      documentStore.settings.viewMode === "split"
    ) {
      documentStore.setViewMode("editor");
    }
  });

  function setView(mode: ViewMode): void {
    documentStore.setViewMode(mode);
  }

  function setCodeTheme(id: CodeThemeId): void {
    documentStore.updateSettings({ codeTheme: id });
    codeThemeOpen = false;
    moreMenuOpen = false;
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
    insert("\n$$\n\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}\n$$\n\n");
  }
</script>

<svelte:window
  onclick={(e) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".code-theme-wrap")) {
      codeThemeOpen = false;
    }
    if (!target.closest(".export-menu-wrap")) {
      exportMenuOpen = false;
    }
    if (!target.closest(".more-menu-wrap")) {
      moreMenuOpen = false;
    }
  }}
/>

<header class="studio-toolbar no-print">
  <!-- FILA 1: Barra Principal Superior -->
  <div class="toolbar-main-row">
    <!-- Grupo Izquierdo: Botón Sidebar + Título solo lectura con estado Sincronizado -->
    <div class="toolbar-left">
      <button
        type="button"
        class="toolbar-btn icon-sidebar-toggle"
        class:sidebar-is-open={sidebarOpen}
        onclick={onToggleSidebar}
        title="Mostrar u ocultar panel lateral (Ctrl+B)"
        aria-label="Alternar panel lateral"
      >
        <Menu size={18} />
      </button>

      <div class="title-readonly-wrap">
        <span class="readonly-doc-name" title={activeDocTitle}>
          {activeDocTitle}
        </span>
        <span class="readonly-sync-status">Sincronizado</span>
      </div>
    </div>

    <!-- Grupo Derecho: Vistas, Herramientas, Tema, GitHub, 3 Puntos y Exportación -->
    <div class="toolbar-right">
      <!-- Selector de Modo de Vista (Editor, Dividido, Lectura) -->
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

        <!-- El botón Dividido se oculta completamente en móviles (<= 640px) -->
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

      <!-- Scroll Sincronizado (Visible en Desktop y Tablet; en Móvil dentro de '...') -->
      <button
        type="button"
        class="toolbar-btn icon-only desktop-sync-btn"
        class:active={documentStore.settings.syncScroll}
        onclick={() =>
          documentStore.updateSettings({
            syncScroll: !documentStore.settings.syncScroll,
          })}
        title={documentStore.settings.syncScroll
          ? "Desactivar scroll sincronizado"
          : "Activar scroll sincronizado"}
        aria-label="Scroll sincronizado"
      >
        <span class="sync-pill-text">SYNC</span>
      </button>

      <!-- Selector de Paletas de Código (Directo en Escritorio) -->
      <div class="code-theme-wrap desktop-theme-btn">
        <button
          type="button"
          class="toolbar-btn icon-only"
          class:active={codeThemeOpen}
          onclick={(e) => {
            e.stopPropagation();
            codeThemeOpen = !codeThemeOpen;
          }}
          title="Tema de colores de código"
          aria-haspopup="true"
          aria-expanded={codeThemeOpen}
        >
          <Palette size={16} />
        </button>

        {#if codeThemeOpen}
          <div class="export-menu code-theme-menu" role="menu" tabindex="-1">
            <span class="popover-title menu-title">Colores de código</span>
            {#each CODE_THEMES as theme}
              {@const palette = getPalette(theme.id, documentStore.isDark)}
              <button
                type="button"
                class="menu-action-btn theme-option"
                class:selected={documentStore.settings.codeTheme === theme.id}
                role="menuitem"
                onclick={() => setCodeTheme(theme.id)}
              >
                <div
                  class="theme-swatch"
                  style="background-color: {palette.bg}; border-color: {palette.border};"
                  aria-hidden="true"
                >
                  <i style="background-color: {palette.keyword};"></i>
                  <i style="background-color: {palette.fn};"></i>
                  <i style="background-color: {palette.string};"></i>
                </div>
                <div class="theme-text">
                  <span class="theme-name">{theme.label}</span>
                  <span class="theme-desc">{theme.description}</span>
                </div>
                {#if documentStore.settings.codeTheme === theme.id}
                  <Check size={14} class="check-icon" />
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Números de Línea (Desktop) -->
      <button
        type="button"
        class="toolbar-btn icon-only desktop-linenum-btn"
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

      <!-- Minimapa (Desktop y Tablet; se oculta en móvil y en modo Preview) -->
      {#if currentViewMode !== "preview"}
        <button
          type="button"
          class="toolbar-btn icon-only desktop-minimap-btn"
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
      {/if}

      <!-- Cambio de Tema Claro / Oscuro (Siempre visible) -->
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

      <!-- Enlace a GitHub (Visible directamente en Escritorio y Tablet al lado derecho de Sol/Luna) -->
      <a
        href="https://github.com/SamaelEND/markdown-studio"
        target="_blank"
        rel="noopener noreferrer"
        class="toolbar-btn icon-only desktop-tablet-github"
        title="Ver código en GitHub"
        aria-label="Repositorio de GitHub"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 98 96"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
          />
        </svg>
      </a>

      <!-- Menú de 3 Puntos Horizontales ('...') para Tablet y Móvil -->
      <div class="more-menu-wrap">
        <button
          type="button"
          class="toolbar-btn icon-only more-tools-btn"
          class:active={moreMenuOpen}
          onclick={(e) => {
            e.stopPropagation();
            moreMenuOpen = !moreMenuOpen;
          }}
          title="Más herramientas"
          aria-haspopup="true"
          aria-expanded={moreMenuOpen}
        >
          <MoreHorizontal size={18} />
        </button>

        {#if moreMenuOpen}
          <div class="export-menu more-dropdown-panel" role="menu" tabindex="-1">
            <span class="popover-title menu-title">Opciones adicionales</span>

            <!-- Scroll Sincronizado en móvil -->
            <button
              type="button"
              class="menu-tool-toggle mobile-only-toggle"
              onclick={() =>
                documentStore.updateSettings({
                  syncScroll: !documentStore.settings.syncScroll,
                })}
            >
              <div class="menu-tool-info">
                <span>Scroll sincronizado (SYNC)</span>
              </div>
              <span
                class="toggle-pill"
                class:on={documentStore.settings.syncScroll}
              >
                {documentStore.settings.syncScroll ? "ON" : "OFF"}
              </span>
            </button>

            <!-- Números de línea en móvil -->
            <button
              type="button"
              class="menu-tool-toggle mobile-only-toggle"
              onclick={() =>
                documentStore.updateSettings({
                  lineNumbers: !documentStore.settings.lineNumbers,
                })}
            >
              <div class="menu-tool-info">
                <span>Números de línea</span>
              </div>
              <span
                class="toggle-pill"
                class:on={documentStore.settings.lineNumbers}
              >
                {documentStore.settings.lineNumbers ? "ON" : "OFF"}
              </span>
            </button>

            <div class="menu-divider"></div>

            <span class="popover-title menu-title">Paleta de código</span>
            {#each CODE_THEMES as theme}
              {@const palette = getPalette(theme.id, documentStore.isDark)}
              <button
                type="button"
                class="menu-action-btn theme-option"
                class:selected={documentStore.settings.codeTheme === theme.id}
                role="menuitem"
                onclick={() => setCodeTheme(theme.id)}
              >
                <div
                  class="theme-swatch"
                  style="background-color: {palette.bg}; border-color: {palette.border};"
                  aria-hidden="true"
                >
                  <i style="background-color: {palette.keyword};"></i>
                  <i style="background-color: {palette.fn};"></i>
                  <i style="background-color: {palette.string};"></i>
                </div>
                <div class="theme-text">
                  <span class="theme-name">{theme.label}</span>
                </div>
                {#if documentStore.settings.codeTheme === theme.id}
                  <Check size={14} class="check-icon" />
                {/if}
              </button>
            {/each}

            <!-- Enlace a GitHub en Móvil dentro de Más Herramientas -->
            <div class="menu-divider mobile-github-divider"></div>
            <a
              href="https://github.com/SamaelEND/markdown-studio"
              target="_blank"
              rel="noopener noreferrer"
              class="menu-action-btn github-menu-option"
              onclick={() => (moreMenuOpen = false)}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 98 96"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
                />
              </svg>
              <span>Ir al repositorio (GitHub)</span>
            </a>
          </div>
        {/if}
      </div>

      <!-- Botón de Exportar (Estilo verde de la Imagen 1, con opción de URL en pie de página del PDF siempre disponible) -->
      <div class="export-menu-wrap">
        <button
          type="button"
          class="btn-export"
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
          <span class="btn-export-label">Exportar</span>
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

            <!-- URL en pie de página del PDF: siempre presente al desplegar Exportar -->
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
                <Link size={14} />
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
  </div>

  <!-- FILA 2: Atajos Rápidos de Formato Markdown (Oculto en Modo Preview) -->
  {#if currentViewMode !== "preview"}
    <div class="toolbar-format-row" role="toolbar" aria-label="Atajos de formato">
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
  {/if}
</header>

<style>
  .studio-toolbar {
    position: relative;
    background-color: var(--bg-surface, #1a1b1d);
    border-bottom: 1px solid var(--border-color, #2b2d31);
    display: flex;
    flex-direction: column;
    user-select: none;
    z-index: 50;
  }

  /* FILA 1: Principal */
  .toolbar-main-row {
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.35rem 0.75rem;
    gap: 0.6rem;
  }

  /* Izquierda: Botón Sidebar + Título Solo Lectura */
  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    min-width: 0;
    flex: 0 1 auto;
  }

  .icon-sidebar-toggle {
    width: 32px;
    height: 32px;
    padding: 0;
    color: var(--text-secondary, #94a3b8);
    border-radius: 6px;
    background: transparent;
    border: 1px solid transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .icon-sidebar-toggle:hover {
    color: #ffffff;
    background-color: var(--bg-hover, #282c34);
    border-color: var(--border-color, #2b2d31);
  }

  .title-readonly-wrap {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    max-width: 220px;
    line-height: 1.25;
  }

  .readonly-doc-name {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--text-primary, #f8fafc);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .readonly-sync-status {
    font-size: 10.5px;
    color: var(--text-secondary, #64748b);
  }

  /* Derecha */
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex: 0 0 auto;
    margin-left: auto;
  }

  /* Segmented Control para Modos de Vista */
  .segmented-control {
    display: flex;
    align-items: center;
    background-color: var(--bg-elevated, #24272c);
    border: 1px solid var(--border-color, #2b3038);
    border-radius: 6px;
    padding: 2px;
    gap: 2px;
    flex-shrink: 0;
  }

  .seg-btn {
    border: none;
    background: transparent;
    color: var(--text-secondary, #94a3b8);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.785rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .seg-btn:hover {
    color: var(--text-primary, #ffffff);
  }

  .seg-btn.active {
    background-color: var(--bg-surface, #181a1d);
    color: var(--accent-color, #5fb3a3);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  }

  /* Botones base de Toolbar */
  .toolbar-btn {
    border: 1px solid transparent;
    background-color: transparent;
    color: var(--text-secondary, #94a3b8);
    height: 32px;
    padding: 0 8px;
    border-radius: 6px;
    font-size: 0.825rem;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    transition: all 0.12s ease;
    white-space: nowrap;
    text-decoration: none;
  }

  .toolbar-btn:hover {
    background-color: var(--bg-hover, #282c34);
    color: var(--text-primary, #ffffff);
  }

  .toolbar-btn.icon-only {
    width: 32px;
    padding: 0;
  }

  .toolbar-btn.active {
    background-color: var(--bg-elevated, #262a30);
    color: var(--accent-color, #5fb3a3);
    border-color: var(--border-color, #2b2d31);
  }

  .sync-pill-text {
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    padding: 2px 4px;
    border-radius: 3px;
    background: rgba(95, 179, 163, 0.14);
    color: #5fb3a3;
  }

  /* Enlace GitHub en Escritorio y Tablet */
  .desktop-tablet-github {
    color: var(--text-secondary, #94a3b8);
  }

  .desktop-tablet-github:hover {
    color: #ffffff;
  }

  /* Botón de Exportar (Verde Esmeralda de Imagen 1) */
  .btn-export {
    background: #5fb3a3;
    color: #0b1513;
    font-weight: 600;
    font-size: 0.8rem;
    height: 32px;
    padding: 0 11px;
    border-radius: 6px;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    transition: all 0.15s ease;
  }

  .btn-export:hover {
    background: #50a394;
    filter: brightness(1.05);
  }

  /* FILA 2: Atajos de Formato Markdown */
  .toolbar-format-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 0.75rem 6px 0.75rem;
    border-top: 1px solid var(--border-subtle, #23272f);
    overflow-x: auto;
    scrollbar-width: none;
    animation: fadeInFormat 0.15s ease-out;
  }

  .toolbar-format-row::-webkit-scrollbar {
    display: none;
  }

  @keyframes fadeInFormat {
    from {
      opacity: 0;
      transform: translateY(-2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .format-btn {
    border: none;
    background: transparent;
    color: var(--text-secondary, #94a3b8);
    width: 30px;
    height: 30px;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.12s ease;
    flex-shrink: 0;
  }

  .format-btn:hover {
    background-color: var(--bg-hover, #282c34);
    color: var(--text-primary, #ffffff);
  }

  /* Dropdown Menús */
  .code-theme-wrap,
  .more-menu-wrap,
  .export-menu-wrap {
    position: relative;
  }

  .export-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    background-color: var(--bg-surface, #1e2229);
    border: 1px solid var(--border-color, #2b303c);
    border-radius: 10px;
    padding: 6px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
    z-index: 70;
    width: 275px;
    max-width: calc(100vw - 1.5rem);
    display: flex;
    flex-direction: column;
    gap: 2px;
    animation: menuPop 0.15s cubic-bezier(0.16, 1, 0.3, 1);
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
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint, #64748b);
    font-weight: 700;
  }

  .theme-option {
    gap: 10px;
  }

  .theme-option.selected {
    background-color: var(--bg-elevated, #282c35);
    color: var(--accent-color, #5fb3a3);
  }

  .theme-swatch {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 5px;
    border: 1px solid;
    border-radius: 5px;
    flex-shrink: 0;
  }

  .theme-swatch i {
    width: 6px;
    height: 12px;
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
    font-size: 0.8rem;
  }

  .theme-desc {
    font-size: 0.68rem;
    color: var(--text-secondary, #94a3b8);
    font-weight: 400;
    line-height: 1.3;
  }

  .menu-action-btn {
    border: none;
    background: transparent;
    color: var(--text-primary, #e2e8f0);
    padding: 7px 10px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.825rem;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    width: 100%;
    text-decoration: none;
    transition: background-color 0.12s ease;
  }

  .menu-action-btn:hover {
    background-color: var(--bg-hover, #282c35);
    color: #ffffff;
  }

  .menu-divider {
    height: 1px;
    background-color: var(--border-subtle, #2b303c);
    margin: 4px 0;
  }

  .menu-tool-toggle {
    border: none;
    background: transparent;
    color: var(--text-primary, #e2e8f0);
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
    background-color: var(--bg-hover, #282c35);
  }

  .menu-tool-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .toggle-pill {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    background-color: var(--bg-elevated, #16181d);
    color: var(--text-faint, #64748b);
    letter-spacing: 0.04em;
  }

  .toggle-pill.on {
    background-color: rgba(95, 179, 163, 0.18);
    color: var(--accent-color, #5fb3a3);
  }

  .github-menu-option {
    display: none;
  }

  .mobile-github-divider {
    display: none;
  }

  /* ==========================================================================
     MEDIA QUERIES RESPONSIVAS (Escritorio > 1024px | Tablet 641-1024px | Móvil <= 640px)
     ========================================================================== */

  /* Móvil (<= 640px):
     - Fila 1: Botón sidebar + título lectura a la izquierda;
       Derecha: Editor/Preview (sin split), Tema (Sol/Luna), Exportar, '...' (con paletas, números, sync y GitHub).
     - Minimapa y atajos en modo preview ocultos.
     - Fila 2: Atajos rápidos en scroll horizontal (solo en editor).
  */
  @media (max-width: 640px) {
    .seg-label {
      display: none;
    }

    /* Ocultar modo dividido en móvil */
    .seg-btn-split {
      display: none !important;
    }

    /* Ocultar herramientas directas de desktop/tablet */
    .desktop-sync-btn,
    .desktop-theme-btn,
    .desktop-linenum-btn,
    .desktop-minimap-btn,
    .desktop-tablet-github {
      display: none !important;
    }

    .more-tools-btn {
      display: inline-flex !important;
    }

    /* Mostrar enlace a GitHub en el menú móvil */
    .github-menu-option {
      display: flex !important;
    }

    .mobile-github-divider {
      display: block !important;
    }

    .btn-export-label {
      display: none;
    }

    .btn-export {
      padding: 0 8px;
    }

    .title-readonly-wrap {
      max-width: 130px;
    }

    .export-menu {
      right: -6px;
    }
  }

  /* Tablets (641px - 1024px):
     - Fila 1: Botón sidebar + título lectura a la izquierda;
       Derecha: Editor/Dividido/Lectura (solo iconos), SYNC, Tema, GitHub, '...', Exportar.
     - Fila 2: Atajos rápidos como en la Imagen 1 (oculto en preview).
  */
  @media (min-width: 641px) and (max-width: 1024px) {
    .seg-label {
      display: none;
    }

    .desktop-theme-btn,
    .desktop-linenum-btn {
      display: none !important;
    }

    .desktop-tablet-github {
      display: inline-flex !important;
    }

    .more-tools-btn {
      display: inline-flex !important;
    }

    .mobile-only-toggle {
      display: flex;
    }

    .title-readonly-wrap {
      max-width: 200px;
    }
  }

  /* Escritorio (> 1024px):
     - Fila 1: Todo completo con etiquetas de vista ("Editor", "Dividido", "Lectura"),
       SYNC, Números de línea, Minimapa, Paleta, Sol/Luna, GitHub, Exportar.
     - Menú '...' se oculta porque todas las herramientas están visibles directamente.
  */
  @media (min-width: 1025px) {
    .more-tools-btn {
      display: none !important;
    }

    .desktop-sync-btn,
    .desktop-theme-btn,
    .desktop-linenum-btn,
    .desktop-minimap-btn,
    .desktop-tablet-github {
      display: inline-flex !important;
    }

    .title-readonly-wrap {
      max-width: 280px;
    }
  }
</style>
