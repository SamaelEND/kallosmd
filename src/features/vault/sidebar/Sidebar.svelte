<script lang="ts">
  /**
   * ES: Componente orquestador del panel lateral (Sidebar) con árbol de archivos, búsqueda y tabla de contenidos.
   * EN: Sidebar orchestrator component with file tree, search, and table of contents.
   */
  import { documentStore } from "../vaultStore.svelte";
  import { i18n } from "../../../shared/i18n/i18n.svelte";
  import type { FolderItem, TocHeading } from "../../../core/types";
  import SidebarHeader from "./SidebarHeader.svelte";
  import SidebarTabs, { type SidebarTab } from "./SidebarTabs.svelte";
  import SidebarQuickActions from "./SidebarQuickActions.svelte";
  import SearchBox from "./SearchBox.svelte";
  import FileTree from "./FileTree.svelte";
  import TocPanel from "./TocPanel.svelte";
  import { confirmStore } from "../../../shared/ui/confirmStore.svelte";
  import SidebarFooter from "./SidebarFooter.svelte";
  import WorkspacePanel from "./WorkspacePanel.svelte";

  interface Props {
    isOpen: boolean;
    onClose?: () => void;
  }

  let { isOpen, onClose }: Props = $props();

  let activeTab = $state<SidebarTab>("docs");
  let searchQuery = $state("");

  const t = $derived(i18n.current);

  // ES: Estados de edición en línea y menú contextual de archivos.
  // EN: States for inline editing and file context menu.
  let editingFolderId = $state<string | null>(null);
  let editingDocId = $state<string | null>(null);
  let activeDocMenuId = $state<string | null>(null);

  // ES: Filtrado reactivo de documentos y carpetas según la consulta de búsqueda.
  // EN: Reactive filtering of documents and folders based on the search query.
  const isSearching = $derived(searchQuery.trim().length > 0);
  const cleanQuery = $derived(searchQuery.trim().toLowerCase());

  const matchingDocs = $derived.by(() => {
    const documents = documentStore.documents.filter(d => !documentStore.isWorkspaceDocument(d.id));
    if (!isSearching) return documents;
    return documents.filter(
      (d) =>
        d.title.toLowerCase().includes(cleanQuery) ||
        d.content.toLowerCase().includes(cleanQuery),
    );
  });

  const visibleFolders = $derived.by(() => {
    if (!isSearching) return documentStore.folders;
    return documentStore.folders.filter((folder) =>
      matchingDocs.some((d) => d.folderId === folder.id),
    );
  });

  const visibleRootDocs = $derived(matchingDocs.filter((d) => !d.folderId));

  const totalResultsCount = $derived(matchingDocs.length);
  const tocHeadings = $derived(documentStore.tocHeadings);

  function getDocsForFolder(folderId: string) {
    return matchingDocs.filter((d) => d.folderId === folderId);
  }

  function closeIfMobile(): void {
    if (typeof window !== "undefined" && window.innerWidth <= 1024 && onClose) {
      onClose();
    }
  }

  function handleCreateRootDoc(): void {
    const count = documentStore.documents.length + 1;
    documentStore.createDocument(
      `documento-${count}.md`,
      `# Documento ${count}\n\n`,
      null,
    );
    activeTab = "docs";
    closeIfMobile();
  }

  function handleCreateDocInFolder(folderId: string, e?: MouseEvent): void {
    e?.stopPropagation();
    const folder = documentStore.folders.find((f) => f.id === folderId);
    const folderName = folder
      ? folder.name.toLowerCase().replace(/\s+/g, "-")
      : "folder";
    const docsInFolder = documentStore.documents.filter(
      (d) => d.folderId === folderId,
    );
    const count = docsInFolder.length + 1;

    if (folder && !folder.isExpanded) {
      documentStore.toggleFolderExpanded(folderId);
    }

    documentStore.createDocument(
      `${folderName}-doc-${count}.md`,
      `# Nuevo Documento\n\n`,
      folderId,
    );
    activeTab = "docs";
    closeIfMobile();
  }

  function handleCreateFolder(): void {
    const folderCount = documentStore.folders.length + 1;
    const folderName = i18n.interpolate(t.sidebar.defaultFolderName, {
      count: folderCount,
    });
    const newFolder = documentStore.createFolder(folderName);
    editingFolderId = newFolder.id;
  }

  function handleImportFile(filename: string, content: string): void {
    documentStore.importDocument(filename, content);
    closeIfMobile();
  }

  function startRenamingFolder(folder: FolderItem, e: MouseEvent): void {
    e.stopPropagation();
    editingFolderId = folder.id;
  }

  function commitFolderName(folderId: string, newName: string): void {
    if (editingFolderId === folderId && newName.trim()) {
      documentStore.updateFolderName(folderId, newName);
    }
    editingFolderId = null;
  }

  /**
   * ES: Abre el modal propio de confirmación con textos del idioma activo.
   * EN: Opens the app's own confirmation modal with active-language texts.
   */
  function askConfirm(title: string, message: string, confirmLabel: string): Promise<boolean> {
    return confirmStore.ask({
      title,
      message,
      confirmLabel,
      cancelLabel: i18n.current.dialogs.cancel,
      tone: "danger",
    });
  }

  async function handleDeleteFolder(folderId: string, e: MouseEvent): Promise<void> {
    e.stopPropagation();
    const folder = documentStore.folders.find((f) => f.id === folderId);
    if (!folder) return;

    const docsInside = documentStore.documents.filter(
      (d) => d.folderId === folderId,
    );
    const d = i18n.current.dialogs;
    const hasDocs = docsInside.length > 0;
    const message = hasDocs
      ? i18n.interpolate(d.deleteFolderConfirm, { name: folder.name, count: docsInside.length })
      : i18n.interpolate(d.deleteEmptyFolderConfirm, { name: folder.name });
    if (await askConfirm(d.deleteFolderTitle, message, d.delete)) {
      documentStore.deleteFolder(folderId, !hasDocs);
    }
  }

  function startRenamingDoc(
    docId: string,
    _currentTitle: string,
    e?: MouseEvent,
  ): void {
    e?.stopPropagation();
    editingDocId = docId;
    activeDocMenuId = null;
  }

  function commitDocTitle(docId: string, newTitle: string): void {
    if (editingDocId === docId && newTitle.trim()) {
      documentStore.updateDocumentTitle(docId, newTitle, true);
    }
    editingDocId = null;
  }

  function toggleDocMenu(docId: string, e: MouseEvent): void {
    e.stopPropagation();
    activeDocMenuId = activeDocMenuId === docId ? null : docId;
  }

  function handleMoveDoc(docId: string, targetFolderId: string | null): void {
    documentStore.moveDocumentToFolder(docId, targetFolderId);
    activeDocMenuId = null;
  }

  async function handleDeleteDoc(id: string, e: MouseEvent): Promise<void> {
    e.stopPropagation();
    activeDocMenuId = null;
    const doc = documentStore.documents.find((d) => d.id === id);
    if (!doc) return;

    const d = i18n.current.dialogs;
    if (await askConfirm(d.deleteDocTitle, i18n.interpolate(d.deleteDocConfirm, { title: doc.title }), d.delete)) {
      documentStore.deleteDocument(id);
    }
  }

  async function handleClearAll(): Promise<void> {
    const d = i18n.current.dialogs;
    if (await askConfirm(d.clearAllTitle, d.clearAllConfirm, d.clearAll)) {
      documentStore.clearAllDocuments();
    }
  }

  function handleSelectDoc(docId: string): void {
    documentStore.selectDocument(docId);
    closeIfMobile();
  }

  // ES: Desplaza el panel de lectura hacia el encabezado seleccionado dentro de la vista previa.
  // EN: Scrolls the reading pane to the selected heading inside the preview container.
  function scrollToHeading(heading: TocHeading): void {
    const previewArticle = document.querySelector(".reading-table-content");
    const target = previewArticle?.querySelector<HTMLElement>(
      `#${CSS.escape(heading.id)}`,
    );
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      closeIfMobile();
    }
  }
