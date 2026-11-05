<script lang="ts">
  /**
   * Componente DropOverlay de MD Studio.
   * Proporciona respuesta visual en pantalla completa al arrastrar archivos Markdown.
   */
  import { FileUp } from "lucide-svelte";

  interface Props {
    visible: boolean;
  }

  let { visible = false }: Props = $props();
</script>

{#if visible}
  <div class="drop-zone-overlay no-print" aria-hidden="true">
    <div class="drop-message-card">
      <FileUp size={44} class="drop-icon" />
      <p class="drop-title">
        Suelta tu archivo <strong>.md</strong> para abrirlo
      </p>
      <span class="drop-hint">Formatos compatibles: .md, .markdown, .txt</span>
    </div>
  </div>
{/if}

<style>
  .drop-zone-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background-color: rgba(21, 22, 23, 0.85);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    animation: fadeIn 0.15s ease-out;
  }

  .drop-message-card {
    padding: 2.5rem 3.5rem;
    border: 2px dashed var(--accent-color, #5fb3a3);
    background-color: var(--bg-surface, #1a1b1d);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.85rem;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    color: var(--text-primary, #e8e6e1);
  }

  :global(.drop-icon) {
    color: var(--accent-color, #5fb3a3);
    animation: bounce 1.2s infinite ease-in-out;
  }

  .drop-title {
    font-size: 1.15rem;
    margin: 0;
  }

  .drop-hint {
    font-size: 0.8rem;
    color: var(--text-secondary, #9b9a94);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes bounce {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-8px);
    }
  }
</style>

