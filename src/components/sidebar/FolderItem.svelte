<script lang="ts">
  /**
   * Componente FolderItem para el árbol de archivos.
   * Representa una carpeta expandible con icono animado, edición de nombre en línea,
   * acciones rápidas en hover y listado anidado de componentes FileItem.
   */
  import {
    ChevronDown,
    ChevronRight,
    Pencil,
    Plus,
    Trash2,
  } from "lucide-svelte";
  import type { DocumentItem, FolderItem as FolderItemType } from "../../types";
  import { i18n } from "../../stores/i18n.svelte";
  import FolderIcon from "./FolderIcon.svelte";
  import FileItem from "./FileItem.svelte";
  import InlineRenameInput from "../ui/InlineRenameInput.svelte";
  import Button from "../ui/Button.svelte";

  interface Props {
    folder: FolderItemType;
    folderDocs: DocumentItem[];
    allFolders: FolderItemType[];
    activeDocId: string;
    isExpanded: boolean;
    isDropTarget: boolean;
    editingFolderId: string | null;
    editingDocId: string | null;
    activeDocMenuId: string | null;
    onToggleExpand: (folderId: string) => void;
    onStartRenameFolder: (folder: FolderItemType, e: MouseEvent) => void;
    onCommitRenameFolder: (folderId: string, newName: string) => void;
    onCancelRenameFolder: () => void;
    onCreateDocInFolder: (folderId: string, e: MouseEvent) => void;
    onDeleteFolder: (folderId: string, e: MouseEvent) => void;
    onSelectDoc: (docId: string) => void;
    onStartRenameDoc: (
      docId: string,
      currentTitle: string,
      e?: MouseEvent,
    ) => void;
    onCommitRenameDoc: (docId: string, newTitle: string) => void;
    onCancelRenameDoc: () => void;
    onToggleDocMenu: (docId: string, e: MouseEvent) => void;
    onMoveDocToFolder: (docId: string, targetFolderId: string | null) => void;
    onDeleteDoc: (docId: string, e: MouseEvent) => void;
    onDragStartDoc: (e: DragEvent, docId: string) => void;
    onDragOverFolder: (e: DragEvent, folderId: string) => void;
    onDragLeaveFolder: () => void;
    onDropOnFolder: (e: DragEvent, folderId: string) => void;
  }

  let {
    folder,
    folderDocs,
    allFolders,
    activeDocId,
    isExpanded,
    isDropTarget,
    editingFolderId,
    editingDocId,
    activeDocMenuId,
    onToggleExpand,
    onStartRenameFolder,
    onCommitRenameFolder,
    onCancelRenameFolder,
    onCreateDocInFolder,
    onDeleteFolder,
    onSelectDoc,
    onStartRenameDoc,
    onCommitRenameDoc,
    onCancelRenameDoc,
    onToggleDocMenu,
    onMoveDocToFolder,
    onDeleteDoc,
    onDragStartDoc,
    onDragOverFolder,
    onDragLeaveFolder,
    onDropOnFolder,
  }: Props = $props();

  let draftFolderName = $state("");
  const isEditingFolder = $derived(editingFolderId === folder.id);
  const t = $derived(i18n.current);

  $effect(() => {
    if (isEditingFolder) {
      draftFolderName = folder.name;
    }
  });
</script>

<div
  class="folder-item"
  class:drop-target={isDropTarget}
  ondragover={(e) => onDragOverFolder(e, folder.id)}
  ondragleave={onDragLeaveFolder}
  ondrop={(e) => onDropOnFolder(e, folder.id)}
  role="group"
