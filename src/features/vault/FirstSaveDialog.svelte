<script lang="ts">
  /**
   * ES: Primer guardado: nombre y ubicación explícitos; el archivo nace solo al confirmar.
   * EN: First save: explicit name and location; the file is created only on confirmation.
   */
  import { tick } from "svelte";
  import { i18n } from "../../shared/i18n/i18n.svelte";
  import Button from "../../shared/ui/Button.svelte";
  import { vaultStore } from "./vaultStore.svelte";
  import { workspaceStore } from "./workspaceStore.svelte";

  const request = $derived(vaultStore.fileSave.firstSave);
  const t = $derived(i18n.current);
  const d = $derived(t.firstSave);
  let name = $state("");
  let location = $state("");
  let directories = $state<string[]>([""]);
  let loadingLocations = $state(false);
  let nameInput = $state<HTMLInputElement | null>(null);
  let dialogElement = $state<HTMLElement | null>(null);
  let previousFocus: HTMLElement | null = null;
  let loadingToken = 0;

  // ES: Al abrir sugiere un nombre, carga solo carpetas y enfoca el campo de nombre.
  // EN: On open suggests a name, loads folders only, and focuses the name field.
  $effect(() => {
    const current = request;
    if (!current) return;
    previousFocus = document.activeElement as HTMLElement | null;
    name = current.suggestedName;
    location = "";
    directories = [""];
    loadingLocations = true;
    workspaceStore.error = null;
    const token = ++loadingToken;
    void workspaceStore.directories().then(list => {
      if (token !== loadingToken) return;
      directories = list;
      loadingLocations = false;
    });
    void tick().then(() => {
      nameInput?.focus();
      nameInput?.select();
    });
    return () => {
      loadingToken++;
      previousFocus?.focus?.();
      previousFocus = null;
    };
  });

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!name.trim() || workspaceStore.busy) return;
    const target = await workspaceStore.prepareDocumentSave(location, name);
    if (target) vaultStore.fileSave.resolveFirstSave(target);
  }

  function cancel(): void {
    if (workspaceStore.busy) return;
    vaultStore.fileSave.resolveFirstSave(null);
  }

  function handleKeyDown(event: KeyboardEvent): void {
    // ES: Bloquea atajos globales mientras el diálogo tiene el foco.
    // EN: Blocks global shortcuts while the dialog owns focus.
    event.stopPropagation();
    if (event.isComposing) return;
    if (event.key === "Escape") {
      if (workspaceStore.busy) return;
      event.preventDefault();
      cancel();
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = [...(dialogElement?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ) ?? [])];
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function locationLabel(path: string): string {
    if (!path) return d.root;
    return `${request?.workspaceName ?? ""}/${path}`;
  }
</script>

{#if request}
  <div class="first-save-backdrop" role="presentation" onclick={cancel}>
    <div
      class="first-save-dialog"
      bind:this={dialogElement}
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-save-title"
      aria-describedby="first-save-message"
      tabindex="-1"
      onclick={(event) => event.stopPropagation()}
      onkeydown={handleKeyDown}
    >
      <form onsubmit={submit}>
        <h2 id="first-save-title">{d.title}</h2>
        <p id="first-save-message" class="message">
          {i18n.interpolate(d.message, { workspace: request.workspaceName })}
        </p>

        <label for="first-save-name">{d.name}</label>
        <input
          id="first-save-name"
          bind:this={nameInput}
          bind:value={name}
          type="text"
          required
          maxlength="255"
          autocomplete="off"
          spellcheck="false"
          disabled={workspaceStore.busy}
          aria-invalid={workspaceStore.error === "invalidName" || workspaceStore.error === "collision"}
        />

        <label for="first-save-location">{d.location}</label>
        <select
          id="first-save-location"
          bind:value={location}
          disabled={workspaceStore.busy || loadingLocations}
        >
          {#each directories as path (path)}
            <option value={path}>{locationLabel(path)}</option>
          {/each}
        </select>

        {#if loadingLocations}
          <p class="hint" role="status">{d.loadingLocations}</p>
        {/if}
        {#if workspaceStore.error}
          <p class="error" role="alert">{t.workspace[workspaceStore.error]}</p>
        {/if}

        <div class="actions">
          <Button size="sm" disabled={workspaceStore.busy} onclick={cancel}>
            {t.dialogs.cancel}
          </Button>
          <Button type="submit" size="sm" variant="primary" disabled={workspaceStore.busy || !name.trim()}>
            {d.confirm}
          </Button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .first-save-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(8, 10, 14, 0.5);
    animation: first-save-fade 150ms ease-out;
  }

  .first-save-dialog {
    width: min(440px, 100%);
    max-height: calc(100dvh - 32px);
    overflow: auto;
    padding: 20px;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    background: var(--bg-elevated);
    color: var(--text-primary);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
    animation: first-save-pop 180ms cubic-bezier(0.23, 1, 0.32, 1);
  }

  h2 {
    margin: 0 0 8px;
    font-size: 1rem;
    font-weight: 600;
  }

  .message {
    margin: 0 0 16px;
    font-size: var(--ui-font-md);
    line-height: 1.5;
    color: var(--text-secondary);
    overflow-wrap: anywhere;
  }

  label {
    display: block;
    margin-bottom: 4px;
    font-size: 12px;
    color: var(--text-primary);
  }

  input,
  select {
    width: 100%;
    box-sizing: border-box;
    min-width: 0;
    margin-bottom: 12px;
    padding: 7px 8px;
    /* ES: 16px evita el zoom automático en pantallas táctiles. EN: 16px avoids automatic zoom on touch screens. */
    font: inherit;
    font-size: 16px;
    color: var(--text-primary);
    background: var(--bg-input);
    border: 1px solid var(--border-color);
    border-radius: 6px;
  }

  input:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--accent-color, #3b82f6);
    outline-offset: 1px;
  }

  .hint,
  .error {
    margin: -4px 0 12px;
    font-size: 12px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .hint {
    color: var(--text-faint);
  }

  .error {
    color: var(--text-primary);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px;
  }

  @keyframes first-save-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes first-save-pop {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
  }

  @media (max-width: 480px) {
    .first-save-backdrop {
      padding: 10px;
    }

    .first-save-dialog {
      padding: 16px;
    }

    .actions :global(button) {
      flex: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .first-save-backdrop,
    .first-save-dialog {
      animation: none;
    }
  }
</style>
