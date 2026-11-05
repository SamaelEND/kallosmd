<script lang="ts">
  /**
   * Selector segmentado de modo de vista (Editor, Dividido, Lectura).
   */
  import { Code, Columns2, Eye } from "lucide-svelte";
  import type { ViewMode } from "../../types";

  interface Props {
    currentViewMode: ViewMode;
    onSelectMode: (mode: ViewMode) => void;
  }

  let { currentViewMode, onSelectMode }: Props = $props();
</script>

<div class="segmented-control" role="group" aria-label="Modo de vista">
  <button
    type="button"
    class="seg-btn"
    class:active={currentViewMode === "editor"}
    onclick={() => onSelectMode("editor")}
    title="Solo editor de código"
  >
    <Code size={15} />
    <span class="seg-label">Editor</span>
  </button>

  <button
    type="button"
    class="seg-btn seg-btn-split"
    class:active={currentViewMode === "split"}
    onclick={() => onSelectMode("split")}
    title="Vista dividida (Editor + Vista previa)"
  >
    <Columns2 size={15} />
    <span class="seg-label">Dividido</span>
  </button>

  <button
    type="button"
    class="seg-btn"
    class:active={currentViewMode === "preview"}
    onclick={() => onSelectMode("preview")}
    title="Solo lectura y vista previa"
  >
    <Eye size={15} />
    <span class="seg-label">Lectura</span>
  </button>
</div>

<style>
  .segmented-control {
    display: flex;
    align-items: center;
    background-color: var(--bg-elevated, #24272c);
    border: 1px solid var(--border-color, #2b3038);
    border-radius: 6px;
    padding: 2px;
    gap: 2px;
    flex-shrink: 0;
  }

  .seg-btn {
    border: none;
    background: transparent;
    color: var(--text-secondary, #94a3b8);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: var(--ui-font-sm, 0.75rem);
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    transition: all 0.12s ease;
    font-family: inherit;
  }

  .seg-btn:hover {
    color: var(--text-primary, #ffffff);
  }

  .seg-btn.active {
    background-color: var(--bg-surface, #181a1d);
    color: var(--accent-color, #5fb3a3);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  }

  @media (max-width: 1024px) {
    .seg-label {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .seg-btn-split {
      display: none !important;
    }
  }
</style>
