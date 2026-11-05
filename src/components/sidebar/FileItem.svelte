<script lang="ts">
  /**
   * Componente FileItem reutilizable.
   * Representa un archivo .md tanto dentro de una carpeta como en la raíz del árbol.
   * Incluye edición de nombre en línea, metadatos de tamaño/fecha, Drag & Drop y menú contextual.
   */
  import { FileText, MoreVertical } from "lucide-svelte";
  import { i18n } from "../../stores/i18n.svelte";
  import type { DocumentItem, FolderItem } from "../../types";
  import { formatFileMeta } from "../../lib/utils/formatters";
  import InlineRenameInput from "../ui/InlineRenameInput.svelte";
  import Button from "../ui/Button.svelte";
  import FileContextMenu from "./FileContextMenu.svelte";

  interface Props {
    doc: DocumentItem;
    isActive: boolean;
    isNested?: boolean;
    isEditing: boolean;
    isMenuOpen: boolean;
    folders: FolderItem[];
    onSelect: (docId: string) => void;
    onStartRename: (
      docId: string,
      currentTitle: string,
      e?: MouseEvent,
    ) => void;
    onCommitRename: (docId: string, newTitle: string) => void;
    onCancelRename: () => void;
    onToggleMenu: (docId: string, e: MouseEvent) => void;
    onMoveToFolder: (docId: string, targetFolderId: string | null) => void;
    onDelete: (docId: string, e: MouseEvent) => void;
    onDragStart: (e: DragEvent, docId: string) => void;
  }

  let {
    doc,
    isActive,
    isNested = false,
    isEditing,
    isMenuOpen,
    folders,
    onSelect,
    onStartRename,
    onCommitRename,
    onCancelRename,
    onToggleMenu,
    onMoveToFolder,
    onDelete,
    onDragStart,
  }: Props = $props();

  let draftTitle = $state("");

  $effect(() => {
    if (isEditing) {
      draftTitle = doc.title;
    }
  });

  const docSize = $derived(new Blob([doc.content]).size);
  const t = $derived(i18n.current);
</script>

<div
  class="doc-item"
  class:nested-doc={isNested}
  class:active={isActive}
  draggable="true"
  ondragstart={(e) => onDragStart(e, doc.id)}
  onclick={() => onSelect(doc.id)}
  role="button"
  tabindex="0"
  onkeydown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      onSelect(doc.id);
    }
  }}
>
  <div class="doc-icon">
    <FileText size={15} />
  </div>

  <div class="doc-info">
    {#if isEditing}
      <InlineRenameInput
        bind:value={draftTitle}
        ariaLabel={t.sidebar.renameDocAria}
        onCommit={(val) => onCommitRename(doc.id, val)}
        onCancel={onCancelRename}
      />
    {:else}
      <span
        class="doc-title"
        title={doc.title}
        role="button"
        tabindex="0"
        ondblclick={(e) => onStartRename(doc.id, doc.title, e)}
        onkeydown={(e) => {
          if (e.key === "F2") {
            onStartRename(doc.id, doc.title, e as unknown as MouseEvent);
          }
        }}
      >
        {doc.title}
      </span>
      <div class="doc-meta">
        <span>{formatFileMeta(doc.updatedAt, docSize, i18n.locale)}</span>
      </div>
    {/if}
  </div>

  <div
    class="doc-actions"
    role="presentation"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <Button
      variant="ghost"
      size="icon-xs"
      title={t.contextMenu.fileOptions}
      ariaLabel={t.contextMenu.fileOptions}
      onclick={(e) => onToggleMenu(doc.id, e)}
    >
      <MoreVertical size={14} />
    </Button>
  </div>

  {#if isMenuOpen}
    <FileContextMenu
      {folders}
      currentFolderId={doc.folderId}
      onRename={(e) => onStartRename(doc.id, doc.title, e)}
      onMoveToFolder={(targetFolderId) =>
        onMoveToFolder(doc.id, targetFolderId)}
      onDelete={(e) => onDelete(doc.id, e)}
    />
  {/if}
</div>

<style>
  .doc-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    border-radius: 7px;
    cursor: pointer;
    background: transparent;
    border: 1px solid transparent;
    transition: all 0.12s ease;
  }

  .doc-item:hover {
    background: var(--bg-hover, #282c35);
  }

  .doc-item.active {
    background-color: var(--bg-active-item, #1e293b);
    border-color: var(--border-active-item, rgba(59, 130, 246, 0.35));
  }

  .doc-icon {
    color: var(--text-secondary, #94a3b8);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .doc-item.active .doc-icon {
    color: #3b82f6;
  }

  .doc-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .doc-title {
    font-family: inherit;
    font-size: var(--ui-font-base, 0.78125rem);
    font-weight: 450;
    line-height: 1.3;
    color: var(--text-primary, #f1f5f9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
    background: transparent;
    border: none;
    padding: 0;
  }

  .doc-item.active .doc-title {
    color: var(--text-primary, #f1f5f9);
    font-weight: 550;
  }

  .doc-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--ui-font-2xs, 0.65625rem);
    line-height: 1.2;
    color: var(--text-faint, #64748b);
  }

  .doc-actions {
    display: none;
    align-items: center;
  }

  .doc-item:hover .doc-actions,
  .doc-item.active .doc-actions {
    display: flex;
  }
</style>
