<script lang="ts">
  /**
   * Lista reutilizable de paletas de color de código con muestras visuales (swatches).
   * Se utiliza tanto en el menú directo de escritorio como en el menú '...' de móvil/tablet.
   */
  import { Check } from "lucide-svelte";
  import { CODE_THEMES, getPalette } from "../../shared/utils/codeThemes";
  import type { CodeThemeId } from "../../core/types";

  interface Props {
    selectedTheme: CodeThemeId;
    isDark: boolean;
    showDescription?: boolean;
    title?: string;
    onSelect: (id: CodeThemeId) => void;
  }

  let {
    selectedTheme,
    isDark,
    showDescription = true,
    title = "Colores de código",
    onSelect,
  }: Props = $props();
</script>

<span class="menu-title">{title}</span>

{#each CODE_THEMES as theme (theme.id)}
  {@const palette = getPalette(theme.id, isDark)}
  <button
    type="button"
    class="theme-option"
    class:selected={selectedTheme === theme.id}
    role="menuitem"
    onclick={() => onSelect(theme.id)}
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
      {#if showDescription}
        <span class="theme-desc">{theme.description}</span>
      {/if}
    </div>
    {#if selectedTheme === theme.id}
      <Check size={14} class="check-icon" />
    {/if}
  </button>
{/each}

<style>
  .menu-title {
    padding: 4px 10px 6px;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint, #64748b);
    font-weight: 700;
  }

  .theme-option {
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
    transition: background-color 0.12s ease;
    font-family: inherit;
  }

  .theme-option:hover {
    background-color: var(--bg-hover, #282c35);
    color: var(--text-primary, #f1f5f9);
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
</style>
