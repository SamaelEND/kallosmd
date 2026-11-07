<script lang="ts">
  /**
   * Panel de Tabla de Contenidos (TOC) que muestra los encabezados del documento activo.
   */
  import { FileText } from "lucide-svelte";
  import { i18n } from "../../../shared/i18n/i18n.svelte";
  import type { TocHeading } from "../../../core/types";

  interface Props {
    headings: TocHeading[];
    onSelectHeading: (heading: TocHeading) => void;
  }

  let { headings, onSelectHeading }: Props = $props();

  const t = $derived(i18n.current);
</script>

<div class="sidebar-section toc-section">
  {#if headings.length === 0}
    <div class="empty-toc">
      <FileText size={28} class="empty-icon" />
      <p class="empty-title">{t.toc.emptyTitle}</p>
      <p class="empty-desc">
        {t.toc.emptyDesc}
      </p>
    </div>
  {:else}
    <nav class="toc-list" aria-label={t.toc.navAria}>
      {#each headings as heading}
        <button
          type="button"
          class="toc-item level-{heading.level}"
          onclick={() => onSelectHeading(heading)}
          title={heading.text}
        >
          <span class="toc-bullet">•</span>
          <span class="toc-text">{heading.text}</span>
        </button>
      {/each}
    </nav>
  {/if}
</div>

<style>
  .sidebar-section {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    min-width: 290px;
  }

  .toc-section {
    padding: 8px 14px;
    overflow-y: auto;
  }

  .empty-toc {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 16px;
    text-align: center;
    color: var(--text-faint, #64748b);
  }

  :global(.empty-icon) {
    margin-bottom: 8px;
    opacity: 0.4;
  }

  .empty-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary, #94a3b8);
    margin: 0 0 4px 0;
  }

  .empty-desc {
    font-size: 11.5px;
    line-height: 1.4;
    margin: 0;
  }

  .toc-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .toc-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border: none;
    background: transparent;
    border-radius: 4px;
    color: var(--text-secondary, #94a3b8);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    transition: all 0.12s ease;
    font-family: inherit;
  }

  .toc-item:hover {
    background: var(--bg-hover, #282c35);
    color: var(--text-primary, #f1f5f9);
  }

  .toc-item.level-1 {
    font-weight: 600;
  }

  .toc-item.level-2 {
    padding-left: 16px;
    font-size: 11.5px;
  }

  .toc-item.level-3 {
    padding-left: 24px;
    font-size: 11px;
    color: var(--text-faint, #64748b);
  }

  .toc-item.level-4,
  .toc-item.level-5,
  .toc-item.level-6 {
    padding-left: 32px;
    font-size: 10.5px;
    color: var(--text-faint, #64748b);
  }

  .toc-bullet {
    font-size: 12px;
    opacity: 0.5;
  }

  .toc-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
