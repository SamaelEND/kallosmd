<script lang="ts">
  /** ES: Árbol nativo de carga por carpeta, con renombrado, movimiento y borrado en disco protegidos.
   * EN: Native tree loaded per directory, with protected disk renaming, moving, and deletion. */
  import { onMount, tick } from "svelte";
  import {
    ChevronDown,
    ChevronRight,
    FileText,
    Folder,
    FolderPlus,
    FolderSync,
    Pencil,
    Trash2,
  } from "lucide-svelte";
  import type { WorkspaceEntry } from "../../../core/storage/workspacePort";
  import { workspaceStore } from "../workspaceStore.svelte";
  import { vaultStore } from "../vaultStore.svelte";
  import { getDraftKey } from "../../../core/storage/documentRecords";
  import { i18n } from "../../../shared/i18n/i18n.svelte";
  import { confirmStore } from "../../../shared/ui/confirmStore.svelte";
  import Button from "../../../shared/ui/Button.svelte";
  import InlineRenameInput from "../../../shared/ui/InlineRenameInput.svelte";
  import NewWorkspaceFolder from "./NewWorkspaceFolder.svelte";
  import WorkspaceMoveModal from "./WorkspaceMoveModal.svelte";

  let { onOpen }: { onOpen?: () => void } = $props();
  let children = $state<Record<string, WorkspaceEntry[]>>({});
  let expanded = $state<Record<string, boolean>>({});
  let loading = $state<Record<string, boolean>>({});
  let error = $state(false);
  let creationPath = $state<string | null>(null);
  let creationTrigger: HTMLElement | null = null;
  let editingPath = $state<string | null>(null);
  let movingEntry = $state<WorkspaceEntry | null>(null);
  const t = $derived(i18n.current.workspace);

  // ES: Tras crear una subcarpeta, revela su ruta sin abrir ningún documento.
  // EN: After creating a subfolder, reveal its path without opening any document.
  onMount(() => {
    const parts = workspaceStore.createdFolder.split("/");
    void (async () => {
      for (let i = 1; i < parts.length; i++) await toggle(parts.slice(0, i).join("/"));
    })();
  });

  const allDirectories = $derived.by(() => {
    const list = [""];
    for (const entry of workspaceStore.entries) {
      if (entry.kind === "directory") list.push(entry.path);
    }
    for (const subEntries of Object.values(children)) {
      for (const entry of subEntries) {
        if (entry.kind === "directory" && !list.includes(entry.path)) list.push(entry.path);
      }
    }
    return list;
  });

  function startCreation(path: string, event: MouseEvent): void {
    creationTrigger = event.currentTarget as HTMLElement;
    workspaceStore.error = null;
    creationPath = path;
  }

  async function closeCreation(): Promise<void> {
    creationPath = null;
    await tick();
    if (creationTrigger?.isConnected) creationTrigger.focus();
    else document.querySelector<HTMLButtonElement>(".native-new-folder button")?.focus();
  }

  async function toggle(path: string): Promise<void> {
    if (loading[path]) return;
    if (expanded[path]) { expanded[path] = false; return; }
    loading[path] = true;
    error = false;
    try {
      children[path] = await workspaceStore.list(path);
      expanded[path] = true;
    } catch {
      error = true;
    } finally {
      loading[path] = false;
    }
  }

  async function open(path: string): Promise<void> {
    await workspaceStore.openFile(path);
    if (!workspaceStore.error) onOpen?.();
  }

  function selected(path: string): boolean {
    return !!workspaceStore.current && vaultStore.activeId === getDraftKey({
      kind: "file", workspaceId: workspaceStore.current.id, path,
    });
  }

  async function commitRename(entry: WorkspaceEntry, newName: string): Promise<void> {
    if (editingPath !== entry.path) return;
    if (newName === entry.name) {
      editingPath = null;
      return;
    }
    const ok = await workspaceStore.renameEntry(entry.path, newName);
    if (ok) editingPath = null;
  }

  async function confirmDelete(entry: WorkspaceEntry): Promise<void> {
    const confirmed = await confirmStore.ask({
      title: t.confirmDeleteTitle,
      message: i18n.interpolate(t.confirmDeleteMessage, { name: entry.name }),
      confirmLabel: t.confirmDeleteBtn,
      cancelLabel: i18n.current.dialogs.cancel,
      tone: "danger",
    });
    if (!confirmed) return;
    await workspaceStore.deleteEntry(entry.path);
  }
</script>

