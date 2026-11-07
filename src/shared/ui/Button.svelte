<script lang="ts">
  /**
   * Componente Button compartido y reutilizable para toda la aplicación.
   * Unifica las variantes visuales de botones (toolbar, sidebar, menús, acciones rápidas y formato)
   * y se adapta dinámicamente al tema claro y oscuro.
   */
  import type { Snippet } from "svelte";

  export type ButtonVariant =
    | "ghost"
    | "primary"
    | "accent"
    | "secondary"
    | "format"
    | "danger"
    | "menu-item";

  export type ButtonSize =
    | "xs"
    | "sm"
    | "md"
    | "lg"
    | "icon-xs"
    | "icon-sm"
    | "icon"
    | "icon-lg";

  interface Props {
    variant?: ButtonVariant;
    size?: ButtonSize;
    active?: boolean;
    fullWidth?: boolean;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
    href?: string;
    target?: string;
    rel?: string;
    title?: string;
    ariaLabel?: string;
    ariaHaspopup?:
      | boolean
      | "true"
      | "menu"
      | "listbox"
      | "tree"
      | "grid"
      | "dialog";
    ariaExpanded?: boolean;
    ariaPressed?: boolean;
    role?: string;
    tabindex?: number;
    class?: string;
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
  }

  let {
    variant = "ghost",
    size = "md",
    active = false,
    fullWidth = false,
    disabled = false,
    type = "button",
    href,
    target,
    rel,
    title,
    ariaLabel,
    ariaHaspopup,
    ariaExpanded,
    ariaPressed,
    role,
    tabindex,
    class: customClass = "",
    onclick,
    children,
  }: Props = $props();
</script>

{#if href}
  <a
    {href}
    {target}
    {rel}
    {title}
    aria-label={ariaLabel}
    {role}
    {tabindex}
    class="ui-btn variant-{variant} size-{size} {customClass}"
    class:active
    class:full-width={fullWidth}
    {onclick}
  >
    {@render children?.()}
  </a>
{:else}
  <button
    {type}
    {disabled}
    {title}
    aria-label={ariaLabel}
    aria-haspopup={ariaHaspopup}
    aria-expanded={ariaExpanded}
    aria-pressed={ariaPressed}
    {role}
    {tabindex}
    class="ui-btn variant-{variant} size-{size} {customClass}"
    class:active
    class:full-width={fullWidth}
    {onclick}
  >
    {@render children?.()}
  </button>
{/if}

<style>
  .ui-btn {
    border: 1px solid transparent;
    background-color: transparent;
    color: var(--text-secondary, #94a3b8);
    font-family: inherit;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    transition: all 0.14s ease;
    white-space: nowrap;
    text-decoration: none;
    flex-shrink: 0;
    user-select: none;
  }

  .ui-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  .ui-btn.full-width {
    width: 100%;
  }

  /* === TAMAÑOS === */
  .size-xs {
    height: 24px;
    padding: 0 7px;
    font-size: var(--ui-font-xs, 0.6875rem);
    border-radius: 4px;
  }

  .size-sm {
    height: 28px;
    padding: 0 8px;
    font-size: var(--ui-font-sm, 0.75rem);
    border-radius: 6px;
  }

  .size-md {
    height: 30px;
    padding: 0 10px;
    font-size: var(--ui-font-sm, 0.75rem);
    border-radius: 6px;
  }

  .size-lg {
    height: 34px;
    padding: 0 12px;
    font-size: var(--ui-font-sm, 0.75rem);
    border-radius: 7px;
  }

  .size-icon-xs {
    width: 22px;
    height: 22px;
    padding: 0;
    border-radius: 4px;
  }

  .size-icon-sm {
    width: 28px;
    height: 28px;
    padding: 0;
    border-radius: 6px;
  }

  .size-icon {
    width: 30px;
    height: 30px;
    padding: 0;
    border-radius: 6px;
  }

  .size-icon-lg {
    width: 34px;
    height: 34px;
    padding: 0;
    border-radius: 7px;
  }

  /* === VARIANTES === */

  /* 1. Ghost (Toolbar, Sidebar header, iconos de acción) */
  .variant-ghost:hover {
    background-color: var(--bg-hover, #282c35);
    color: var(--text-primary, #f1f5f9);
  }

  .variant-ghost.active {
    background-color: var(--accent-soft, rgba(95, 179, 163, 0.16));
    color: var(--accent-color, #5fb3a3);
    border-color: var(--accent-color, #5fb3a3);
  }

  /* 2. Primary (Azul principal: Nuevo documento) */
  .variant-primary {
    background: #3b82f6;
    color: #ffffff;
    font-weight: 600;
    border: none;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  }

  .variant-primary:hover {
    background: #2563eb;
    color: #ffffff;
  }

  /* 3. Accent (Verde esmeralda: Exportar) */
  .variant-accent {
    background: var(--accent-color, #5fb3a3);
    color: var(--accent-ink, #0b1513);
    font-weight: 600;
    font-size: var(--ui-font-sm, 0.75rem);
    border: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .variant-accent:hover,
  .variant-accent.active {
    background: var(--accent-hover, #50a394);
    color: var(--accent-ink, #0b1513);
  }

  /* 4. Secondary (Cuadrados elevados: Nueva carpeta, Subir archivo) */
  .variant-secondary {
    background-color: var(--bg-elevated, #20232a);
    border: 1px solid var(--border-color, #262a33);
    color: var(--text-secondary, #94a3b8);
  }

  .variant-secondary:hover {
    background-color: var(--bg-hover, #282c35);
    border-color: var(--text-faint, #64748b);
    color: var(--text-primary, #f1f5f9);
  }

  /* 5. Format (Atajos rápidos de formato Markdown) */
  .variant-format {
    width: 30px;
    height: 30px;
    padding: 0;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: var(--text-secondary, #94a3b8);
  }

  .variant-format:hover {
    background-color: var(--bg-hover, #282c35);
    color: var(--text-primary, #f1f5f9);
  }

  /* 6. Danger (Acciones destructivas: Eliminar, Vaciar todo) */
  .variant-danger {
    background: transparent;
    border: none;
    color: var(--text-faint, #64748b);
  }

  .variant-danger:hover {
    background: rgba(239, 68, 68, 0.16);
    color: var(--danger-color, #ef4444);
  }

  /* 7. Menu Item (Opciones dentro de Dropdowns) */
  .variant-menu-item {
    justify-content: flex-start;
    width: 100%;
    padding: 6px 10px;
    height: auto;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--text-primary, #f1f5f9);
    font-size: var(--ui-font-sm, 0.75rem);
    gap: 10px;
    text-align: left;
  }

  .variant-menu-item:hover {
    background-color: var(--bg-hover, #282c35);
    color: var(--text-primary, #f1f5f9);
  }

  .variant-menu-item.active {
    background-color: var(--bg-elevated, #20232a);
    color: var(--accent-color, #5fb3a3);
  }
</style>
