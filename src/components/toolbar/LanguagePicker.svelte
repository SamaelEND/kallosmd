<script lang="ts">
  /**
   * Componente selector de idioma (ES / EN) para la barra de herramientas.
   */
  import { Check, Languages } from "lucide-svelte";
  import { i18n } from "../../stores/i18n.svelte";
  import Button from "../ui/Button.svelte";
  import DropdownMenu from "../ui/DropdownMenu.svelte";

  interface Props {
    isOpen: boolean;
    onToggleOpen: (e: MouseEvent) => void;
    onSelectLocale: (localeId: "es" | "en") => void;
  }

  let { isOpen, onToggleOpen, onSelectLocale }: Props = $props();

  const currentLocale = $derived(i18n.locale);
  const t = $derived(i18n.current);
</script>

<div class="lang-picker-wrap">
  <Button
    variant="ghost"
    size="icon"
    active={isOpen}
    class="lang-toggle-btn"
    onclick={onToggleOpen}
    title={t.toolbar.languageTitle}
    ariaLabel={t.toolbar.language}
    ariaHaspopup="true"
    ariaExpanded={isOpen}
  >
    <Languages size={17} />
    <span class="lang-badge-indicator">{currentLocale.toUpperCase()}</span>
  </Button>

  {#if isOpen}
    <DropdownMenu>
      <div class="lang-menu-header">
        <span class="lang-menu-title">{t.toolbar.language}</span>
      </div>

      {#each i18n.supportedLocales as opt (opt.id)}
        <button
          type="button"
          class="lang-option-btn"
          class:active={currentLocale === opt.id}
          onclick={() => onSelectLocale(opt.id)}
          role="menuitem"
        >
          <div class="lang-label-group">
            <span class="lang-flag-pill">{opt.flag}</span>
            <span class="lang-text-label">{opt.label}</span>
          </div>
          {#if currentLocale === opt.id}
            <Check size={14} class="lang-check-icon" />
          {/if}
        </button>
      {/each}
    </DropdownMenu>
  {/if}
</div>

<style>
  .lang-picker-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  :global(.lang-toggle-btn) {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 0 6px !important;
    width: auto !important;
    min-width: 32px;
  }

  .lang-badge-indicator {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--text-secondary, #94a3b8);
    line-height: 1;
  }

  :global(.lang-toggle-btn.active) .lang-badge-indicator,
  :global(.lang-toggle-btn:hover) .lang-badge-indicator {
    color: var(--text-primary, #ffffff);
  }

  .lang-menu-header {
    padding: 6px 10px 4px 10px;
    border-bottom: 1px solid var(--border-subtle, #2b303c);
    margin-bottom: 4px;
  }

  .lang-menu-title {
    font-size: var(--ui-font-2xs, 0.6875rem);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted, #7e828d);
  }

  .lang-option-btn {
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
    text-align: left;
  }

  .lang-option-btn:hover {
    background-color: var(--bg-hover, #282c35);
    color: var(--text-primary, #ffffff);
  }

  .lang-option-btn.active {
    background-color: var(--bg-surface, #20242c);
    color: var(--accent-color, #5fb3a3);
    font-weight: 600;
  }

  .lang-label-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .lang-flag-pill {
    font-size: 0.625rem;
    font-weight: 800;
    background: var(--bg-elevated, #292d36);
    color: var(--text-secondary, #94a3b8);
    padding: 1px 5px;
    border-radius: 4px;
    letter-spacing: 0.05em;
  }

  .lang-option-btn.active .lang-flag-pill {
    background: rgba(95, 179, 163, 0.2);
    color: var(--accent-color, #5fb3a3);
  }

  :global(.lang-check-icon) {
    color: var(--accent-color, #5fb3a3);
    flex-shrink: 0;
  }
</style>

