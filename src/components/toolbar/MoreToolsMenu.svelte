<script lang="ts">
  /**
   * Menú desplegable de 3 puntos horizontales ('...') para Tablet y Móvil.
   * Agrupa las herramientas secundarias (SYNC, Números de línea, Paleta de código, Idioma y GitHub en móvil).
   */
  import { Languages, MoreHorizontal } from "lucide-svelte";
  import { i18n } from "../../stores/i18n.svelte";
  import type { CodeThemeId } from "../../types";
  import Button from "../ui/Button.svelte";
  import DropdownMenu from "../ui/DropdownMenu.svelte";
  import ToggleSwitchItem from "../ui/ToggleSwitchItem.svelte";
  import GithubIcon from "../ui/GithubIcon.svelte";
  import CodeThemePicker from "./CodeThemePicker.svelte";

  interface Props {
    isOpen: boolean;
    syncScroll: boolean;
    lineNumbers: boolean;
    codeTheme: CodeThemeId;
    isDark: boolean;
    githubUrl: string;
    onToggleOpen: (e: MouseEvent) => void;
    onToggleSyncScroll: () => void;
    onToggleLineNumbers: () => void;
    onSelectCodeTheme: (id: CodeThemeId) => void;
    onClose: () => void;
  }

  let {
    isOpen,
    syncScroll,
    lineNumbers,
    codeTheme,
    isDark,
    githubUrl,
    onToggleOpen,
    onToggleSyncScroll,
    onToggleLineNumbers,
    onSelectCodeTheme,
    onClose,
  }: Props = $props();

  const t = $derived(i18n.current);
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
      <span class="menu-title">{t.moreTools.title}</span>

      <ToggleSwitchItem
        label={t.moreTools.syncScroll}
        checked={syncScroll}
        onToggle={onToggleSyncScroll}
      />

      <ToggleSwitchItem
        label={t.moreTools.lineNumbers}
        checked={lineNumbers}
        onToggle={onToggleLineNumbers}
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

      <div class="menu-divider mobile-github-divider"></div>

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

  .menu-title {
    padding: 4px 10px 6px;
    font-size: 0.7rem;
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

  .more-menu-wrap :global(.github-menu-option) {
    display: none;
  }

  .mobile-github-divider {
    display: none;
  }

  @media (max-width: 640px) {
    .more-menu-wrap :global(.github-menu-option) {
      display: flex !important;
    }

    .mobile-github-divider {
      display: block !important;
    }
  }

  @media (min-width: 1025px) {
    .more-menu-wrap :global(.more-tools-btn) {
      display: none !important;
    }
  }
</style>
