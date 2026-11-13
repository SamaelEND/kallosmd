<script lang="ts">
  /**
   * Componente FileTree.
   * Renderiza el árbol jerárquico de carpetas y documentos en la raíz,
   * gestionando estados de búsqueda vacía y Drag & Drop entre contenedores.
   */
  import type { DocumentItem, FolderItem as FolderItemType } from "../../../core/types";
  import { i18n } from "../../../shared/i18n/i18n.svelte";
  import FolderItem from "./FolderItem.svelte";
  import FileItem from "./FileItem.svelte";
  import { isLocalDocumentDrag, LOCAL_DOCUMENT_DRAG_TYPE } from "../../workspace/dragImport";

  interface Props {
    visibleFolders: FolderItemType[];
    visibleRootDocs: DocumentItem[];
    allFolders: FolderItemType[];
    activeDocId: string;
    isSearching: boolean;
    searchQuery: string;
    totalResultsCount: number;
    editingFolderId: string | null;
    editingDocId: string | null;
    activeDocMenuId: string | null;
    getDocsForFolder: (folderId: string) => DocumentItem[];
    onToggleFolderExpand: (folderId: string) => void;
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
  }

  let {
    visibleFolders,
    visibleRootDocs,
    allFolders,
    activeDocId,
    isSearching,
    searchQuery,
    totalResultsCount,
    editingFolderId,
    editingDocId,
    activeDocMenuId,
    getDocsForFolder,
    onToggleFolderExpand,
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
  }: Props = $props();

  let dragOverTargetId = $state<string | null>(null);

  function handleDragStart(e: DragEvent, docId: string): void {
    if (e.dataTransfer) {
      e.dataTransfer.setData(LOCAL_DOCUMENT_DRAG_TYPE, docId);
      e.dataTransfer.effectAllowed = "move";
    }
  }

  function handleDragOver(e: DragEvent, targetId: string): void {
    if (!isLocalDocumentDrag(e.dataTransfer)) return;
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    dragOverTargetId = targetId;
  }

  function handleDragLeave(): void {
    dragOverTargetId = null;
  }

  function handleDrop(e: DragEvent, targetFolderId: string | null): void {
    if (!isLocalDocumentDrag(e.dataTransfer)) return;
    e.preventDefault();
    dragOverTargetId = null;
    const docId = e.dataTransfer?.getData(LOCAL_DOCUMENT_DRAG_TYPE);
    if (docId) {
      onMoveDocToFolder(docId, targetFolderId);
    }
  }

  const t = $derived(i18n.current);
</script>

<div class="file-tree-container">
  {#if isSearching && totalResultsCount === 0}
    <div class="empty-search-state">
      <p class="empty-search-text">
        {i18n.interpolate(t.sidebar.emptySearch, { query: searchQuery })}
      </p>
    </div>
  {:else}
    <!-- 1. Grupo de Carpetas -->
    {#if visibleFolders.length > 0}
      <div class="folders-group">
        <div class="group-header">
          <span class="group-title">{t.sidebar.foldersGroup}</span>
          <span class="group-count">{visibleFolders.length}</span>
        </div>

        {#each visibleFolders as folder (folder.id)}
          <FolderItem
            {folder}
            folderDocs={getDocsForFolder(folder.id)}
            {allFolders}
            {activeDocId}
            isExpanded={isSearching ? true : Boolean(folder.isExpanded)}
            isDropTarget={dragOverTargetId === folder.id}
            {editingFolderId}
            {editingDocId}
            {activeDocMenuId}
            onToggleExpand={onToggleFolderExpand}
            {onStartRenameFolder}
            {onCommitRenameFolder}
            {onCancelRenameFolder}
            {onCreateDocInFolder}
            {onDeleteFolder}
            {onSelectDoc}
            {onStartRenameDoc}
            {onCommitRenameDoc}
            {onCancelRenameDoc}
            {onToggleDocMenu}
            {onMoveDocToFolder}
            {onDeleteDoc}
            onDragStartDoc={handleDragStart}
            onDragOverFolder={handleDragOver}
            onDragLeaveFolder={handleDragLeave}
            onDropOnFolder={handleDrop}
          />
        {/each}
      </div>
    {/if}

    <!-- 2. Archivos en la Raíz -->
    {#if visibleRootDocs.length > 0}
      <div
        class="root-docs-group"
        class:drop-target={dragOverTargetId === "root"}
        ondragover={(e) => handleDragOver(e, "root")}
        ondragleave={handleDragLeave}
        ondrop={(e) => handleDrop(e, null)}
        role="region"
        aria-label={t.sidebar.tabFiles}
      >
        <div class="group-header">
          <span class="group-title">{t.sidebar.filesGroup}</span>
          <span class="group-count">{visibleRootDocs.length}</span>
        </div>

        {#each visibleRootDocs as doc (doc.id)}
          <FileItem
            {doc}
            isActive={doc.id === activeDocId}
            isNested={false}
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
            onDragStart={handleDragStart}
          />
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .file-tree-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 8px 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .empty-search-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 56px 16px;
    text-align: center;
  }

  .empty-search-text {
    font-size: var(--ui-font-sm, 0.75rem);
    color: var(--text-faint, #64748b);
    margin: 0;
  }

  .group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 10px 4px 10px;
  }

  .group-title {
    font-size: var(--ui-font-2xs, 0.65625rem);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint, #64748b);
  }

  .group-count {
    font-size: var(--ui-font-2xs, 0.65625rem);
    font-weight: 500;
    color: var(--text-faint, #64748b);
  }

  .root-docs-group {
    border-radius: 8px;
    border: 1px solid transparent;
    transition: all 0.15s ease;
  }

  .root-docs-group.drop-target {
    border: 1px dashed #3b82f6;
    background: rgba(59, 130, 246, 0.08);
  }
</style>