>
  <div
    class="folder-row"
    onclick={() => onToggleExpand(folder.id)}
    role="button"
    tabindex="0"
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        onToggleExpand(folder.id);
      }
    }}
  >
    <button
      type="button"
      class="folder-toggle-btn"
      aria-label={isExpanded
        ? (i18n.locale === "es" ? "Colapsar carpeta" : "Collapse folder")
        : (i18n.locale === "es" ? "Expandir carpeta" : "Expand folder")}
      tabindex="-1"
    >
      {#if isExpanded}
        <ChevronDown size={14} />
      {:else}
        <ChevronRight size={14} />
      {/if}
    </button>

    <FolderIcon
      hasFiles={folderDocs.length > 0}
      isOpen={isExpanded}
      size={18}
    />

    {#if isEditingFolder}
      <InlineRenameInput
        bind:value={draftFolderName}
        ariaLabel={t.sidebar.renameFolderAria}
        onCommit={(val) => onCommitRenameFolder(folder.id, val)}
        onCancel={onCancelRenameFolder}
      />
    {:else}
      <span
        class="folder-name"
        title={folder.name}
        role="button"
        tabindex="0"
        ondblclick={(e) => onStartRenameFolder(folder, e)}
        onkeydown={(e) => {
          if (e.key === "F2") {
            onStartRenameFolder(folder, e as unknown as MouseEvent);
          }
        }}
      >
        {folder.name}
      </span>
      <span class="folder-doc-count">{folderDocs.length}</span>
    {/if}

    <div
      class="folder-actions"
      role="presentation"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="icon-xs"
        title={t.contextMenu.folderNewDoc}
        onclick={(e) => onCreateDocInFolder(folder.id, e)}
      >
        <Plus size={13} />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        title={t.contextMenu.folderRename}
        onclick={(e) => onStartRenameFolder(folder, e)}
      >
        <Pencil size={12} />
      </Button>
      <Button
        variant="danger"
        size="icon-xs"
        title={t.contextMenu.folderDelete}
        onclick={(e) => onDeleteFolder(folder.id, e)}
      >
        <Trash2 size={12} />
      </Button>
    </div>
  </div>

  {#if isExpanded}
    <div class="folder-children">
      {#if folderDocs.length === 0}
        <div class="empty-folder-label">
          <span>{t.sidebar.emptyFolder}</span>
        </div>
      {:else}
        {#each folderDocs as doc (doc.id)}
          <FileItem
            {doc}
            isActive={doc.id === activeDocId}
            isNested={true}
            isEditing={editingDocId === doc.id}
            isMenuOpen={activeDocMenuId === doc.id}
            folders={allFolders}
            onSelect={onSelectDoc}
            onStartRename={onStartRenameDoc}
            onCommitRename={onCommitRenameDoc}
            onCancelRename={onCancelRenameDoc}
            onToggleMenu={onToggleDocMenu}
            onMoveToFolder={onMoveDocToFolder}
            onDelete={onDeleteDoc}
            onDragStart={onDragStartDoc}
          />
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .folder-item {
    border-radius: 8px;
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
    border: 1px solid transparent;
  }

  .folder-item.drop-target {
    border: 1px dashed #3b82f6;
    background: rgba(59, 130, 246, 0.08);
  }

  .folder-row {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 5px 8px;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-primary, #f1f5f9);
    font-size: var(--ui-font-base, 0.78125rem);
    font-weight: 500;
    line-height: 1.3;
    position: relative;
    transition: background 0.12s ease;
  }

  .folder-row:hover {
    background: var(--bg-hover, #282c35);
  }

  .folder-toggle-btn {
    background: transparent;
    border: none;
    color: var(--text-faint, #64748b);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    width: 14px;
    height: 14px;
    cursor: pointer;
  }

  .folder-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
    background: transparent;
    border: none;
    padding: 0;
    color: inherit;
    font-family: inherit;
    font-size: var(--ui-font-base, 0.78125rem);
    font-weight: 500;
    line-height: 1.3;
  }

  .folder-doc-count {
    font-size: var(--ui-font-2xs, 0.65625rem);
    color: var(--text-faint, #64748b);
    margin-left: auto;
  }

  .folder-actions {
    display: none;
    align-items: center;
    gap: 2px;
  }

  .folder-row:hover .folder-actions {
    display: flex;
  }

  .folder-children {
    margin-left: 16px;
    border-left: 1px solid var(--border-color, #262a33);
    padding-left: 7px;
    margin-top: 2px;
    margin-bottom: 4px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .empty-folder-label {
    padding: 5px 8px;
    font-size: var(--ui-font-xs, 0.6875rem);
    color: var(--text-faint, #64748b);
  }
</style>
