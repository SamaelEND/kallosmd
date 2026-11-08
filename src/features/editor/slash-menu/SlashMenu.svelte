<script lang="ts">
  /**
   * ES: Menú flotante contextual que se despliega al pulsar "/" en el editor con indicación de atajos de teclado.
   * EN: Floating contextual menu displayed when typing "/" in editor with keyboard shortcut indicators.
   */
  import type { EditorCommand } from "../shortcuts/editorCommands";
  import { slashMenuStore } from "./slashMenuStore.svelte";
  import { i18n } from "../../../shared/i18n/i18n.svelte";

  let menuContainer = $state<HTMLDivElement | null>(null);

  const isOpen = $derived(slashMenuStore.isOpen);
  const commands = $derived(slashMenuStore.filteredCommands);
  const selectedIndex = $derived(slashMenuStore.selectedIndex);
  const coords = $derived(slashMenuStore.coords);
  const t = $derived(i18n.current);

  // ES: Calcula la posición óptima del menú dentro de los límites visibles de la ventana.
  // EN: Computes optimal menu position within visible window boundaries.
  const positionStyle = $derived.by(() => {
    if (!isOpen || typeof window === "undefined") return "display: none;";

    const menuWidth = 320;
    const menuHeight = 280;
    const padding = 12;

    let left = coords.left;
    if (left + menuWidth > window.innerWidth - padding) {
      left = Math.max(padding, window.innerWidth - menuWidth - padding);
    }

    let top = coords.bottom + 6;
    if (top + menuHeight > window.innerHeight - padding) {
      // ES: Si no cabe hacia abajo, lo mostramos arriba del cursor.
      // EN: If it overflows downwards, show it above the cursor.
      top = Math.max(padding, coords.top - menuHeight - 6);
    }

    return `top: ${Math.round(top)}px; left: ${Math.round(left)}px;`;
  });

  // ES: Hace scroll automático para mantener visible el elemento seleccionado con el teclado.
  // EN: Auto-scrolls to keep keyboard-selected item visible.
  $effect(() => {
    // ES: Dependencia reactiva explícita en selectedIndex para responder a las flechas arriba/abajo.
    // EN: Explicit reactive dependency on selectedIndex to respond to up/down arrow keys.
    const idx = selectedIndex;
    if (isOpen && menuContainer && idx >= 0) {
      const activeItem = menuContainer.querySelector<HTMLElement>(
        ".slash-item.selected",
      );
      if (activeItem) {
        activeItem.scrollIntoView({ block: "nearest" });
      }
    }
  });

  // ES: Cierra el menú automáticamente al hacer clic en cualquier lugar fuera de él.
  // EN: Closes the menu automatically when clicking anywhere outside of it.
  $effect(() => {
    if (!isOpen) return;

    function handleOutsideClick(e: MouseEvent): void {
      if (menuContainer && !menuContainer.contains(e.target as Node)) {
        slashMenuStore.close();
      }
    }

    window.addEventListener("pointerdown", handleOutsideClick);
    return () => {
      window.removeEventListener("pointerdown", handleOutsideClick);
    };
  });

  function handleSelect(cmd: EditorCommand): void {
    slashMenuStore.executeCommand(cmd);
  }

  function handleMouseDown(e: MouseEvent): void {
    // ES: Evita que el editor pierda foco antes de ejecutar la acción al hacer clic.
    // EN: Prevents editor from losing focus before executing action upon click.
    e.preventDefault();
  }
</script>

