<script lang="ts">
  /**
   * Menú contextual flotante de 3 puntos para acciones sobre un documento:
   * - Cambiar nombre
   * - Mover a carpeta o a la raíz
   * - Eliminar
   */
  import { FolderSync, Pencil, Trash2 } from "lucide-svelte";
  import FolderIcon from "./FolderIcon.svelte";
  import type { FolderItem } from "../../types";

  interface Props {
    folders: FolderItem[];
    currentFolderId?: string | null;
    onRename: (e: MouseEvent) => void;
    onMoveToFolder: (targetFolderId: string | null) => void;
    onDelete: (e: MouseEvent) => void;
  }

  let {
    folders,
    currentFolderId = null,
    onRename,
    onMoveToFolder,
    onDelete,
  }: Props = $props();

  const availableTargetFolders = $derived(
    folders.filter((f) => f.id !== currentFolderId),
  );
  const canMoveToRoot = $derived(Boolean(currentFolderId));
  const showMoveSection = $derived(
    canMoveToRoot || availableTargetFolders.length > 0,
  );
</script>

<div
  class="doc-context-menu"
  role="menu"
  tabindex="-1"
  onclick={(e) => e.stopPropagation()}
  onkeydown={(e) => e.stopPropagation()}
>
  <button
    type="button"
    class="menu-item-btn"
    role="menuitem"
    onclick={onRename}
  >
    <Pencil size={13} />
    <span>Cambiar nombre</span>
  </button>

  {#if showMoveSection}
    <div class="menu-separator"></div>
    <div class="menu-section-header">Mover a:</div>

    {#if canMoveToRoot}
      <button
        type="button"
        class="menu-item-btn"
        role="menuitem"
        onclick={() => onMoveToFolder(null)}
      >
        <FolderSync size={13} />
        <span>Raíz (Sin carpeta)</span>
      </button>
    {/if}

    {#each availableTargetFolders as targetFolder (targetFolder.id)}
      <button
        type="button"
        class="menu-item-btn"
        role="menuitem"
        onclick={() => onMoveToFolder(targetFolder.id)}
      >
        <FolderIcon size={14} />
        <span>{targetFolder.name}</span>
      </button>
    {/each}
  {/if}

  <div class="menu-separator"></div>

  <button
    type="button"
    class="menu-item-btn danger"
    role="menuitem"
    onclick={onDelete}
  >
    <Trash2 size={13} />
    <span>Eliminar</span>
  </button>
</div>

<style>
  .doc-context-menu {
    position: absolute;
    right: 8px;
    top: 30px;
    background: var(--bg-surface, #16181d);
    border: 1px solid var(--border-color, #262a33);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    z-index: 60;
    min-width: 170px;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    animation: menuPop 0.12s ease-out;
  }

  @keyframes menuPop {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .menu-section-header {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint, #64748b);
    padding: 4px 8px;
  }

  .menu-separator {
    height: 1px;
    background: var(--border-subtle, #212429);
    margin: 3px 0;
  }

  .menu-item-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: transparent;
    border: none;
    border-radius: 5px;
    color: var(--text-primary, #f1f5f9);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: all 0.12s ease;
    font-family: inherit;
  }

  .menu-item-btn:hover {
    background: #3b82f6;
    color: #ffffff;
  }

  .menu-item-btn.danger {
    color: var(--danger-color, #e5736a);
  }

  .menu-item-btn.danger:hover {
    background: rgba(239, 68, 68, 0.18);
    color: var(--danger-color, #ef4444);
  }
</style>
