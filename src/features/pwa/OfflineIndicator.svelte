<script lang="ts">
  /**
   * ES: Indicador accesible de preparación sin conexión y actualización disponible de la PWA.
   * EN: Accessible indicator for offline readiness and PWA update availability.
   */
  import { CheckCircle2, RefreshCw, AlertCircle, Loader2 } from "lucide-svelte";
  import { i18n } from "../../shared/i18n/i18n.svelte";
  import { pwaStore } from "./pwaStore.svelte";

  const t = $derived(i18n.current.pwa);
  const status = $derived(pwaStore.status);
  const updateAvailable = $derived(pwaStore.updateAvailable);
</script>

<div class="pwa-indicator-root">
  {#if updateAvailable}
    <button
      type="button"
      class="pwa-badge pwa-btn-update"
      onclick={() => void pwaStore.applyUpdate()}
      title={t.updatePrompt}
      aria-label="{t.updateAvailable}: {t.updateAction}"
    >
      <RefreshCw size={12} class="pwa-icon" />
      <span>{t.updateAvailable}</span>
    </button>
  {:else if status === "ready"}
    <span
      class="pwa-badge pwa-ready"
      title={t.ready}
      aria-label={t.ready}
      role="status"
    >
      <CheckCircle2 size={12} class="pwa-icon" />
      <span>{t.readyShort}</span>
    </span>
  {:else if status === "installing"}
    <span
      class="pwa-badge pwa-installing"
      title={t.installing}
      aria-live="polite"
      role="status"
    >
      <Loader2 size={12} class="pwa-icon pwa-spin" />
      <span>{t.installing}</span>
    </span>
  {:else if status === "error"}
    <span
      class="pwa-badge pwa-error"
      title={t.error}
      aria-label={t.error}
      role="status"
    >
      <AlertCircle size={12} class="pwa-icon" />
      <span>{t.error}</span>
    </span>
  {/if}
</div>

<style>
  .pwa-indicator-root {
    display: inline-flex;
    align-items: center;
  }

  .pwa-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--ui-font-xs, 0.6875rem);
    padding: 2px 6px;
    border-radius: 4px;
    line-height: 1;
    font-weight: 500;
    user-select: none;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .pwa-ready {
    color: var(--accent-color, #5fb3a3);
    background-color: transparent;
  }

  .pwa-installing {
    color: var(--text-secondary, #9b9a94);
    background-color: transparent;
  }

  .pwa-error {
    color: var(--text-warning, #e5a158);
    background-color: transparent;
  }

  .pwa-btn-update {
    background-color: var(--accent-color, #5fb3a3);
    color: #121314;
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-weight: 600;
  }

  .pwa-btn-update:hover {
    filter: brightness(1.1);
  }

  .pwa-btn-update:focus-visible {
    outline: 2px solid var(--accent-color, #5fb3a3);
    outline-offset: 1px;
  }

  :global(.pwa-icon) {
    flex-shrink: 0;
  }

  :global(.pwa-spin) {
    animation: pwaSpin 1.2s linear infinite;
  }

  @keyframes pwaSpin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
