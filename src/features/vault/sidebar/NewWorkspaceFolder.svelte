<script lang="ts">
  /** ES: Un nombre explícito y una ubicación fija; solo Enviar escribe en el disco.
   * EN: An explicit name and a fixed location; only Submit writes to disk. */
  import { onMount } from "svelte";
  import Button from "../../../shared/ui/Button.svelte";
  import { i18n } from "../../../shared/i18n/i18n.svelte";
  import { workspaceStore } from "../workspaceStore.svelte";

  let { parentPath, onClose }: { parentPath: string; onClose: () => void } = $props();
  let name = $state("");
  let input: HTMLInputElement;
  const t = $derived(i18n.current.workspace);
  const location = $derived(`${workspaceStore.current?.name ?? ""}/${parentPath}`);

  onMount(() => input.focus());

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (await workspaceStore.createFolder(parentPath, name)) onClose();
  }

  function keydown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.isComposing) return;
    if ((event.ctrlKey || event.metaKey) && ["s", "o", "p"].includes(event.key.toLowerCase())) event.preventDefault();
    if (event.key === "Escape" && !workspaceStore.busy) {
      event.preventDefault();
      onClose();
    }
  }
</script>

<form class="new-workspace-folder" onsubmit={submit} aria-label={t.newFolder}>
  <p>{i18n.interpolate(t.createLocation, { path: location })}</p>
  <label for="workspace-folder-name">{t.folderName}</label>
  <input id="workspace-folder-name" type="text" bind:this={input} bind:value={name}
    required maxlength="255" autocomplete="off" spellcheck="false" disabled={workspaceStore.busy}
    aria-invalid={workspaceStore.error === "invalidName" || workspaceStore.error === "collision"}
    onkeydown={keydown} />
  <div class="actions">
    <Button size="sm" disabled={workspaceStore.busy} onclick={onClose}>{i18n.current.dialogs.cancel}</Button>
    <Button type="submit" size="sm" variant="secondary" disabled={workspaceStore.busy || !name}>{t.create}</Button>
  </div>
</form>

<style>
  form { margin: 6px 0; padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; }
  p { margin: 0 0 6px; color: var(--text-secondary); font-size: 12px; overflow-wrap: anywhere; }
  label { display: block; font-size: 12px; margin-bottom: 4px; color: var(--text-primary); }
  input { width: 100%; box-sizing: border-box; min-width: 0; padding: 6px;
    font: inherit; font-size: 16px; color: var(--text-primary); background: var(--bg-input);
    border: 1px solid var(--border-color); border-radius: 4px; }
  input:focus-visible { outline: 2px solid var(--accent-color, #3b82f6); outline-offset: 1px; }
  .actions { display: flex; justify-content: flex-end; gap: 4px; margin-top: 8px; }
</style>
