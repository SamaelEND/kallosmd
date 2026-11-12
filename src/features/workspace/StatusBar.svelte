<script lang="ts">
  /**
   * ES: Estadísticas del documento y estado confirmado de persistencia local.
   * EN: Document statistics and confirmed local persistence status.
   */
  import { Sparkles } from "lucide-svelte";
  import { i18n } from "../../shared/i18n/i18n.svelte";
  import { documentStore } from "../vault/vaultStore.svelte";
  import OfflineIndicator from "../pwa/OfflineIndicator.svelte";
  import type { DocumentStats } from "../../shared/utils/formatters";

  interface Props {
    stats: DocumentStats;
  }

  let { stats }: Props = $props();

  const t = $derived(i18n.current);
  const saveMode = $derived(documentStore.activeDocument
    ? documentStore.saveMode(documentStore.activeDocument.id) : "save");
</script>

<footer class="studio-statusbar no-print">
  <div class="status-left">
    <span class="editor-stats">
      {stats.lines} {t.status.lines} · {stats.words} {t.status.words} · {stats.readingTime} {t.status.readingTime}
    </span>
    {#if documentStore.persistenceState !== "idle"}
      <span class="save-toast" class:save-error={documentStore.persistenceState === "error"} role="status">
        {t.status[documentStore.persistenceState]}
      </span>
    {/if}
    {#if documentStore.fileSave.state !== "idle"}
      <span class="save-toast" class:save-error={documentStore.fileSave.state === "error" || documentStore.fileSave.state === "conflict"} role="status">
        {t.fileSave[documentStore.fileSave.state]}:
        <span class="save-name" title={documentStore.fileSave.name}>{documentStore.fileSave.name}</span>
      </span>
    {:else if saveMode === "download"}
      <span class="save-fallback">{t.fileSave.downloadHint}</span>
    {/if}
    {#if documentStore.hasUnsavedChanges}
      <span>{t.status.unsaved}</span>
    {/if}
  </div>

  <div class="status-right">
    <OfflineIndicator />
    <span class="status-tag">
      <Sparkles size={12} />
      <span>KaTeX + Mermaid</span>
    </span>
  </div>
</footer>

<style>
  .studio-statusbar {
    height: auto;
    min-height: 26px;
    background-color: var(--bg-app, #151617);
    border-top: 1px solid var(--border-color, #2b2d31);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1rem;
    font-size: var(--ui-font-xs, 0.6875rem);
    color: var(--text-secondary, #9b9a94);
    user-select: none;
    z-index: 10;
  }

  .status-left,
  .status-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .status-left {
    min-width: 0;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
  }

  .save-toast {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--accent-color, #5fb3a3);
    font-weight: 600;
  }

  .save-name {
    max-width: min(18rem, 45vw);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .save-error {
    color: var(--text-primary);
  }

  .status-tag {
    display: flex;
    align-items: center;
    gap: 4px;
    background-color: var(--bg-elevated, #26282b);
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 0.675rem;
  }

  @media (max-width: 640px) {
    .status-right {
      display: none;
    }

    .studio-statusbar {
      padding: 0 0.65rem;
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
  }
</style>