{#snippet branch(entries: WorkspaceEntry[], depth: number)}
  <ul>
    {#each entries as entry (entry.path)}
      <li>
        {#if entry.kind === "directory"}
          <div class="row">
            {#if editingPath === entry.path}
              <div class="inline-edit-box" style:padding-left={`${8 + depth * 14}px`}>
                <InlineRenameInput
                  value={entry.name}
                  ariaLabel={t.rename}
                  onCommit={(val) => void commitRename(entry, val)}
                  onCancel={() => { editingPath = null; }}
                />
              </div>
            {:else}
              <button
                type="button"
                class="entry"
                style:padding-left={`${8 + depth * 14}px`}
                aria-expanded={!!expanded[entry.path]}
                aria-busy={!!loading[entry.path]}
                disabled={workspaceStore.busy}
                onclick={() => toggle(entry.path)}
                title={entry.name}
              >
                {#if expanded[entry.path]}<ChevronDown size={14} />{:else}<ChevronRight size={14} />{/if}
                <Folder size={14} />
                <span>{entry.name}</span>
              </button>
              <div class="actions">
                <Button
                  size="icon-xs"
                  disabled={workspaceStore.busy || creationPath !== null}
                  ariaLabel={i18n.interpolate(t.newSubfolder, { name: entry.name })}
                  title={i18n.interpolate(t.newSubfolder, { name: entry.name })}
                  onclick={(event) => startCreation(entry.path, event)}
                >
                  <FolderPlus size={13} />
                </Button>
                <Button
                  size="icon-xs"
                  disabled={workspaceStore.busy}
                  ariaLabel={t.rename}
                  title={t.rename}
                  onclick={() => { editingPath = entry.path; }}
                >
                  <Pencil size={12} />
                </Button>
                <Button
                  size="icon-xs"
                  disabled={workspaceStore.busy}
                  ariaLabel={t.move}
                  title={t.move}
                  onclick={() => { movingEntry = entry; }}
                >
                  <FolderSync size={12} />
                </Button>
                <Button
                  size="icon-xs"
                  disabled={workspaceStore.busy}
                  ariaLabel={t.delete}
                  title={t.delete}
                  onclick={() => void confirmDelete(entry)}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            {/if}
          </div>
          {#if loading[entry.path]}<p role="status">{t.loading}</p>{/if}
          {#if expanded[entry.path]}
            {@render branch(children[entry.path] ?? [], depth + 1)}
          {/if}
        {:else}
          <div class="row">
            {#if editingPath === entry.path}
              <div class="inline-edit-box" style:padding-left={`${24 + depth * 14}px`}>
                <InlineRenameInput
                  value={entry.name}
                  ariaLabel={t.rename}
                  onCommit={(val) => void commitRename(entry, val)}
                  onCancel={() => { editingPath = null; }}
                />
              </div>
            {:else}
              <button
                type="button"
                class="entry"
                class:active={selected(entry.path)}
                style:padding-left={`${24 + depth * 14}px`}
                aria-current={selected(entry.path) ? "page" : undefined}
                disabled={workspaceStore.busy || !/\.(md|markdown|txt)$/i.test(entry.name)}
                title={/\.(md|markdown|txt)$/i.test(entry.name) ? entry.name : t.resource}
                onclick={() => open(entry.path)}
              >
                <FileText size={14} />
                <span>{entry.name}</span>
              </button>
              <div class="actions">
                <Button
                  size="icon-xs"
                  disabled={workspaceStore.busy}
                  ariaLabel={t.rename}
                  title={t.rename}
                  onclick={() => { editingPath = entry.path; }}
                >
                  <Pencil size={12} />
                </Button>
                <Button
                  size="icon-xs"
                  disabled={workspaceStore.busy}
                  ariaLabel={t.move}
                  title={t.move}
                  onclick={() => { movingEntry = entry; }}
                >
                  <FolderSync size={12} />
                </Button>
                <Button
                  size="icon-xs"
                  disabled={workspaceStore.busy}
                  ariaLabel={t.delete}
                  title={t.delete}
                  onclick={() => void confirmDelete(entry)}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            {/if}
          </div>
        {/if}
      </li>
    {:else}
      <li class="empty">{t.empty}</li>
    {/each}
  </ul>
{/snippet}

<nav class="native-tree" aria-label={workspaceStore.current?.name}>
  <div class="native-new-folder">
    <Button
      size="sm"
      fullWidth
      disabled={workspaceStore.busy || creationPath !== null}
      onclick={(event) => startCreation("", event)}
    >
      <FolderPlus size={14} />
      <span>{t.newFolder}</span>
    </Button>
  </div>
  {#if creationPath !== null}
    <NewWorkspaceFolder parentPath={creationPath} onClose={() => void closeCreation()} />
  {/if}
  {#if movingEntry !== null}
    <WorkspaceMoveModal
      entry={movingEntry}
      availableDirectories={allDirectories}
      onClose={() => { movingEntry = null; }}
    />
  {/if}
  {@render branch(workspaceStore.entries, 0)}
</nav>
{#if error}<p role="status">{t.read}</p>{/if}

<style>
  .native-tree { max-height: 34vh; overflow: auto; }
  ul { list-style: none; padding: 0; margin: 0; }
  .row { display: flex; align-items: center; position: relative; }
  .row .entry { flex: 1; min-width: 0; }
  .row .actions {
    display: none;
    align-items: center;
    gap: 2px;
    padding-right: 4px;
    flex-shrink: 0;
  }
  .row:hover .actions,
  .row:focus-within .actions {
    display: flex;
  }
  @media (hover: none) { .row .actions { display: flex; } }
  .inline-edit-box {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    padding-right: 8px;
    min-height: 34px;
  }
  .entry {
    display: flex;
    gap: 6px;
    align-items: center;
    width: 100%;
    min-height: 34px;
    padding: 6px 8px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--text-secondary);
    font: inherit;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
  }
  .entry span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .entry :global(svg) { flex-shrink: 0; }
  .entry.active { background: var(--bg-hover); color: var(--text-primary); }
  .entry:disabled { opacity: .55; cursor: default; }
  .entry:focus-visible { outline: 2px solid var(--accent-color, #3b82f6); outline-offset: -2px; }
  .empty, p { color: var(--text-faint); font-size: 12px; padding: 4px 12px; }
  @media (hover: hover) { .entry:hover:enabled { background: var(--bg-hover); } }
</style>