{#if isOpen && commands.length > 0}
  <div
    class="slash-menu-portal"
    style={positionStyle}
    bind:this={menuContainer}
    onmousedown={handleMouseDown}
    role="listbox"
    aria-label="Comandos rápidos de inserción"
    tabindex="-1"
  >
    <div class="slash-menu-header">
      <span class="slash-header-title">{t.slashMenu?.title || "Comandos"}</span>
      {#if slashMenuStore.query}
        <span class="slash-header-query">/{slashMenuStore.query}</span>
      {/if}
    </div>

    <div class="slash-items-list">
      {#each commands as cmd, index (cmd.id)}
        <button
          type="button"
          class="slash-item"
          class:selected={index === selectedIndex}
          onclick={() => handleSelect(cmd)}
          onmouseenter={() => (slashMenuStore.selectedIndex = index)}
          role="option"
          aria-selected={index === selectedIndex}
        >
          <div class="slash-item-left">
            <span class="slash-item-icon">{cmd.iconText}</span>
            <div class="slash-item-text">
              <span class="slash-item-label">{cmd.label}</span>
              <span class="slash-item-desc">{cmd.description}</span>
            </div>
          </div>

          <div class="slash-item-right">
            {#if cmd.shortcutDisplay}<kbd class="shortcut-pill">{cmd.shortcutDisplay}</kbd>{/if}
          </div>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .slash-menu-portal {
    position: fixed;
    z-index: 9999;
    width: 320px;
    max-height: 290px;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-surface, #16181d);
    border: 1px solid var(--border-color, #262a33);
    border-radius: 10px;
    box-shadow:
      0 10px 25px -5px rgba(0, 0, 0, 0.35),
      0 8px 10px -6px rgba(0, 0, 0, 0.25);
    backdrop-filter: blur(8px);
    overflow: hidden;
    user-select: none;
    font-family: inherit;
    animation: slashMenuFadeIn 0.12s ease-out;
  }

  @keyframes slashMenuFadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .slash-menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 12px;
    border-bottom: 1px solid var(--border-subtle, #212429);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary, #94a3b8);
    background-color: var(--bg-elevated, #20232a);
  }

  .slash-header-query {
    font-family: var(--font-mono, monospace);
    color: var(--accent-color, #5fb3a3);
    text-transform: none;
    font-weight: 500;
  }

  .slash-items-list {
    overflow-y: auto;
    padding: 5px;
    max-height: 245px;
    scrollbar-width: thin;
    scrollbar-color: var(--border-subtle, #212429) transparent;
  }

  .slash-items-list::-webkit-scrollbar {
    width: 5px;
  }

  .slash-items-list::-webkit-scrollbar-thumb {
    background-color: var(--border-subtle, #212429);
    border-radius: 4px;
  }

  .slash-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 6px 8px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    color: var(--text-primary, #f1f5f9);
    transition:
      background 0.08s ease,
      color 0.08s ease;
  }

  .slash-item.selected {
    background-color: var(--accent-soft, rgba(95, 179, 163, 0.16));
    color: var(--text-primary, #f1f5f9);
  }

  .slash-item-left {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  .slash-item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    min-width: 24px;
    border-radius: 5px;
    background-color: var(--bg-elevated, #20232a);
    border: 1px solid var(--border-subtle, #212429);
    font-size: 11px;
    font-weight: 700;
    font-family: var(--font-mono, monospace);
    color: var(--accent-color, #5fb3a3);
  }

  .slash-item.selected .slash-item-icon {
    background-color: var(--accent-soft, rgba(95, 179, 163, 0.25));
    border-color: var(--accent-color, #5fb3a3);
    color: var(--accent-color, #5fb3a3);
  }

  .slash-item-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .slash-item-label {
    font-size: 12.5px;
    font-weight: 600;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .slash-item-desc {
    font-size: 10.5px;
    color: var(--text-secondary, #94a3b8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .slash-item.selected .slash-item-desc {
    color: var(--text-primary, #f1f5f9);
  }

  .slash-item-right {
    margin-left: 8px;
    flex-shrink: 0;
  }

  .shortcut-pill {
    display: inline-flex;
    align-items: center;
    padding: 2px 5px;
    border-radius: 4px;
    background-color: var(--bg-elevated, #20232a);
    border: 1px solid var(--border-subtle, #212429);
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    font-weight: 500;
    color: var(--text-secondary, #94a3b8);
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .slash-item.selected .shortcut-pill {
    border-color: var(--accent-color, #5fb3a3);
    color: var(--accent-color, #5fb3a3);
  }
</style>
