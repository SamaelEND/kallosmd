<script lang="ts">
  /**
   * Barra de estado inferior del área de trabajo.
   * Muestra estadísticas en vivo (líneas, palabras, tiempo de lectura),
   * confirmación de guardado y motores activos (KaTeX + Mermaid).
   */
  import { CheckCircle2, Sparkles } from "lucide-svelte";
  import { i18n } from "../../stores/i18n.svelte";
  import type { DocumentStats } from "../../lib/utils/formatters";

  interface Props {
    stats: DocumentStats;
    saveNoticeVisible: boolean;
  }

  let { stats, saveNoticeVisible }: Props = $props();

  const t = $derived(i18n.current);
</script>

<footer class="studio-statusbar no-print">
  <div class="status-left">
    <span class="editor-stats">
      {stats.lines} {t.status.lines} · {stats.words} {t.status.words} · {stats.readingTime} {t.status.readingTime}
    </span>
    {#if saveNoticeVisible}
      <span class="save-toast">
        <CheckCircle2 size={12} />
        <span>{t.status.saved}</span>
      </span>
    {/if}
  </div>

  <div class="status-right">
    <span class="status-tag">
      <Sparkles size={12} />
      <span>KaTeX + Mermaid</span>
    </span>
  </div>
</footer>

<style>
  .studio-statusbar {
    height: 26px;
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

  .save-toast {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--accent-color, #5fb3a3);
    font-weight: 600;
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
