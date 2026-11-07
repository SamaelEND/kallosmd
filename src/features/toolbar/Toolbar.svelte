<script lang="ts">
  /**
   * Componente orquestador Toolbar de Markdown Studio.
   * Coordina la fila principal de herramientas, los menús desplegables ('...' y Exportar) y la barra de formato Markdown.
   */
  import { Moon, PanelLeft, Sun } from "lucide-svelte";
  import { downloadTextFile } from "../preview/export/htmlExport";
  import { documentStore } from "../vault/vaultStore.svelte";
  import { i18n } from "../../shared/i18n/i18n.svelte";
  import type { CodeThemeId, ViewMode } from "../../core/types";
  import Button from "../../shared/ui/Button.svelte";
  import ExportMenu from "./ExportMenu.svelte";
  import FormatShortcutsBar from "./FormatShortcutsBar.svelte";
  import MoreToolsMenu from "./MoreToolsMenu.svelte";

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
  let moreMenuOpen = $state(false);

  const t = $derived(i18n.current);
  const activeDoc = $derived(documentStore.activeDocument);
  const activeDocTitle = $derived(activeDoc?.title || "documento.md");
  const currentViewMode = $derived(documentStore.settings.viewMode);

  $effect(() => {
    if (
      typeof window !== "undefined" &&
      window.innerWidth <= 640 &&
      documentStore.settings.viewMode === "split"
    ) {
      documentStore.setViewMode("live");
    }
  });

  function setView(mode: ViewMode): void {
    documentStore.setViewMode(mode);
  }

  function setCodeTheme(id: CodeThemeId): void {
    documentStore.updateSettings({ codeTheme: id });
  }

  function exportMarkdown(): void {
    if (!activeDoc) return;
    downloadTextFile(activeDoc.title, activeDoc.content, "text/markdown");
  }

  function handleWindowClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest(".export-menu-wrap")) exportMenuOpen = false;
    if (!target.closest(".more-menu-wrap")) moreMenuOpen = false;
  }
</script>

<svelte:window onclick={handleWindowClick} />

<header class="studio-toolbar no-print">
  <div class="toolbar-main-row">
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

    <div class="toolbar-right">
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

      <MoreToolsMenu
        isOpen={moreMenuOpen}
        {currentViewMode}
        syncScroll={documentStore.settings.syncScroll}
        lineNumbers={documentStore.settings.lineNumbers}
        minimap={documentStore.settings.minimap}
        codeTheme={documentStore.settings.codeTheme}
        isDark={documentStore.isDark}
        githubUrl={GITHUB_REPO_URL}
        onToggleOpen={(e) => {
          e.stopPropagation();
          exportMenuOpen = false;
          moreMenuOpen = !moreMenuOpen;
        }}
        onSelectViewMode={setView}
        onToggleSyncScroll={() => {
          if (currentViewMode !== "split") return;
          documentStore.updateSettings({
            syncScroll: !documentStore.settings.syncScroll,
          });
        }}
        onToggleLineNumbers={() =>
          documentStore.updateSettings({
            lineNumbers: !documentStore.settings.lineNumbers,
          })}
        onToggleMinimap={() =>
          documentStore.updateSettings({
            minimap: !documentStore.settings.minimap,
          })}
        onSelectCodeTheme={setCodeTheme}
        onClose={() => (moreMenuOpen = false)}
      />

      <ExportMenu
        isOpen={exportMenuOpen}
        includePdfUrl={Boolean(documentStore.settings.includePdfUrl)}
        onToggleOpen={(e) => {
          e.stopPropagation();
          moreMenuOpen = false;
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
    max-width: 320px;
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

  @media (max-width: 640px) {
    .title-readonly-wrap {
      max-width: 160px;
    }
  }
</style>