</script>

<svelte:window
  onclick={() => {
    activeDocMenuId = null;
  }}
/>

<aside
  class="sidebar studio-sidebar no-print"
  class:sidebar-open={isOpen}
  aria-label="Panel lateral de navegación"
>
  <SidebarHeader />

  <SidebarTabs
    {activeTab}
    docsCount={documentStore.documents.length}
    tocCount={tocHeadings.length}
    onSelectTab={(tab) => (activeTab = tab)}
  />

  {#if activeTab === "docs"}
    <div class="sidebar-section">
      <WorkspacePanel onOpen={closeIfMobile} />
      <SidebarQuickActions
        onCreateDoc={handleCreateRootDoc}
        onCreateFolder={handleCreateFolder}
        onImportFile={handleImportFile}
      />

      <SearchBox bind:query={searchQuery} />

      <FileTree
        {visibleFolders}
        {visibleRootDocs}
        allFolders={documentStore.folders}
        activeDocId={documentStore.activeId}
        {isSearching}
        {searchQuery}
        {totalResultsCount}
        {editingFolderId}
        {editingDocId}
        {activeDocMenuId}
        {getDocsForFolder}
        onToggleFolderExpand={(id) => documentStore.toggleFolderExpanded(id)}
        onStartRenameFolder={startRenamingFolder}
        onCommitRenameFolder={commitFolderName}
        onCancelRenameFolder={() => (editingFolderId = null)}
        onCreateDocInFolder={handleCreateDocInFolder}
        onDeleteFolder={handleDeleteFolder}
        onSelectDoc={handleSelectDoc}
        onStartRenameDoc={startRenamingDoc}
        onCommitRenameDoc={commitDocTitle}
        onCancelRenameDoc={() => (editingDocId = null)}
        onToggleDocMenu={toggleDocMenu}
        onMoveDocToFolder={handleMoveDoc}
        onDeleteDoc={handleDeleteDoc}
      />

      {#if !isSearching}
        <SidebarFooter onClearAll={handleClearAll} />
      {/if}
    </div>
  {:else}
    <TocPanel headings={tocHeadings} onSelectHeading={scrollToHeading} />
  {/if}
</aside>

<style>
  .sidebar {
    width: 290px;
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-surface, #16181d);
    border-right: 1px solid var(--border-color, #262a33);
    user-select: none;
    overflow: hidden;
    position: relative;
    z-index: 25;
    flex-shrink: 0;
    transition:
      width 0.22s cubic-bezier(0.16, 1, 0.3, 1),
      transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
      border-color 0.22s ease;
  }

  .sidebar:not(.sidebar-open) {
    width: 0;
    border-right: none;
    pointer-events: none;
    visibility: hidden;
  }

  .sidebar-section {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    min-width: 290px;
  }

  @media (max-width: 1024px) {
    .sidebar {
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      width: 285px;
      max-width: 85vw;
      transform: translateX(-100%);
      box-shadow: 8px 0 36px rgba(0, 0, 0, 0.65);
      visibility: visible;
      pointer-events: auto;
      z-index: 100;
      transition: transform 0.26s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .sidebar.sidebar-open {
      transform: translateX(0);
      visibility: visible;
    }

    .sidebar:not(.sidebar-open) {
      width: 285px;
      transform: translateX(-100%);
      visibility: hidden;
      pointer-events: none;
    }
  }
</style>
