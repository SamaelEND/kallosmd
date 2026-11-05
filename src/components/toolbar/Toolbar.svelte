<script lang="ts">
  /**
   * Componente orquestador Toolbar de Markdown Studio.
   * Coordina la fila principal de herramientas, los menús desplegables y la barra de formato Markdown.
   */
  import {
    ListOrdered,
    Map,
    Moon,
    Palette,
    PanelLeft,
    Sun,
  } from "lucide-svelte";
  import { downloadTextFile } from "../../lib/htmlExport";
  import { documentStore } from "../../stores/documents.svelte";
  import { i18n } from "../../stores/i18n.svelte";
  import type { CodeThemeId, ViewMode } from "../../types";
  import Button from "../ui/Button.svelte";
  import DropdownMenu from "../ui/DropdownMenu.svelte";
  import GithubIcon from "../ui/GithubIcon.svelte";
  import CodeThemePicker from "./CodeThemePicker.svelte";
  import ExportMenu from "./ExportMenu.svelte";
  import FormatShortcutsBar from "./FormatShortcutsBar.svelte";
  import LanguagePicker from "./LanguagePicker.svelte";
  import MoreToolsMenu from "./MoreToolsMenu.svelte";
  import ViewModeSwitch from "./ViewModeSwitch.svelte";

  const GITHUB_REPO_URL = "https://github.com/SamaelEND/markdown-studio";

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
  let langPickerOpen = $state(false);

  const t = $derived(i18n.current);
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
    downloadTextFile(activeDoc.title, activeDoc.content, "text/markdown");
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
    if (!target.closest(".lang-picker-wrap")) {
      langPickerOpen = false;
    }
  }}
/>

