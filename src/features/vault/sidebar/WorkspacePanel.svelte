<script lang="ts">
  /** ES: Elección y reapertura explícitas; referencias restauradas sin abrir documentos.
   * EN: Explicit selection and reopening; references restored without opening documents. */
  import { onMount } from "svelte";
  import { FolderOpen, RefreshCw, X } from "lucide-svelte";
  import { supportsWorkspaceDirectory } from "../../../core/storage/fileSystemAdapter";
  import { workspaceStore } from "../workspaceStore.svelte";
  import { vaultStore } from "../vaultStore.svelte";
  import { i18n } from "../../../shared/i18n/i18n.svelte";
  import Button from "../../../shared/ui/Button.svelte";
  import WorkspaceTree from "./WorkspaceTree.svelte";

  let { onOpen }: { onOpen?: () => void } = $props();
  const supported = supportsWorkspaceDirectory();
  const t = $derived(i18n.current.workspace);
  const nativeDocuments = $derived(vaultStore.documents.filter(d => vaultStore.isWorkspaceDocument(d.id)));

  onMount(() => { void workspaceStore.initialize().catch(() => {}); });
</script>

<section class="workspace-panel" aria-label={t.choose}>
  {#if supported}
    <Button variant="secondary" size="sm" fullWidth disabled={workspaceStore.busy}
      onclick={() => void workspaceStore.choose()}>
      <FolderOpen size={15} /><span>{t.choose}</span>
    </Button>
    {#if workspaceStore.last}
      <Button variant="ghost" size="sm" fullWidth disabled={workspaceStore.busy}
        title={workspaceStore.last.name} onclick={() => void workspaceStore.reopen()}>
        <span class="name">{t.reopen}: {workspaceStore.last.name}</span>
      </Button>
    {/if}
  {:else}
    <p>{t.unsupported}</p>
  {/if}
  {#if workspaceStore.error}<p role="status">{t[workspaceStore.error]}</p>{/if}
  {#if (workspaceStore.current ?? workspaceStore.last)?.pendingChange && workspaceStore.error !== "pendingChange"}
    <p role="status">{t.pendingChange}</p>
  {/if}
  {#if workspaceStore.createdFolder}
    <p role="status">{i18n.interpolate(t.created, { path: workspaceStore.createdFolder })}</p>
  {/if}
  {#if workspaceStore.busy}<p role="status">{t.loading}</p>{/if}
  {#if workspaceStore.current}
    <div class="folder-heading">
      <strong class="name" title={workspaceStore.current.name}>{workspaceStore.current.name}</strong>
      <Button size="icon-xs" disabled={workspaceStore.busy} ariaLabel={t.refresh} title={t.refresh}
        onclick={() => void workspaceStore.refresh()}><RefreshCw size={14} /></Button>
      <Button size="icon-xs" disabled={workspaceStore.busy} ariaLabel={t.close} title={t.close}
        onclick={() => workspaceStore.close()}><X size={14} /></Button>
    </div>
    {#key workspaceStore.current}
      <WorkspaceTree {onOpen} />
    {/key}
    <p>{t.searchHint}</p>
  {:else if nativeDocuments.length}
    <p>{t.opened}</p>
    <div class="opened-files">
      {#each nativeDocuments as doc (doc.id)}
        <Button size="sm" fullWidth active={vaultStore.activeId === doc.id} title={doc.title}
          onclick={() => { vaultStore.selectDocument(doc.id); onOpen?.(); }}>
          <span class="name">{doc.title}</span>
        </Button>
      {/each}
    </div>
  {/if}
  <p class="session-label">{t.session}</p>
</section>

<style>
  .workspace-panel { padding: 8px 14px 0; flex-shrink: 0; min-width: 0; }
  .folder-heading { display: flex; align-items: center; gap: 4px; margin-top: 4px; font-size: 12px; }
  .folder-heading strong { flex: 1; }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  p { font-size: 11px; line-height: 1.5; color: var(--text-faint); margin: 6px 0; overflow-wrap: anywhere; }
  .opened-files { max-height: 20vh; overflow: auto; }
  .session-label { border-top: 1px solid var(--border-color); padding-top: 8px; }
</style>
