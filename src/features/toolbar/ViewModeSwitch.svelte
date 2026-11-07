<script lang="ts">
  /**
   * Selector segmentado de modo de vista (Live, Editor, Dividido, Lectura).
   */
  import { Code, Columns2, Eye, Sparkles } from "lucide-svelte";
  import { i18n } from "../../shared/i18n/i18n.svelte";
  import type { ViewMode } from "../../core/types";

  interface Props {
    currentViewMode: ViewMode;
    onSelectMode: (mode: ViewMode) => void;
  }

  let { currentViewMode, onSelectMode }: Props = $props();

  const t = $derived(i18n.current);
</script>

<div class="segmented-control" role="group" aria-label={t.toolbar.viewModeAria}>
  <button
    type="button"
    class="seg-btn"
    class:active={currentViewMode === "live"}
    onclick={() => onSelectMode("live")}
    title={t.toolbar.liveTitle}
  >
    <Sparkles size={14} />
    <span class="seg-label">{t.toolbar.live}</span>
  </button>

  <button
    type="button"
    class="seg-btn"
    class:active={currentViewMode === "editor"}
    onclick={() => onSelectMode("editor")}
    title={t.toolbar.editorTitle}
  >
    <Code size={14} />
    <span class="seg-label">{t.toolbar.editor}</span>
  </button>

  <button
    type="button"
    class="seg-btn seg-btn-split"
    class:active={currentViewMode === "split"}
    onclick={() => onSelectMode("split")}
    title={t.toolbar.splitTitle}
  >
    <Columns2 size={14} />
    <span class="seg-label">{t.toolbar.split}</span>
  </button>

  <button
    type="button"
    class="seg-btn"
    class:active={currentViewMode === "preview"}
    onclick={() => onSelectMode("preview")}
    title={t.toolbar.previewTitle}
  >
    <Eye size={14} />
    <span class="seg-label">{t.toolbar.preview}</span>
  </button>
</div>

<style>
  .segmented-control {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    align-items: center;
    background-color: var(--bg-elevated, #24272c);
    border: 1px solid var(--border-color, #2b3038);
    border-radius: 7px;
    padding: 3px;
    gap: 3px;
    width: 100%;
  }

  .seg-btn {
    border: none;
    background: transparent;
    color: var(--text-secondary, #94a3b8);
    padding: 6px 6px;
    border-radius: 5px;
    font-size: 0.72rem;
    font-weight: 500;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    cursor: pointer;
    transition: all 0.12s ease;
    font-family: inherit;
    min-width: 0;
  }

  .seg-btn:hover {
    color: var(--text-primary, #ffffff);
    background-color: rgba(255, 255, 255, 0.03);
  }

  .seg-btn.active {
    background-color: var(--bg-surface, #181a1d);
    color: var(--accent-color, #5fb3a3);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  }

  .seg-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  @media (max-width: 640px) {
    .segmented-control {
      grid-template-columns: repeat(3, 1fr);
    }

    .seg-btn-split {
      display: none !important;
    }
  }
</style>
