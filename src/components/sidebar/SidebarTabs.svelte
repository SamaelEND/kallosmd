<script lang="ts">
  /**
   * Pestañas de navegación estilo cápsula para conmutar entre Archivos e Índice (TOC).
   */
  import { AlignLeft, Folder } from "lucide-svelte";

  export type SidebarTab = "docs" | "toc";

  interface Props {
    activeTab: SidebarTab;
    docsCount: number;
    tocCount: number;
    onSelectTab: (tab: SidebarTab) => void;
  }

  let { activeTab, docsCount, tocCount, onSelectTab }: Props = $props();
</script>

<div class="tabs-bar" role="tablist">
  <button
    type="button"
    class="tab-pill"
    class:active={activeTab === "docs"}
    onclick={() => onSelectTab("docs")}
    role="tab"
    aria-selected={activeTab === "docs"}
  >
    <Folder size={14} class="tab-icon" />
    <span>Archivos</span>
    <span class="pill-badge">{docsCount}</span>
  </button>

  <button
    type="button"
    class="tab-pill"
    class:active={activeTab === "toc"}
    onclick={() => onSelectTab("toc")}
    role="tab"
    aria-selected={activeTab === "toc"}
  >
    <AlignLeft size={14} class="tab-icon" />
    <span>Índice</span>
    {#if tocCount > 0}
      <span class="pill-badge">{tocCount}</span>
    {/if}
  </button>
</div>

<style>
  .tabs-bar {
    display: flex;
    padding: 3px;
    margin: 0 14px 12px 14px;
    background: var(--bg-input, #181b20);
    border-radius: 9px;
    border: 1px solid var(--border-color, #262a33);
    min-width: 262px;
  }

  .tab-pill {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 5px 10px;
    background: transparent;
    border: none;
    border-radius: 7px;
    font-size: var(--ui-font-sm, 0.75rem);
    font-weight: 500;
    color: var(--text-secondary, #94a3b8);
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
  }

  .tab-pill:hover {
    color: var(--text-primary, #f1f5f9);
  }

  .tab-pill.active {
    background: var(--bg-hover, #282c35);
    color: var(--text-primary, #f1f5f9);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }

  :global(.tab-icon) {
    flex-shrink: 0;
    opacity: 0.9;
  }

  .pill-badge {
    font-size: var(--ui-font-2xs, 0.65625rem);
    font-weight: 600;
    padding: 0 5px;
    border-radius: 10px;
    background: var(--bg-elevated, #20232a);
    color: var(--text-secondary, #94a3b8);
  }

  .tab-pill.active .pill-badge {
    background: var(--accent-soft, rgba(95, 179, 163, 0.16));
    color: var(--accent-color, #5fb3a3);
  }
</style>
