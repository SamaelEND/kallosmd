<script lang="ts">
  /**
   * ES: Modal de confirmación accesible (alertdialog): foco inicial en Cancelar, Esc cancela, Tab atrapado, foco devuelto al cerrar.
   * EN: Accessible confirmation modal (alertdialog): initial focus on Cancel, Esc cancels, Tab trapped, focus restored on close.
   */
  import { tick } from "svelte";
  import { confirmStore } from "./confirmStore.svelte";

  const dialog = $derived(confirmStore.current);
  let cancelBtn = $state<HTMLButtonElement | null>(null);
  let confirmBtn = $state<HTMLButtonElement | null>(null);
  let previousFocus: HTMLElement | null = null;

  // ES: Al abrir guarda el foco previo y enfoca Cancelar (acción segura); al cerrar lo restaura.
  // EN: On open stores previous focus and focuses Cancel (safe action); restores it on close.
  $effect(() => {
    if (!dialog) return;
    previousFocus = document.activeElement as HTMLElement | null;
    tick().then(() => cancelBtn?.focus());
    return () => {
      previousFocus?.focus?.();
      previousFocus = null;
    };
  });

  // ES: Captura teclas en fase de captura para que ningún atajo global ni el editor las reciba mientras el modal está abierto.
  // EN: Captures keys in the capture phase so no global shortcut or editor receives them while the modal is open.
  $effect(() => {
    if (!dialog) return;

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        confirmStore.settle(false);
      } else if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        const next = document.activeElement === cancelBtn ? confirmBtn : cancelBtn;
        next?.focus();
      } else if (e.key !== "Enter") {
        // ES: Enter activa el botón enfocado de forma nativa; el resto se bloquea.
        // EN: Enter natively activates the focused button; everything else is blocked.
        e.stopPropagation();
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  });
</script>

{#if dialog}
  <div class="confirm-backdrop" onclick={() => confirmStore.settle(false)} role="presentation">
    <div
      class="confirm-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <h2 id="confirm-title" class="confirm-title">{dialog.title}</h2>
      <p id="confirm-message" class="confirm-message">{dialog.message}</p>
      <div class="confirm-actions">
        <button
          type="button"
          class="confirm-btn"
          bind:this={cancelBtn}
          onclick={() => confirmStore.settle(false)}
        >
          {dialog.cancelLabel}
        </button>
        <button
          type="button"
          class="confirm-btn confirm-primary"
          class:danger={dialog.tone !== "default"}
          bind:this={confirmBtn}
          onclick={() => confirmStore.settle(true)}
        >
          {dialog.confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .confirm-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(8, 10, 14, 0.5);
    animation: confirm-fade 150ms ease-out;
  }

  .confirm-dialog {
    width: min(400px, 100%);
    padding: 20px;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    background: var(--bg-elevated);
    color: var(--text-primary);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
    outline: none;
    /* ES: Entra desde scale(0.96), nunca desde 0. EN: Enters from scale(0.96), never from 0. */
    animation: confirm-pop 180ms cubic-bezier(0.23, 1, 0.32, 1);
  }

  .confirm-title {
    margin: 0 0 8px;
    font-size: 1rem;
    font-weight: 600;
  }

  .confirm-message {
    margin: 0 0 20px;
    font-size: var(--ui-font-md);
    line-height: 1.5;
    color: var(--text-secondary);
    white-space: pre-line;
    overflow-wrap: anywhere;
  }

  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .confirm-btn {
    padding: 7px 14px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-hover);
    color: var(--text-primary);
    font: inherit;
    font-size: var(--ui-font-md);
    cursor: pointer;
    transition:
      transform 120ms ease-out,
      background-color 120ms ease-out;
  }

  .confirm-btn:active {
    transform: scale(0.97);
  }

  .confirm-btn:focus-visible {
    outline: 2px solid var(--accent-color);
    outline-offset: 2px;
  }

  .confirm-primary {
    border-color: transparent;
    background: var(--accent-color);
    color: var(--accent-ink);
  }

  .confirm-primary.danger {
    background: var(--danger-color);
    color: #fff;
  }

  .confirm-primary.danger:focus-visible {
    outline-color: var(--danger-color);
  }

  @keyframes confirm-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes confirm-pop {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .confirm-backdrop,
    .confirm-dialog { animation: none; }
    .confirm-btn { transition: none; }
  }
</style>
