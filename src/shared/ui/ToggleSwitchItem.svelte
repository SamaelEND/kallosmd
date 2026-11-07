<script lang="ts">
  /**
   * Componente ToggleSwitchItem compartido.
   * Fila interactiva de menú con indicador ON / OFF tipo pastilla claramente diferenciado.
   */
  import type { Snippet } from "svelte";

  interface Props {
    label: string;
    checked: boolean;
    disabled?: boolean;
    onToggle: () => void;
    title?: string;
    class?: string;
    icon?: Snippet;
  }

  let {
    label,
    checked = false,
    disabled = false,
    onToggle,
    title,
    class: customClass = "",
    icon,
  }: Props = $props();
</script>

<button
  type="button"
  class="menu-tool-toggle {customClass}"
  class:is-disabled={disabled}
  {disabled}
  onclick={() => {
    if (!disabled) onToggle();
  }}
  aria-pressed={checked && !disabled}
  {title}
>
  <div class="menu-tool-info">
    {#if icon}
      {@render icon()}
    {/if}
    <span>{label}</span>
  </div>
  <span class="toggle-pill" class:on={checked && !disabled}>
    <span class="pill-dot" aria-hidden="true"></span>
    {checked && !disabled ? "ON" : "OFF"}
  </span>
</button>

<style>
  .menu-tool-toggle {
    border: none;
    background: transparent;
    color: var(--text-primary, #f1f5f9);
    padding: 7px 10px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    width: 100%;
    transition: background-color 0.12s ease;
    font-family: inherit;
  }

  .menu-tool-toggle:hover:not(:disabled) {
    background-color: var(--bg-hover, #282c35);
  }

  .menu-tool-toggle.is-disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .menu-tool-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .toggle-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.65rem;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 999px;
    background-color: var(--bg-elevated, #20232a);
    border: 1px solid var(--border-color, #262a33);
    color: var(--text-faint, #64748b);
    letter-spacing: 0.04em;
    transition: all 0.15s ease;
  }

  .pill-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: var(--text-faint, #64748b);
    opacity: 0.6;
  }

  .toggle-pill.on {
    background-color: var(--accent-soft, rgba(95, 179, 163, 0.16));
    border-color: var(--accent-color, #5fb3a3);
    color: var(--accent-color, #5fb3a3);
  }

  .toggle-pill.on .pill-dot {
    background-color: var(--accent-color, #5fb3a3);
    opacity: 1;
    box-shadow: 0 0 5px var(--accent-color, #5fb3a3);
  }
</style>
