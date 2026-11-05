<script lang="ts">
  /**
   * Componente Sidebar de MD Studio.
   * Sistema ergonómico de navegación por carpetas y documentos Markdown (.md):
   * - Búsqueda inteligente: oculta elementos no coincidentes y muestra mensaje de sin resultados.
   * - Iconos de carpetas en ámbar dorado (#eab308) con animación dinámica.
   * - Menú contextual de 3 puntos para renombrar manualmente, mover o eliminar archivos.
   * - Botón de ocultar en la esquina superior derecha con icono de sidebar (PanelLeft).
   */
  import {
    AlignLeft,
    Check,
    ChevronDown,
    ChevronRight,
    FileText,
    Folder,
    FolderPlus,
    FolderSync,
    MoreVertical,
    PanelLeft,
    Pencil,
    Plus,
    Search,
    Trash2,
    Upload,
    X,
  } from "lucide-svelte";
  import FolderIcon from "./FolderIcon.svelte";
  import { documentStore } from "../stores/documents.svelte";
  import type { FolderItem, TocHeading } from "../types";

  interface Props {
    isOpen: boolean;
    onClose?: () => void;
  }

  let { isOpen, onClose }: Props = $props();

  let activeTab = $state<"docs" | "toc">("docs");
  let searchQuery = $state("");
  let fileInputElement = $state<HTMLInputElement | null>(null);

  // Estados de edición en línea de nombres
  let editingFolderId = $state<string | null>(null);
  let editingFolderName = $state("");
  let editingDocId = $state<string | null>(null);
  let editingDocTitle = $state("");

  // Estado del menú desplegable de 3 puntos para documentos
  let activeDocMenuId = $state<string | null>(null);

  // Estado de Drag & Drop
  let draggedDocId = $state<string | null>(null);
  let dragOverTargetId = $state<string | null>(null);

  // Acción de auto-enfoque y selección al montar inputs de edición
  function focusOnMount(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  // Lógica reactiva de búsqueda
  const isSearching = $derived(searchQuery.trim().length > 0);
  const cleanQuery = $derived(searchQuery.trim().toLowerCase());

  // Documentos coincidentes
  const matchingDocs = $derived.by(() => {
    if (!isSearching) return documentStore.documents;
    return documentStore.documents.filter(
      (d) =>
        d.title.toLowerCase().includes(cleanQuery) ||
        d.content.toLowerCase().includes(cleanQuery),
    );
  });

  // Carpetas visibles: en búsqueda sólo aquellas con archivos coincidentes
  const visibleFolders = $derived.by(() => {
    if (!isSearching) return documentStore.folders;
    return documentStore.folders.filter((folder) =>
      matchingDocs.some((d) => d.folderId === folder.id),
    );
  });

  // Documentos para una carpeta dada
  function getDocsForFolder(folderId: string) {
    if (!isSearching) {
      return documentStore.documents.filter((d) => d.folderId === folderId);
    }
    return matchingDocs.filter((d) => d.folderId === folderId);
  }

  // Documentos de la raíz (sin carpeta)
  const visibleRootDocs = $derived.by(() => {
    if (!isSearching) {
      return documentStore.documents.filter((d) => !d.folderId);
    }
    return matchingDocs.filter((d) => !d.folderId);
  });

  // Cantidad total de resultados
  const totalResultsCount = $derived(matchingDocs.length);

  const tocHeadings = $derived(documentStore.tocHeadings);

  function closeIfMobile(): void {
    if (typeof window !== "undefined" && window.innerWidth <= 1024 && onClose) {
      onClose();
    }
  }

  // Creación de documento en la raíz
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

  // Creación de documento dentro de una carpeta específica
  function handleCreateDocInFolder(folderId: string, e?: MouseEvent): void {
    e?.stopPropagation();
    const folder = documentStore.folders.find((f) => f.id === folderId);
    const folderName = folder ? folder.name.toLowerCase().replace(/\s+/g, "-") : "folder";
    const docsInFolder = documentStore.documents.filter((d) => d.folderId === folderId);
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

  // Creación de carpeta
  function handleCreateFolder(): void {
    const folderCount = documentStore.folders.length + 1;
    const defaultName = `Carpeta ${folderCount}`;
    const newFolder = documentStore.createFolder(defaultName);
    editingFolderId = newFolder.id;
    editingFolderName = newFolder.name;
  }

  // Renombrado de carpeta
  function startRenamingFolder(folder: FolderItem, e: MouseEvent): void {
    e.stopPropagation();
    editingFolderId = folder.id;
    editingFolderName = folder.name;
  }

  function commitFolderName(folderId: string): void {
    if (editingFolderId === folderId && editingFolderName.trim()) {
      documentStore.updateFolderName(folderId, editingFolderName);
    }
    editingFolderId = null;
    editingFolderName = "";
  }

  function handleFolderInputKeyDown(folderId: string, e: KeyboardEvent): void {
    if (e.key === "Enter") {
      commitFolderName(folderId);
    } else if (e.key === "Escape") {
      editingFolderId = null;
      editingFolderName = "";
    }
  }

  // Eliminación de carpeta
  function handleDeleteFolder(folderId: string, e: MouseEvent): void {
    e.stopPropagation();
    const folder = documentStore.folders.find((f) => f.id === folderId);
    if (!folder) return;

    const docsInside = documentStore.documents.filter((d) => d.folderId === folderId);
    if (docsInside.length > 0) {
      const choice = confirm(
        `La carpeta "${folder.name}" contiene ${docsInside.length} archivo(s).\n\n¿Presiona ACEPTAR para eliminar la carpeta y conservar los archivos en la raíz?\n(Cancelar aborta la operación)`,
      );
      if (choice) {
        documentStore.deleteFolder(folderId, false);
      }
    } else {
      if (confirm(`¿Eliminar la carpeta vacía "${folder.name}"?`)) {
        documentStore.deleteFolder(folderId, true);
      }
    }
  }

  // Renombrado manual de documento desde los 3 puntos o doble clic
  function startRenamingDoc(docId: string, currentTitle: string, e?: MouseEvent): void {
    e?.stopPropagation();
    editingDocId = docId;
    editingDocTitle = currentTitle;
    activeDocMenuId = null;
  }

  function commitDocTitle(docId: string): void {
    if (editingDocId === docId && editingDocTitle.trim()) {
      documentStore.updateDocumentTitle(docId, editingDocTitle, true);
    }
    editingDocId = null;
    editingDocTitle = "";
  }

  function handleDocInputKeyDown(docId: string, e: KeyboardEvent): void {
    if (e.key === "Enter") {
      commitDocTitle(docId);
    } else if (e.key === "Escape") {
      editingDocId = null;
      editingDocTitle = "";
    }
  }

  // Menú de 3 puntos
  function toggleDocMenu(docId: string, e: MouseEvent): void {
    e.stopPropagation();
    activeDocMenuId = activeDocMenuId === docId ? null : docId;
  }

  function handleMoveDoc(docId: string, targetFolderId: string | null): void {
    documentStore.moveDocumentToFolder(docId, targetFolderId);
    activeDocMenuId = null;
  }

  // Manejo de importación de archivos
  function handleTriggerOpen(): void {
    fileInputElement?.click();
  }

  function handleFileInputChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || "");
      documentStore.importDocument(file.name, content);
      input.value = "";
      closeIfMobile();
    };
    reader.readAsText(file);
  }

  // Eliminación de documento
  function handleDeleteDoc(id: string, e: MouseEvent): void {
    e.stopPropagation();
    activeDocMenuId = null;
    const doc = documentStore.documents.find((d) => d.id === id);
    if (!doc) return;

    const confirmed = confirm(`¿Cerrar y eliminar "${doc.title}"?`);
    if (confirmed) {
      documentStore.deleteDocument(id);
    }
  }

  // Vaciar todo
  function handleClearAll(): void {
    const confirmed = confirm(
      "¿Deseas vaciar todo el espacio de trabajo? Se cerrarán todos los archivos y carpetas y se creará uno nuevo en blanco.",
    );
    if (confirmed) {
      documentStore.clearAllDocuments();
    }
  }

  // --- Drag & Drop ---
  function onDragStart(e: DragEvent, docId: string): void {
    draggedDocId = docId;
    if (e.dataTransfer) {
      e.dataTransfer.setData("text/plain", docId);
      e.dataTransfer.effectAllowed = "move";
    }
  }

  function onDragOver(e: DragEvent, targetId: string): void {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    dragOverTargetId = targetId;
  }

  function onDragLeave(): void {
    dragOverTargetId = null;
  }

  function onDrop(e: DragEvent, targetFolderId: string | null): void {
    e.preventDefault();
    dragOverTargetId = null;
    const docId = draggedDocId || e.dataTransfer?.getData("text/plain");
    if (docId) {
      documentStore.moveDocumentToFolder(docId, targetFolderId);
    }
    draggedDocId = null;
  }

  function scrollToHeading(heading: TocHeading): void {
    const target = document.getElementById(heading.id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      closeIfMobile();
    }
  }

  // Formato exacto de fecha y tamaño como en el prototipo: "Nov 5, 12:01 AM · 11 B"
  function formatFileMeta(timestamp: number, sizeBytes: number): string {
    const d = new Date(timestamp);
    const monthNames = [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun",
      "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
    ];
    const month = monthNames[d.getMonth()];
    const day = d.getDate();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeStr = `${hours}:${minutes} ${ampm}`;

    let sizeStr = "";
    if (sizeBytes < 1024) {
      sizeStr = `${sizeBytes} B`;
    } else if (sizeBytes < 1024 * 1024) {
      sizeStr = `${(sizeBytes / 1024).toFixed(1)} KB`;
    } else {
      sizeStr = `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${month} ${day}, ${timeStr} · ${sizeStr}`;
  }
</script>

<svelte:window
  onclick={() => {
    activeDocMenuId = null;
  }}
/>

<aside
  class="sidebar"
  class:sidebar-open={isOpen}
  aria-label="Panel lateral de navegación"
>
  <!-- Encabezado del Sidebar con Icono para Ocultar a la Derecha -->
  <div class="sidebar-header">
    <div class="header-brand">
      <div class="brand-badge">
        <FileText size={16} />
      </div>
      <h2 class="sidebar-title">Markdown Studio</h2>
    </div>

    {#if onClose}
      <button
        type="button"
        class="toggle-sidebar-btn"
        onclick={onClose}
        title="Ocultar panel lateral (Ctrl+B)"
        aria-label="Ocultar panel lateral"
      >
        <PanelLeft size={18} />
      </button>
    {/if}
  </div>

  <!-- Pestañas de Navegación estilo Cápsula (Archivos / Índice) -->
  <div class="tabs-bar" role="tablist">
    <button
      type="button"
      class="tab-pill"
      class:active={activeTab === "docs"}
      onclick={() => (activeTab = "docs")}
      role="tab"
      aria-selected={activeTab === "docs"}
    >
      <Folder size={14} class="tab-icon" />
      <span>Archivos</span>
      <span class="pill-badge">{documentStore.documents.length}</span>
    </button>
    <button
      type="button"
      class="tab-pill"
      class:active={activeTab === "toc"}
      onclick={() => (activeTab = "toc")}
      role="tab"
      aria-selected={activeTab === "toc"}
    >
      <AlignLeft size={14} class="tab-icon" />
      <span>Índice</span>
      {#if tocHeadings.length > 0}
        <span class="pill-badge">{tocHeadings.length}</span>
      {/if}
    </button>
  </div>

  <!-- Contenido de Pestaña: Documentos y Carpetas -->
  {#if activeTab === "docs"}
    <div class="sidebar-section">
      <!-- Fila de Acciones: Botón Principal Azul + Botón Carpeta + Botón Subir -->
      <div class="quick-actions-bar">
        <button
          type="button"
          class="btn-new-doc"
          onclick={handleCreateRootDoc}
          title="Crear nuevo documento Markdown"
        >
          <Plus size={16} />
          <span>Nuevo documento</span>
        </button>

        <button
          type="button"
          class="btn-action-square"
          onclick={handleCreateFolder}
          title="Crear nueva carpeta"
          aria-label="Crear nueva carpeta"
        >
          <FolderPlus size={16} />
        </button>

        <button
          type="button"
          class="btn-action-square"
          onclick={handleTriggerOpen}
          title="Abrir archivo .md del equipo"
          aria-label="Abrir archivo desde equipo"
        >
          <Upload size={16} />
        </button>
      </div>

      <input
        type="file"
        accept=".md,.markdown,.txt"
        bind:this={fileInputElement}
        onchange={handleFileInputChange}
        style="display: none;"
        aria-hidden="true"
      />

      <!-- Barra de Búsqueda (sin atajo ctrl+k) -->
      <div class="search-box-wrap">
        <div class="search-box" class:has-focus={isSearching}>
          <Search size={15} class="search-icon" />
          <input
            type="text"
            placeholder="Buscar documentos..."
            bind:value={searchQuery}
            class="search-input"
            aria-label="Buscar en títulos y contenido"
          />
          {#if searchQuery}
            <button
              type="button"
              class="clear-search-btn"
              onclick={() => (searchQuery = "")}
              aria-label="Limpiar búsqueda"
            >
              <X size={13} />
            </button>
          {/if}
        </div>
      </div>

      <!-- Árbol de Carpetas y Archivos -->
      <div class="file-tree-container">
        <!-- Estado sin coincidencias en búsqueda -->
        {#if isSearching && totalResultsCount === 0}
          <div class="empty-search-state">
            <p class="empty-search-text">Sin resultados para "{searchQuery}"</p>
          </div>
        {:else}
          <!-- 1. Listado de Carpetas (se oculta si no hay carpetas o si ninguna coincide en búsqueda) -->
          {#if visibleFolders.length > 0}
            <div class="folders-group">
              <div class="group-header">
                <span class="group-title">CARPETAS</span>
                <span class="group-count">{visibleFolders.length}</span>
              </div>

              {#each visibleFolders as folder (folder.id)}
                {@const folderDocs = getDocsForFolder(folder.id)}
                {@const isDropTarget = dragOverTargetId === folder.id}
                {@const isExpanded = isSearching ? true : folder.isExpanded}

                <div
                  class="folder-item"
                  class:drop-target={isDropTarget}
                  ondragover={(e) => onDragOver(e, folder.id)}
                  ondragleave={onDragLeave}
                  ondrop={(e) => onDrop(e, folder.id)}
                  role="group"
                >
                  <!-- Fila de la Carpeta -->
                  <div
                    class="folder-row"
                    onclick={() => documentStore.toggleFolderExpanded(folder.id)}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        documentStore.toggleFolderExpanded(folder.id);
                      }
                    }}
                  >
                    <button
                      type="button"
                      class="folder-toggle-btn"
                      aria-label={isExpanded ? "Colapsar carpeta" : "Expandir carpeta"}
                      tabindex="-1"
                    >
                      {#if isExpanded}
                        <ChevronDown size={14} />
                      {:else}
                        <ChevronRight size={14} />
                      {/if}
                    </button>

                    <!-- Icono de Carpeta Ámbar Dorado (#eab308) -->
                    <FolderIcon
                      hasFiles={folderDocs.length > 0}
                      isOpen={isExpanded}
                      size={18}
                    />

                    {#if editingFolderId === folder.id}
                      <div
                        class="inline-edit-wrapper"
                        role="presentation"
                        onclick={(e) => e.stopPropagation()}
                        onkeydown={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          bind:value={editingFolderName}
                          class="inline-edit-input"
                          onblur={() => commitFolderName(folder.id)}
                          onkeydown={(e) => handleFolderInputKeyDown(folder.id, e)}
                          use:focusOnMount
                        />
                        <button
                          type="button"
                          class="inline-save-btn"
                          onclick={() => commitFolderName(folder.id)}
                          title="Guardar nombre"
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    {:else}
                      <span
                        class="folder-name"
                        title={folder.name}
                        role="button"
                        tabindex="0"
                        ondblclick={(e) => startRenamingFolder(folder, e)}
                        onkeydown={(e) => {
                          if (e.key === "F2") startRenamingFolder(folder, e as unknown as MouseEvent);
                        }}
                      >
                        {folder.name}
                      </span>
                      <span class="folder-doc-count">{folderDocs.length}</span>
                    {/if}

                    <!-- Acciones rápidas en hover para la carpeta -->
                    <div
                      class="folder-actions"
                      role="presentation"
                      onclick={(e) => e.stopPropagation()}
                      onkeydown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        class="folder-action-btn"
                        title="Crear nuevo archivo .md en esta carpeta"
                        onclick={(e) => handleCreateDocInFolder(folder.id, e)}
                      >
                        <Plus size={13} />
                      </button>
                      <button
                        type="button"
                        class="folder-action-btn"
                        title="Cambiar nombre de la carpeta"
                        onclick={(e) => startRenamingFolder(folder, e)}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        class="folder-action-btn danger"
                        title="Eliminar carpeta"
                        onclick={(e) => handleDeleteFolder(folder.id, e)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <!-- Contenido de la carpeta si está expandida -->
                  {#if isExpanded}
                    <div class="folder-children">
                      {#if folderDocs.length === 0}
                        <div class="empty-folder-label">
                          <span>Carpeta vacía</span>
                        </div>
                      {:else}
                        {#each folderDocs as doc (doc.id)}
                          {@const isActive = doc.id === documentStore.activeId}
                          {@const docSize = new Blob([doc.content]).size}

                          <div
                            class="doc-item nested-doc"
                            class:active={isActive}
                            draggable="true"
                            ondragstart={(e) => onDragStart(e, doc.id)}
                            onclick={() => {
                              documentStore.selectDocument(doc.id);
                              closeIfMobile();
                            }}
                            role="button"
                            tabindex="0"
                            onkeydown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                documentStore.selectDocument(doc.id);
                                closeIfMobile();
                              }
                            }}
                          >
                            <div class="doc-icon">
                              <FileText size={15} />
                            </div>

                            <div class="doc-info">
                              {#if editingDocId === doc.id}
                                <div
                                  class="inline-edit-wrapper"
                                  role="presentation"
                                  onclick={(e) => e.stopPropagation()}
                                  onkeydown={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="text"
                                    bind:value={editingDocTitle}
                                    class="inline-edit-input"
                                    onblur={() => commitDocTitle(doc.id)}
                                    onkeydown={(e) => handleDocInputKeyDown(doc.id, e)}
                                    use:focusOnMount
                                  />
                                  <button
                                    type="button"
                                    class="inline-save-btn"
                                    onclick={() => commitDocTitle(doc.id)}
                                    title="Guardar nombre"
                                  >
                                    <Check size={12} />
                                  </button>
                                </div>
                              {:else}
                                <span
                                  class="doc-title"
                                  title={doc.title}
                                  role="button"
                                  tabindex="0"
                                  ondblclick={(e) => startRenamingDoc(doc.id, doc.title, e)}
                                  onkeydown={(e) => {
                                    if (e.key === "F2") startRenamingDoc(doc.id, doc.title, e as unknown as MouseEvent);
                                  }}
                                >
                                  {doc.title}
                                </span>
                                <div class="doc-meta">
                                  <span>{formatFileMeta(doc.updatedAt, docSize)}</span>
                                </div>
                              {/if}
                            </div>

                            <!-- Acciones de documento: 3 puntos -->
                            <div
                              class="doc-actions"
                              role="presentation"
                              onclick={(e) => e.stopPropagation()}
                              onkeydown={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                class="doc-action-btn"
                                title="Opciones del archivo"
                                aria-label="Opciones del archivo"
                                onclick={(e) => toggleDocMenu(doc.id, e)}
                              >
                                <MoreVertical size={14} />
                              </button>
                            </div>

                            <!-- Menú flotante de 3 puntos -->
                            {#if activeDocMenuId === doc.id}
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
                                  onclick={(e) => startRenamingDoc(doc.id, doc.title, e)}
                                >
                                  <Pencil size={13} />
                                  <span>Cambiar nombre</span>
                                </button>

                                <div class="menu-separator"></div>

                                <div class="menu-section-header">Mover a:</div>
                                <button
                                  type="button"
                                  class="menu-item-btn"
                                  role="menuitem"
                                  onclick={() => handleMoveDoc(doc.id, null)}
                                >
                                  <FolderSync size={13} />
                                  <span>Raíz (Sin carpeta)</span>
                                </button>
                                {#each documentStore.folders as targetF}
                                  {#if targetF.id !== folder.id}
                                    <button
                                      type="button"
                                      class="menu-item-btn"
                                      role="menuitem"
                                      onclick={() => handleMoveDoc(doc.id, targetF.id)}
                                    >
                                      <FolderIcon size={14} />
                                      <span>{targetF.name}</span>
                                    </button>
                                  {/if}
                                {/each}

                                <div class="menu-separator"></div>

                                <button
                                  type="button"
                                  class="menu-item-btn danger"
                                  role="menuitem"
                                  onclick={(e) => handleDeleteDoc(doc.id, e)}
                                >
                                  <Trash2 size={13} />
                                  <span>Eliminar</span>
                                </button>
                              </div>
                            {/if}
                          </div>
                        {/each}
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          <!-- 2. Archivos en la Raíz (se oculta si no hay archivos coincidentes) -->
          {#if visibleRootDocs.length > 0}
            <div
              class="root-docs-group"
              class:drop-target={dragOverTargetId === "root"}
              ondragover={(e) => onDragOver(e, "root")}
              ondragleave={onDragLeave}
              ondrop={(e) => onDrop(e, null)}
              role="region"
              aria-label="Archivos"
            >
              <div class="group-header">
                <span class="group-title">ARCHIVOS</span>
                <span class="group-count">{visibleRootDocs.length}</span>
              </div>

              {#each visibleRootDocs as doc (doc.id)}
                {@const isActive = doc.id === documentStore.activeId}
                {@const docSize = new Blob([doc.content]).size}

                <div
                  class="doc-item"
                  class:active={isActive}
                  draggable="true"
                  ondragstart={(e) => onDragStart(e, doc.id)}
                  onclick={() => {
                    documentStore.selectDocument(doc.id);
                    closeIfMobile();
                  }}
                  role="button"
                  tabindex="0"
                  onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      documentStore.selectDocument(doc.id);
                      closeIfMobile();
                    }
                  }}
                >
                  <div class="doc-icon">
                    <FileText size={15} />
                  </div>

                  <div class="doc-info">
                    {#if editingDocId === doc.id}
                      <div
                        class="inline-edit-wrapper"
                        role="presentation"
                        onclick={(e) => e.stopPropagation()}
                        onkeydown={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          bind:value={editingDocTitle}
                          class="inline-edit-input"
                          onblur={() => commitDocTitle(doc.id)}
                          onkeydown={(e) => handleDocInputKeyDown(doc.id, e)}
                          use:focusOnMount
                        />
                        <button
                          type="button"
                          class="inline-save-btn"
                          onclick={() => commitDocTitle(doc.id)}
                          title="Guardar nombre"
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    {:else}
                      <span
                        class="doc-title"
                        title={doc.title}
                        role="button"
                        tabindex="0"
                        ondblclick={(e) => startRenamingDoc(doc.id, doc.title, e)}
                        onkeydown={(e) => {
                          if (e.key === "F2") startRenamingDoc(doc.id, doc.title, e as unknown as MouseEvent);
                        }}
                      >
                        {doc.title}
                      </span>
                      <div class="doc-meta">
                        <span>{formatFileMeta(doc.updatedAt, docSize)}</span>
                      </div>
                    {/if}
                  </div>

                  <!-- Acciones de Documento: 3 puntos -->
                  <div
                    class="doc-actions"
                    role="presentation"
                    onclick={(e) => e.stopPropagation()}
                    onkeydown={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      class="doc-action-btn"
                      title="Opciones del archivo"
                      aria-label="Opciones del archivo"
                      onclick={(e) => toggleDocMenu(doc.id, e)}
                    >
                      <MoreVertical size={14} />
                    </button>
                  </div>

                  <!-- Menú flotante de 3 puntos -->
                  {#if activeDocMenuId === doc.id}
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
                        onclick={(e) => startRenamingDoc(doc.id, doc.title, e)}
                      >
                        <Pencil size={13} />
                        <span>Cambiar nombre</span>
                      </button>

                      {#if documentStore.folders.length > 0}
                        <div class="menu-separator"></div>
                        <div class="menu-section-header">Mover a:</div>
                        {#each documentStore.folders as targetF}
                          <button
                            type="button"
                            class="menu-item-btn"
                            role="menuitem"
                            onclick={() => handleMoveDoc(doc.id, targetF.id)}
                          >
                            <FolderIcon size={14} />
                            <span>{targetF.name}</span>
                          </button>
                        {/each}
                      {/if}

                      <div class="menu-separator"></div>

                      <button
                        type="button"
                        class="menu-item-btn danger"
                        role="menuitem"
                        onclick={(e) => handleDeleteDoc(doc.id, e)}
                      >
                        <Trash2 size={13} />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>

      <!-- Pie de página discreto con opción de vaciar todo -->
      {#if !isSearching}
        <div class="sidebar-footer">
          <button
            type="button"
            class="clear-all-btn"
            onclick={handleClearAll}
            title="Elimina todos los archivos y carpetas locales"
          >
            <Trash2 size={13} />
            <span>Vaciar todo</span>
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <!-- Contenido de Pestaña: Tabla de Contenidos (TOC) -->
    <div class="sidebar-section toc-section">
      {#if tocHeadings.length === 0}
        <div class="empty-toc">
          <FileText size={28} class="empty-icon" />
          <p class="empty-title">Sin encabezados</p>
          <p class="empty-desc">
            Agrega títulos (# H1, ## H2) en el editor para generar el índice automático.
          </p>
        </div>
      {:else}
        <nav class="toc-list" aria-label="Tabla de contenidos del documento">
          {#each tocHeadings as heading}
            <button
              type="button"
              class="toc-item level-{heading.level}"
              onclick={() => scrollToHeading(heading)}
              title={heading.text}
            >
              <span class="toc-bullet">•</span>
              <span class="toc-text">{heading.text}</span>
            </button>
          {/each}
        </nav>
      {/if}
    </div>
  {/if}
</aside>

<style>
  .sidebar {
    width: 290px;
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: var(--color-bg-sidebar, #16181d);
    border-right: 1px solid var(--color-border-subtle, #212429);
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

  /* Ocultar en escritorio cuando isOpen es false */
  .sidebar:not(.sidebar-open) {
    width: 0;
    border-right: none;
    pointer-events: none;
    visibility: hidden;
  }

  /* Encabezado */
  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 12px 16px;
    min-width: 290px;
  }

  .header-brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .brand-badge {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  }

  .sidebar-title {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--color-text-primary, #f8fafc);
    margin: 0;
  }

  /* Botón con icono de Sidebar a la derecha */
  .toggle-sidebar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: var(--color-text-muted, #94a3b8);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toggle-sidebar-btn:hover {
    background: var(--color-surface-hover, #23272f);
    color: var(--color-text-primary, #f8fafc);
  }

  /* Pestañas Cápsula */
  .tabs-bar {
    display: flex;
    padding: 3px;
    margin: 0 14px 12px 14px;
    background: var(--color-bg-base, #1b1e24);
    border-radius: 9px;
    border: 1px solid var(--color-border-subtle, #23272f);
    min-width: 262px;
  }

  .tab-pill {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 6px 10px;
    background: transparent;
    border: none;
    border-radius: 7px;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--color-text-muted, #94a3b8);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .tab-pill:hover {
    color: var(--color-text-secondary, #cbd5e1);
  }

  .tab-pill.active {
    background: var(--color-surface-panel, #282c35);
    color: var(--color-text-primary, #ffffff);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  }

  :global(.tab-icon) {
    flex-shrink: 0;
    opacity: 0.9;
  }

  .pill-badge {
    font-size: 11px;
    font-weight: 500;
    padding: 0 6px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-text-muted, #94a3b8);
  }

  .tab-pill.active .pill-badge {
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
  }

  /* Fila de Creación de Archivos */
  .sidebar-section {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    min-width: 290px;
  }

  .quick-actions-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px 10px 14px;
  }

  .btn-new-doc {
    flex: 1;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 14px;
    border-radius: 8px;
    background: #3b82f6;
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: background-color 0.15s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  }

  .btn-new-doc:hover {
    background: #2563eb;
  }

  .btn-action-square {
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #202328;
    border: 1px solid #2b3038;
    border-radius: 8px;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
    padding: 0;
  }

  .btn-action-square:hover {
    background: #282c33;
    border-color: #3f4652;
    color: #ffffff;
  }

  /* Barra de Búsqueda */
  .search-box-wrap {
    padding: 0 14px 14px 14px;
  }

  .search-box {
    display: flex;
    align-items: center;
    padding: 0 12px;
    height: 38px;
    background: #181b20;
    border: 1px solid #282d35;
    border-radius: 8px;
    position: relative;
    transition: all 0.15s ease;
  }

  .search-box.has-focus,
  .search-box:focus-within {
    border-color: #3b82f6;
    box-shadow: 0 0 0 1.5px #3b82f6;
    background: #1b1e24;
  }

  :global(.search-icon) {
    color: #64748b;
    margin-right: 8px;
    flex-shrink: 0;
  }

  .search-input {
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    color: #f1f5f9;
    font-size: 13px;
    font-family: inherit;
  }

  .search-input::placeholder {
    color: #64748b;
  }

  .clear-search-btn {
    background: transparent;
    border: none;
    color: #64748b;
    padding: 2px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .clear-search-btn:hover {
    color: #f1f5f9;
  }

  /* Mensaje cuando no hay resultados de búsqueda */
  .empty-search-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 56px 16px;
    text-align: center;
  }

  .empty-search-text {
    font-size: 13px;
    color: #64748b;
    margin: 0;
  }

  /* Árbol de Carpetas y Archivos */
  .file-tree-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 8px 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Encabezados de grupo */
  .group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 10px 6px 10px;
  }

  .group-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
  }

  .group-count {
    font-size: 11px;
    font-weight: 500;
    color: #64748b;
  }

  /* Carpeta */
  .folder-item {
    border-radius: 8px;
    transition: background 0.15s ease, border-color 0.15s ease;
    border: 1px solid transparent;
  }

  .folder-item.drop-target {
    border: 1px dashed #3b82f6;
    background: rgba(59, 130, 246, 0.08);
  }

  .folder-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    color: #e2e8f0;
    font-size: 13px;
    font-weight: 500;
    position: relative;
    transition: background 0.12s ease;
  }

  .folder-row:hover {
    background: #1e2127;
  }

  .folder-toggle-btn {
    background: transparent;
    border: none;
    color: #64748b;
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
    font: inherit;
  }

  .folder-doc-count {
    font-size: 11px;
    color: #64748b;
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

  .folder-action-btn {
    width: 20px;
    height: 20px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
  }

  .folder-action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #f1f5f9;
  }

  .folder-action-btn.danger:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  /* Sangría y línea guía vertical */
  .folder-children {
    margin-left: 17px;
    border-left: 1px solid #272a31;
    padding-left: 8px;
    margin-top: 2px;
    margin-bottom: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .empty-folder-label {
    padding: 6px 10px;
    font-size: 12px;
    color: #64748b;
  }

  /* Documentos */
  .root-docs-group {
    border-radius: 8px;
    border: 1px solid transparent;
    transition: all 0.15s ease;
  }

  .root-docs-group.drop-target {
    border: 1px dashed #3b82f6;
    background: rgba(59, 130, 246, 0.08);
  }

  .doc-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 10px;
    border-radius: 8px;
    cursor: pointer;
    background: transparent;
    border: 1px solid transparent;
    transition: all 0.12s ease;
  }

  .doc-item:hover {
    background: #1b1e24;
  }

  /* Documento Activo: fondo azul pizarra oscuro */
  .doc-item.active {
    background-color: #1e293b;
    border-color: rgba(59, 130, 246, 0.3);
  }

  .doc-icon {
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .doc-item.active .doc-icon {
    color: #60a5fa;
  }

  .doc-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .doc-title {
    font-size: 13px;
    font-weight: 500;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
    background: transparent;
    border: none;
    padding: 0;
    font: inherit;
  }

  .doc-item.active .doc-title {
    color: #ffffff;
    font-weight: 600;
  }

  .doc-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #64748b;
  }

  .doc-actions {
    display: none;
    align-items: center;
  }

  .doc-item:hover .doc-actions,
  .doc-item.active .doc-actions {
    display: flex;
  }

  .doc-action-btn {
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    transition: all 0.12s ease;
  }

  .doc-action-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
  }

  /* Edición en línea */
  .inline-edit-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
  }

  .inline-edit-input {
    flex: 1;
    font-size: 12px;
    padding: 2px 6px;
    background: #121418;
    border: 1px solid #3b82f6;
    border-radius: 4px;
    color: #ffffff;
    outline: none;
  }

  .inline-save-btn {
    background: #3b82f6;
    border: none;
    color: white;
    border-radius: 4px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  /* Menú flotante de 3 puntos */
  .doc-context-menu {
    position: absolute;
    right: 8px;
    top: 30px;
    background: #1e2229;
    border: 1px solid #2e3440;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
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
    color: #64748b;
    padding: 4px 8px;
  }

  .menu-separator {
    height: 1px;
    background: #2b303c;
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
    color: #cbd5e1;
    font-size: 12px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: all 0.12s ease;
  }

  .menu-item-btn:hover {
    background: #3b82f6;
    color: #ffffff;
  }

  .menu-item-btn.danger {
    color: #f87171;
  }

  .menu-item-btn.danger:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  /* Footer */
  .sidebar-footer {
    padding: 8px 14px;
    border-top: 1px solid #212429;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-width: 290px;
  }

  .clear-all-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    background: transparent;
    border: none;
    border-radius: 4px;
    font-size: 11.5px;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .clear-all-btn:hover {
    background: rgba(239, 68, 68, 0.12);
    color: #ef4444;
  }

  /* TOC */
  .toc-section {
    padding: 8px 14px;
    overflow-y: auto;
  }

  .empty-toc {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 16px;
    text-align: center;
    color: #64748b;
  }

  :global(.empty-icon) {
    margin-bottom: 8px;
    opacity: 0.4;
  }

  .empty-title {
    font-size: 13px;
    font-weight: 600;
    color: #94a3b8;
    margin: 0 0 4px 0;
  }

  .empty-desc {
    font-size: 11.5px;
    line-height: 1.4;
    margin: 0;
  }

  .toc-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .toc-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border: none;
    background: transparent;
    border-radius: 4px;
    color: #94a3b8;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .toc-item:hover {
    background: #1e2127;
    color: #ffffff;
  }

  .toc-item.level-1 {
    font-weight: 600;
  }

  .toc-item.level-2 {
    padding-left: 16px;
    font-size: 11.5px;
  }

  .toc-item.level-3 {
    padding-left: 24px;
    font-size: 11px;
    color: #64748b;
  }

  .toc-item.level-4,
  .toc-item.level-5,
  .toc-item.level-6 {
    padding-left: 32px;
    font-size: 10.5px;
    color: #64748b;
  }

  .toc-bullet {
    font-size: 12px;
    opacity: 0.5;
  }

  .toc-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Responsivo Tablet y Móvil / Drawer por encima de todo */
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
