<script lang="ts">
  /**
   * Componente DropdownMenu compartido.
   * Panel flotante reutilizable para menús desplegables de configuración, exportación y acciones.
   */
  import type { Snippet } from "svelte";

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: customClass = "", children }: Props = $props();
</script>

<div class="dropdown-panel {customClass}" role="menu" tabindex="-1">
  {@render children?.()}
</div>

<style>
  .dropdown-panel {
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

  @media (max-width: 640px) {
    .dropdown-panel {
      right: -6px;
    }
  }
</style>
