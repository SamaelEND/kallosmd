<script lang="ts">
  /**
   * ES: Modal accesible para mover un archivo o carpeta en disco a otro directorio del espacio de trabajo.
   * EN: Accessible modal to move a file or folder on disk to another directory within the workspace.
   */
  import { onMount, tick } from "svelte";
  import { Folder, FolderSync, X } from "lucide-svelte";
  import type { WorkspaceEntry } from "../../../core/storage/workspacePort";
  import { workspaceStore } from "../workspaceStore.svelte";
  import { i18n } from "../../../shared/i18n/i18n.svelte";
  import Button from "../../../shared/ui/Button.svelte";

  interface Props {
    entry: WorkspaceEntry;
    availableDirectories: string[];
    onClose: () => void;
  }

  let { entry, availableDirectories, onClose }: Props = $props();
  let selectedTarget = $state<string>("");
  let closeButton: HTMLButtonElement | null = null;
  let dialog: HTMLDivElement;
  let modal: HTMLDialogElement;
  const sourceParent = $derived(entry.path.split("/").slice(0, -1).join("/"));
  const t = $derived(i18n.current.workspace);
  const cancelLabel = $derived(i18n.current.dialogs.cancel);

  // ES: Filtra para no permitir mover una carpeta dentro de sí misma o de sus subcarpetas.
  // EN: Filters out moving a directory into itself or its subdirectories.
  const validTargets = $derived(
    availableDirectories.filter((dir) => {
      if (dir === sourceParent) return false;
      if (entry.kind !== "directory") return true;
      return dir !== entry.path && !dir.startsWith(entry.path + "/");
    }),
  );

  function close(): void {
    if (!workspaceStore.busy) onClose();
  }

  onMount(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    // ES: La capa superior nativa evita que el transform del sidebar recorte el modal en móviles.
    // EN: The native top layer prevents the sidebar transform from clipping the modal on mobile.
    modal.showModal();
    let mounted = true;
    void tick().then(() => { if (mounted) closeButton?.focus(); });
    // ES: Captura antes de los atajos globales, conserva Tab dentro y activa el botón enfocado.
    // EN: Capture before global shortcuts, keep Tab inside, and activate the focused button.
    function onKeyDown(e: KeyboardEvent): void {
      e.stopImmediatePropagation();
      if (e.isComposing) return;
      if (e.key === "Escape") {
        e.preventDefault(); close();
      } else if ((e.key === "Enter" || e.key === " ") && document.activeElement instanceof HTMLButtonElement) {
        e.preventDefault();
        if (!e.repeat) document.activeElement.click();
      } else if (e.key === "Tab") {
        e.preventDefault();
        const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')];
        const index = controls.indexOf(document.activeElement as HTMLElement);
        const next = (index + (e.shiftKey ? -1 : 1) + controls.length) % controls.length;
        (controls[next] ?? dialog).focus();
      } else if ((e.ctrlKey || e.metaKey) && ["s", "o", "p"].includes(e.key.toLowerCase())) {
        e.preventDefault();
      } else if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(e.key)
        && document.activeElement?.getAttribute("role") === "radio") {
        e.preventDefault();
        const radios = [...dialog.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)')];
        const index = radios.indexOf(document.activeElement as HTMLButtonElement);
        const next = radios[(index + (["ArrowUp", "ArrowLeft"].includes(e.key) ? -1 : 1) + radios.length) % radios.length];
        next?.click(); next?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      mounted = false;
      window.removeEventListener("keydown", onKeyDown, true);
      modal.close();
      void tick().then(() => {
        if (previousFocus?.isConnected) previousFocus.focus();
        else document.querySelector<HTMLButtonElement>(".native-new-folder button")?.focus();
      });
    };
  });

  async function handleMove(): Promise<void> {
    const ok = await workspaceStore.moveEntry(entry.path, selectedTarget);
    if (ok) onClose();
    await tick();
    // ES: Si el árbol se reconstruyó, devuelve el foco cuando los controles vuelven a estar habilitados.
    // EN: If the tree was rebuilt, restore focus once its controls are enabled again.
    if (!dialog?.isConnected) document.querySelector<HTMLButtonElement>(".native-new-folder button")?.focus();
  }