<header class="studio-toolbar no-print">
  <div class="toolbar-main-row">
    <!-- Grupo Izquierdo: Botón Sidebar + Título de documento activo -->
    <div class="toolbar-left">
      <Button
        variant="ghost"
        size="icon"
        active={sidebarOpen}
        onclick={onToggleSidebar}
        title={t.toolbar.sidebarToggle}
        ariaLabel={t.toolbar.sidebarToggleAria}
      >
        <PanelLeft size={18} />
      </Button>

      <div class="title-readonly-wrap">
        <span class="readonly-doc-name" title={activeDocTitle}>
          {activeDocTitle}
        </span>
        <span class="readonly-sync-status">{t.toolbar.syncStatus}</span>
      </div>
    </div>

    <!-- Grupo Derecho: Modos de vista, opciones de editor, tema, GitHub y exportación -->
    <div class="toolbar-right">
      <ViewModeSwitch {currentViewMode} onSelectMode={setView} />

      <!-- Scroll Sincronizado (Visible en Desktop y Tablet con estado activo/inactivo evidente) -->
      <button
        type="button"
        class="sync-toggle-btn desktop-sync-btn"
        class:active={documentStore.settings.syncScroll}
        onclick={() =>
          documentStore.updateSettings({
            syncScroll: !documentStore.settings.syncScroll,
          })}
        title={documentStore.settings.syncScroll
          ? t.toolbar.syncScrollActive
          : t.toolbar.syncScrollInactive}
        aria-pressed={documentStore.settings.syncScroll}
        aria-label={t.toolbar.syncScrollAria}
      >
        <span class="sync-status-dot" aria-hidden="true"></span>
        <span class="sync-pill-text">SYNC</span>
      </button>

      <!-- Selector de Paletas de Código (Directo en Escritorio) -->
      <div class="code-theme-wrap desktop-theme-btn">
        <Button
          variant="ghost"
          size="icon"
          active={codeThemeOpen}
          onclick={(e) => {
            e.stopPropagation();
            codeThemeOpen = !codeThemeOpen;
          }}
          title={t.toolbar.codePaletteTitle}
          ariaHaspopup="true"
          ariaExpanded={codeThemeOpen}
        >
          <Palette size={16} />
        </Button>

        {#if codeThemeOpen}
          <DropdownMenu>
            <CodeThemePicker
              selectedTheme={documentStore.settings.codeTheme}
              isDark={documentStore.isDark}
              showDescription={true}
              onSelect={setCodeTheme}
            />
          </DropdownMenu>
        {/if}
      </div>

      <!-- Números de Línea (Escritorio) -->
      <Button
        variant="ghost"
        size="icon"
        active={documentStore.settings.lineNumbers}
        class="desktop-linenum-btn"
        onclick={() =>
          documentStore.updateSettings({
            lineNumbers: !documentStore.settings.lineNumbers,
          })}
        title={documentStore.settings.lineNumbers
          ? t.toolbar.lineNumbersActive
          : t.toolbar.lineNumbersInactive}
        ariaLabel={t.toolbar.lineNumbersAria}
      >
        <ListOrdered size={16} />
      </Button>

      <!-- Minimapa (Escritorio y Tablet; oculto en modo Preview) -->
      {#if currentViewMode !== "preview"}
        <Button
          variant="ghost"
          size="icon"
          active={documentStore.settings.minimap}
          class="desktop-minimap-btn"
          onclick={() =>
            documentStore.updateSettings({
              minimap: !documentStore.settings.minimap,
            })}
          title={documentStore.settings.minimap
            ? i18n.locale === "es"
              ? "Ocultar minimapa"
              : "Hide minimap"
            : i18n.locale === "es"
              ? "Mostrar minimapa"
              : "Show minimap"}
          ariaLabel="Minimapa"
        >
          <Map size={16} />
        </Button>
      {/if}

      <!-- Cambio de Tema Claro / Oscuro -->
      <Button
        variant="ghost"
        size="icon"
        onclick={() => documentStore.toggleTheme()}
        title={documentStore.isDark
          ? t.toolbar.themeDark
          : t.toolbar.themeLight}
        ariaLabel={t.toolbar.themeAria}
      >
        {#if documentStore.isDark}
          <Moon size={16} />
        {:else}
          <Sun size={16} />
        {/if}
      </Button>

      <!-- Selector de Idioma ES / EN (Desktop) -->
      <div class="desktop-lang-picker">
        <LanguagePicker
          isOpen={langPickerOpen}
          onToggleOpen={(e) => {
            e.stopPropagation();
            langPickerOpen = !langPickerOpen;
          }}
          onSelectLocale={(loc) => {
            i18n.setLocale(loc);
            langPickerOpen = false;
          }}
        />
      </div>

      <!-- Enlace a GitHub (Escritorio y Tablet) -->
      <Button
        variant="ghost"
        size="icon"
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        class="desktop-tablet-github"
        title={t.toolbar.githubTitle}
        ariaLabel={t.toolbar.githubAria}
      >
        <GithubIcon size={16} />
      </Button>

      <!-- Menú de 3 Puntos ('...') para Tablet y Móvil -->
      <MoreToolsMenu
        isOpen={moreMenuOpen}
        syncScroll={documentStore.settings.syncScroll}
        lineNumbers={documentStore.settings.lineNumbers}
        codeTheme={documentStore.settings.codeTheme}
        isDark={documentStore.isDark}
        githubUrl={GITHUB_REPO_URL}
        onToggleOpen={(e) => {
          e.stopPropagation();
          moreMenuOpen = !moreMenuOpen;
        }}
        onToggleSyncScroll={() =>
          documentStore.updateSettings({
            syncScroll: !documentStore.settings.syncScroll,
          })}
        onToggleLineNumbers={() =>
          documentStore.updateSettings({
            lineNumbers: !documentStore.settings.lineNumbers,
          })}
        onSelectCodeTheme={setCodeTheme}
        onClose={() => (moreMenuOpen = false)}
      />

      <!-- Botón y Menú de Exportar -->
      <ExportMenu
        isOpen={exportMenuOpen}
        includePdfUrl={Boolean(documentStore.settings.includePdfUrl)}
        onToggleOpen={(e) => {
          e.stopPropagation();
          exportMenuOpen = !exportMenuOpen;
        }}
        onExportMarkdown={() => {
          exportMenuOpen = false;
          exportMarkdown();
        }}
        onExportPdf={() => {
          exportMenuOpen = false;
          onExportPdf?.();
        }}
        onExportHtml={() => {
          exportMenuOpen = false;
          onExportHtml?.();
        }}
        onTogglePdfUrl={() =>
          documentStore.updateSettings({
            includePdfUrl: !documentStore.settings.includePdfUrl,
          })}
      />
    </div>
  </div>

  <!-- FILA 2: Atajos Rápidos de Formato Markdown -->
  {#if currentViewMode !== "preview"}
    <FormatShortcutsBar {onInsertSnippet} />
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

  .toolbar-main-row {
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.35rem 0.75rem;
    gap: 0.6rem;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    min-width: 0;
    flex: 0 1 auto;
  }

  .title-readonly-wrap {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    max-width: 280px;
    line-height: 1.25;
  }

  .readonly-doc-name {
    font-size: var(--ui-font-md, 0.8125rem);
    font-weight: 600;
    color: var(--text-primary, #f8fafc);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .readonly-sync-status {
    font-size: var(--ui-font-2xs, 0.65625rem);
    color: var(--text-secondary, #64748b);
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex: 0 0 auto;
    margin-left: auto;
  }

  .code-theme-wrap {
    position: relative;
  }

  .sync-toggle-btn {
    height: 30px;
    padding: 0 8px;
    border-radius: 6px;
    border: 1px solid var(--border-color, #262a33);
    background-color: transparent;
    color: var(--text-faint, #64748b);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    cursor: pointer;
    transition: all 0.14s ease;
    font-family: inherit;
    user-select: none;
  }

  .sync-toggle-btn:hover {
    background-color: var(--bg-hover, #282c35);
    color: var(--text-primary, #f1f5f9);
  }

  .sync-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--text-faint, #64748b);
    opacity: 0.45;
    transition: all 0.15s ease;
  }

  .sync-pill-text {
    font-size: var(--ui-font-2xs, 0.65625rem);
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .sync-toggle-btn.active {
    background-color: var(--accent-soft, rgba(95, 179, 163, 0.16));
    border-color: var(--accent-color, #5fb3a3);
    color: var(--accent-color, #5fb3a3);
  }

  .sync-toggle-btn.active .sync-status-dot {
    background-color: var(--accent-color, #5fb3a3);
    opacity: 1;
    box-shadow: 0 0 6px var(--accent-color, #5fb3a3);
  }

  @media (max-width: 640px) {
    .desktop-sync-btn,
    .desktop-theme-btn,
    .desktop-lang-picker,
    .toolbar-right :global(.desktop-linenum-btn),
    .toolbar-right :global(.desktop-minimap-btn),
    .toolbar-right :global(.desktop-tablet-github) {
      display: none !important;
    }

    .title-readonly-wrap {
      max-width: 130px;
    }
  }

  @media (min-width: 641px) and (max-width: 1024px) {
    .desktop-theme-btn,
    .toolbar-right :global(.desktop-linenum-btn) {
      display: none !important;
    }

    .title-readonly-wrap {
      max-width: 200px;
    }
  }
</style>
