<script lang="ts">
  /**
   * Menú desplegable de 3 puntos horizontales ('...') ubicado junto a Exportar.
   * Agrupa los modos de vista (Live, Editor, Split, Preview) y las herramientas secundarias
   * tanto en escritorio como en móvil.
   */
  import { Languages, MoreHorizontal } from "lucide-svelte";
  import { i18n } from "../../shared/i18n/i18n.svelte";
  import type { CodeThemeId, ViewMode } from "../../core/types";
  import Button from "../../shared/ui/Button.svelte";
  import DropdownMenu from "../../shared/ui/DropdownMenu.svelte";
  import ToggleSwitchItem from "../../shared/ui/ToggleSwitchItem.svelte";
  import GithubIcon from "../../shared/ui/GithubIcon.svelte";
  import CodeThemePicker from "./CodeThemePicker.svelte";
  import ViewModeSwitch from "./ViewModeSwitch.svelte";

  interface Props {
    isOpen: boolean;
    currentViewMode: ViewMode;
    syncScroll: boolean;
    lineNumbers: boolean;
    minimap: boolean;
    codeTheme: CodeThemeId;
    isDark: boolean;
    githubUrl: string;
    onToggleOpen: (e: MouseEvent) => void;
    onSelectViewMode: (mode: ViewMode) => void;
    onToggleSyncScroll: () => void;
    onToggleLineNumbers: () => void;
    onToggleMinimap: () => void;
    onSelectCodeTheme: (id: CodeThemeId) => void;
    onClose: () => void;
  }

  let {
    isOpen,
    currentViewMode,
    syncScroll,
    lineNumbers,
    minimap,
    codeTheme,
    isDark,
    githubUrl,
    onToggleOpen,
    onSelectViewMode,
    onToggleSyncScroll,
    onToggleLineNumbers,
    onToggleMinimap,
    onSelectCodeTheme,
    onClose,
  }: Props = $props();

  const t = $derived(i18n.current);
  const isSplitMode = $derived(currentViewMode === "split");
</script>

<div class="more-menu-wrap">
  <Button
    variant="ghost"
    size="icon"
    active={isOpen}
    class="more-tools-btn"
    onclick={onToggleOpen}
    title={t.toolbar.moreToolsTitle}
    ariaHaspopup="true"
    ariaExpanded={isOpen}
  >
    <MoreHorizontal size={18} />
  </Button>

  {#if isOpen}
    <DropdownMenu>
      <span class="menu-title">{t.moreTools.viewModeLabel}</span>
      <div class="view-mode-box">
        <ViewModeSwitch
          {currentViewMode}
          onSelectMode={(mode) => {
            onSelectViewMode(mode);
          }}
        />
      </div>

      <div class="menu-divider"></div>

      <span class="menu-title">{t.moreTools.title}</span>

      <ToggleSwitchItem
        label={t.moreTools.syncScroll}
        checked={isSplitMode && syncScroll}
        disabled={!isSplitMode}
        title={isSplitMode
          ? syncScroll
            ? t.toolbar.syncScrollActive
            : t.toolbar.syncScrollInactive
          : t.moreTools.syncScrollSplitOnly}
        onToggle={onToggleSyncScroll}
      />

      <ToggleSwitchItem
        label={t.moreTools.lineNumbers}
        checked={lineNumbers}
        onToggle={onToggleLineNumbers}
      />

      <ToggleSwitchItem
        label={t.moreTools.minimap}
        checked={minimap}
        class="desktop-only-minimap-item"
        onToggle={onToggleMinimap}
      />

      <div class="menu-divider"></div>

      <button
        type="button"
        class="menu-lang-toggle-btn"
        onclick={() => i18n.toggleLocale()}
      >
        <div class="menu-lang-left">
          <Languages size={15} />
          <span>{t.moreTools.language}</span>
        </div>
        <span class="menu-lang-current">{i18n.locale.toUpperCase()}</span>
      </button>

      <div class="menu-divider"></div>

      <CodeThemePicker
        selectedTheme={codeTheme}
        {isDark}
        showDescription={false}
        title={t.moreTools.codePalette}
        onSelect={onSelectCodeTheme}
      />

      <div class="menu-divider"></div>

      <Button
        variant="menu-item"
        href={githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="github-menu-option"
        onclick={onClose}
      >
        <GithubIcon size={15} />
        <span>{t.moreTools.goToGithub}</span>
      </Button>
    </DropdownMenu>
  {/if}
</div>

<style>
  .more-menu-wrap {
    position: relative;
  }

  .view-mode-box {
    padding: 2px 6px 4px;
  }

  .menu-title {
    padding: 4px 10px 4px;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint, #64748b);
    font-weight: 700;
  }

  .menu-divider {
    height: 1px;
    background-color: var(--border-subtle, #2b303c);
    margin: 4px 0;
  }

  .menu-lang-toggle-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 10px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    font-size: var(--ui-font-sm, 0.8125rem);
    color: var(--text-secondary, #9b9a94);
    transition: all 0.12s ease;
  }

  .menu-lang-toggle-btn:hover {
    background-color: var(--bg-hover, #282c35);
    color: var(--text-primary, #ffffff);
  }

  .menu-lang-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .menu-lang-current {
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--bg-elevated, #292d36);
    color: var(--accent-color, #5fb3a3);
  }

  @media (max-width: 768px) {
    .more-menu-wrap :global(.desktop-only-minimap-item) {
      display: none !important;
    }
  }
</style>