</script>

<dialog class="modal-backdrop" bind:this={modal} aria-labelledby="move-title"
  onclick={(event) => { if (event.target === modal) close(); }}
  oncancel={(event) => { event.preventDefault(); close(); }}>
  <div
    class="move-dialog"
    bind:this={dialog}
    tabindex="-1"
  >
    <header class="move-header">
      <h2 id="move-title" class="move-title">
        <FolderSync size={16} />
        <span>{t.move}: {entry.name}</span>
      </h2>
      <button
        type="button"
        class="icon-btn"
        aria-label={t.close}
        bind:this={closeButton}
        onclick={close}
        disabled={workspaceStore.busy}
      >
        <X size={16} />
      </button>
    </header>

    <div class="move-body">
      <p class="section-label">{t.moveToPrompt}</p>
      <div class="targets-list" role="radiogroup" aria-label={t.moveToPrompt}>
        {#if validTargets.includes("")}
        <button
          type="button"
          disabled={workspaceStore.busy}
          class="target-item"
          class:selected={selectedTarget === ""}
          role="radio"
          aria-checked={selectedTarget === ""}
          onclick={() => { selectedTarget = ""; }}
        >
          <Folder size={14} />
          <span>{i18n.current.contextMenu.root}</span>
        </button>
        {/if}

        {#each validTargets as dir (dir)}
          {#if dir !== ""}
            <button
              type="button"
              disabled={workspaceStore.busy}
              class="target-item"
              class:selected={selectedTarget === dir}
              role="radio"
              aria-checked={selectedTarget === dir}
              onclick={() => { selectedTarget = dir; }}
            >
              <Folder size={14} />
              <span>{dir}</span>
            </button>
          {/if}
        {/each}
      </div>
    </div>

    {#if workspaceStore.error}<p role="status">{t[workspaceStore.error]}</p>{/if}
    <footer class="move-footer">
      <Button variant="ghost" size="sm" disabled={workspaceStore.busy} onclick={close}>
        {cancelLabel}
      </Button>
      <Button
        variant="primary"
        size="sm"
        disabled={workspaceStore.busy || !validTargets.includes(selectedTarget)}
        onclick={() => void handleMove()}
      >
        <FolderSync size={14} />
        <span>{t.move}</span>
      </Button>
    </footer>
  </div>
</dialog>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    margin: 0;
    border: 0;
    box-sizing: border-box;
    background: transparent;
  }
  .modal-backdrop[open] {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .modal-backdrop::backdrop { background: rgba(8, 10, 14, 0.5); }
  .move-dialog {
    width: 100%;
    max-width: 380px;
    max-height: calc(100dvh - 32px);
    background: var(--bg-primary, #111418);
    border: 1px solid var(--border-color, #23272f);
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .move-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color, #23272f);
  }
  .move-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary, #f1f5f9);
    margin: 0;
    min-width: 0;
  }
  .move-title span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .icon-btn {
    border: 0;
    background: transparent;
    color: var(--text-faint, #64748b);
    cursor: pointer;
    border-radius: 4px;
    padding: 4px;
    display: flex;
  }
  .icon-btn:hover {
    color: var(--text-primary);
  }
  .move-body {
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .section-label {
    font-size: 11px;
    color: var(--text-faint);
    margin: 0;
  }
  .targets-list {
    max-height: 180px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 4px;
  }
  .target-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--text-secondary);
    font: inherit;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
  }
  .target-item:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .target-item.selected {
    background: var(--bg-hover);
    color: var(--accent-color, #3b82f6);
    font-weight: 500;
  }
  .move-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--border-color);
  }
</style>
