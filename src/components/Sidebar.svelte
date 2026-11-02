<script lang="ts">
  /**
   * Componente Sidebar de MD Studio.
   * Gestión completa de documentos (Nuevo, Abrir local, Buscar, Eliminar, Vaciar todo)
   * y navegación por Tabla de Contenidos (TOC).
   */
  import {
    FileText,
    FolderOpen,
    List,
    Plus,
    Search,
    Trash2,
    X,
  } from "lucide-svelte";
  import { documentStore } from "../stores/documents.svelte";
  import type { TocHeading } from "../types";

  interface Props {
    isOpen: boolean;
    onClose?: () => void;
  }

  let { isOpen, onClose }: Props = $props();

  let activeTab = $state<"docs" | "toc">("docs");
  let searchQuery = $state("");
  let fileInputElement = $state<HTMLInputElement | null>(null);

  const filteredDocs = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return documentStore.documents;
    return documentStore.documents.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.content.toLowerCase().includes(q),
    );
  });

  const tocHeadings = $derived(documentStore.tocHeadings);

  function closeIfMobile(): void {
    if (typeof window !== "undefined" && window.innerWidth <= 768 && onClose) {
      onClose();
    }
  }

  function handleCreateDoc(): void {
    const count = documentStore.documents.length + 1;
    documentStore.createDocument(
      `documento-${count}.md`,
      `# Documento ${count}\n\n`,
    );
    activeTab = "docs";
    closeIfMobile();
  }

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

  function handleDeleteDoc(id: string, e: MouseEvent): void {
    e.stopPropagation();
    const doc = documentStore.documents.find((d) => d.id === id);
    if (!doc) return;

    const confirmed = confirm(`¿Cerrar y eliminar "${doc.title}"?`);
    if (confirmed) {
      documentStore.deleteDocument(id);
    }
  }

  function handleClearAll(): void {
    const confirmed = confirm(
      "¿Deseas vaciar todo el historial? Se cerrarán todos los archivos y se creará uno nuevo en blanco.",
    );
    if (confirmed) {
      documentStore.clearAllDocuments();
    }
  }

  function scrollToHeading(heading: TocHeading): void {
    const target = document.getElementById(heading.id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    closeIfMobile();
  }

  function formatMeta(doc: { updatedAt: number; content: string }): string {
    const dateStr = new Date(doc.updatedAt).toLocaleString("es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const sizeKb = (new Blob([doc.content]).size / 1024).toFixed(1);
    return `${dateStr} · ${sizeKb} KB`;
  }
</script>

<!-- Input oculto para abrir archivos locales -->
<input
  type="file"
  accept=".md,.markdown,.txt"
  class="hidden-file-input"
  bind:this={fileInputElement}
  onchange={handleFileInputChange}
/>

{#if isOpen}
  <!-- Backdrop oscuro con blur para cerrar el panel al pulsar fuera en móviles -->
  <div
    class="sidebar-backdrop no-print"
    onclick={onClose}
    role="presentation"
    aria-hidden="true"
  ></div>
{/if}

<aside class="studio-sidebar no-print" class:open={isOpen}>
  <!-- Cabecera de la Barra Lateral -->
  <div class="sidebar-header">
    <div class="brand">
      <img
        src="/md-studio-icon-64.png"
        alt="MD Studio Logo"
        class="brand-logo"
        width="22"
        height="22"
      />
      <span class="brand-name">Markdown Studio</span>
    </div>
    {#if onClose}
      <button
        type="button"
        class="icon-btn"
        onclick={onClose}
        title="Ocultar panel lateral"
        aria-label="Ocultar panel lateral"
      >
        <X size={16} />
      </button>
    {/if}
  </div>

  <!-- Pestañas Documentos vs Índice -->
  <div class="sidebar-tabs" role="tablist">
    <button
      type="button"
      class="tab-btn"
      class:active={activeTab === "docs"}
      onclick={() => (activeTab = "docs")}
      role="tab"
    >
      <FileText size={14} />
      <span>Documentos ({documentStore.documents.length})</span>
    </button>
    <button
      type="button"
      class="tab-btn"
      class:active={activeTab === "toc"}
      onclick={() => (activeTab = "toc")}
      role="tab"
    >
      <List size={14} />
      <span>Índice ({tocHeadings.length})</span>
    </button>
  </div>

  {#if activeTab === "docs"}
    <div class="tab-panel">
      <!-- Acciones: Nuevo y Abrir -->
      <div class="side-actions-row">
        <button
          type="button"
          class="action-btn"
          onclick={handleCreateDoc}
          title="Crear un nuevo documento"
        >
          <Plus size={14} />
          <span>Nuevo</span>
        </button>
        <button
          type="button"
          class="action-btn"
          onclick={handleTriggerOpen}
          title="Abrir un archivo .md local"
        >
          <FolderOpen size={14} />
          <span>Abrir</span>
        </button>
      </div>

      <!-- Barra de búsqueda -->
      <div class="search-box">
        <Search size={14} class="search-icon" />
        <input
          type="text"
          placeholder="Buscar documento..."
          bind:value={searchQuery}
          class="search-input"
        />
        {#if searchQuery}
          <button
            type="button"
            class="clear-btn"
            onclick={() => (searchQuery = "")}
            aria-label="Limpiar búsqueda"
          >
            <X size={12} />
          </button>
        {/if}
      </div>

      <!-- Lista de Historial de Documentos -->
      <div class="doc-list">
        {#if filteredDocs.length === 0}
          <p class="empty-hint">No hay documentos que coincidan.</p>
        {:else}
          {#each filteredDocs as doc (doc.id)}
            <div
              class="doc-item"
              class:active={doc.id === documentStore.activeId}
              onclick={() => {
                documentStore.selectDocument(doc.id);
                closeIfMobile();
              }}
              role="button"
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === "Enter") {
                  documentStore.selectDocument(doc.id);
                  closeIfMobile();
                }
              }}
            >
              <div class="doc-info">
                <div class="doc-title" title={doc.title}>{doc.title}</div>
                <div class="doc-meta">{formatMeta(doc)}</div>
              </div>
              <button
                type="button"
                class="delete-btn"
                onclick={(e) => handleDeleteDoc(doc.id, e)}
                title="Cerrar y eliminar este archivo"
                aria-label={`Eliminar ${doc.title}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Pie de lista: Vaciar todo -->
      <div class="sidebar-footer">
        <button
          type="button"
          class="clear-all-btn"
          onclick={handleClearAll}
          title="Eliminar todos los archivos y crear uno en blanco"
        >
          Vaciar todo
        </button>
      </div>
    </div>
  {:else}
    <!-- Panel de Tabla de Contenidos (TOC) -->
    <div class="tab-panel">
      <div class="toc-list">
        {#if tocHeadings.length === 0}
          <p class="empty-hint">
            Los encabezados (#, ##) de tu documento aparecerán aquí.
          </p>
        {:else}
          {#each tocHeadings as heading (heading.id)}
            <button
              type="button"
              class="toc-item level-{heading.level}"
              onclick={() => scrollToHeading(heading)}
              title={heading.text}
            >
              <span class="toc-text">{heading.text}</span>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</aside>

<style>
  .hidden-file-input {
    display: none;
  }

  .studio-sidebar {
    width: 280px;
    min-width: 280px;
    height: 100%;
    background-color: var(--bg-surface, #1a1b1d);
    border-right: 1px solid var(--border-color, #2b2d31);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    user-select: none;
    transition: margin-left 0.22s ease-in-out;
    z-index: 30;
  }

  .studio-sidebar:not(.open) {
    margin-left: -280px;
  }

  .sidebar-header {
    height: 52px;
    padding: 0 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border-color, #2b2d31);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .brand-logo {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    object-fit: contain;
    flex-shrink: 0;
    display: block;
  }

  .brand-name {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-primary, #e8e6e1);
  }

  .icon-btn {
    border: none;
    background: transparent;
    color: var(--text-secondary, #9b9a94);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
  }

  .icon-btn:hover {
    color: var(--text-primary, #e8e6e1);
  }

  /* Pestañas */
  .sidebar-tabs {
    display: flex;
    padding: 6px 10px;
    background-color: var(--bg-surface, #1a1b1d);
    border-bottom: 1px solid var(--border-subtle, #232427);
    gap: 4px;
  }

  .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: none;
    background: transparent;
    color: var(--text-secondary, #9b9a94);
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 0.775rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;
  }

  .tab-btn:hover {
    color: var(--text-primary, #e8e6e1);
  }

  .tab-btn.active {
    background-color: var(--bg-elevated, #26282b);
    color: var(--accent-color, #5fb3a3);
    font-weight: 600;
  }

  .tab-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Acciones: Nuevo y Abrir */
  .side-actions-row {
    padding: 10px 10px 6px;
    display: flex;
    gap: 8px;
  }

  .action-btn {
    flex: 1;
    border: 1px solid var(--border-color, #2b2d31);
    background-color: var(--bg-elevated, #26282b);
    color: var(--text-primary, #e8e6e1);
    padding: 6px 10px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .action-btn:hover {
    background-color: var(--bg-hover, #2e3034);
    border-color: var(--accent-color, #5fb3a3);
  }

  /* Búsqueda */
  .search-box {
    margin: 6px 10px;
    position: relative;
    display: flex;
    align-items: center;
  }

  :global(.search-icon) {
    position: absolute;
    left: 8px;
    color: var(--text-faint, #6f6e69);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 6px 26px 6px 28px;
    font-size: 0.8rem;
    background-color: var(--bg-app, #151617);
    border: 1px solid var(--border-color, #2b2d31);
    border-radius: 6px;
    color: var(--text-primary, #e8e6e1);
    outline: none;
    font-family: inherit;
  }

  .search-input:focus {
    border-color: var(--accent-color, #5fb3a3);
  }

  .clear-btn {
    position: absolute;
    right: 6px;
    border: none;
    background: transparent;
    color: var(--text-secondary, #9b9a94);
    cursor: pointer;
    padding: 2px;
  }

  /* Lista de documentos */
  .doc-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 6px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .doc-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    border: 1px solid transparent;
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease;
  }

  .doc-item:hover {
    background-color: var(--bg-hover, #2e3034);
  }

  .doc-item.active {
    background-color: var(--bg-elevated, #26282b);
    border-color: var(--border-color, #2b2d31);
  }

  .doc-info {
    flex: 1;
    min-width: 0;
  }

  .doc-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary, #e8e6e1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .doc-item.active .doc-title {
    color: var(--accent-color, #5fb3a3);
  }

  .doc-meta {
    font-size: 0.7rem;
    color: var(--text-secondary, #9b9a94);
    margin-top: 2px;
  }

  .delete-btn {
    opacity: 0;
    border: none;
    background: transparent;
    color: var(--text-secondary, #9b9a94);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition:
      opacity 0.15s ease,
      color 0.15s ease;
  }

  .doc-item:hover .delete-btn {
    opacity: 0.8;
  }

  .delete-btn:hover {
    opacity: 1;
    color: var(--danger-color, #e5736a);
  }

  /* Pie de barra lateral */
  .sidebar-footer {
    padding: 8px 10px;
    border-top: 1px solid var(--border-subtle, #232427);
    display: flex;
    justify-content: center;
  }

  .clear-all-btn {
    border: none;
    background: transparent;
    color: var(--danger-color, #e5736a);
    font-size: 0.775rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background-color 0.15s ease;
  }

  .clear-all-btn:hover {
    background-color: rgba(229, 115, 106, 0.1);
  }

  /* Índice (TOC) */
  .toc-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .toc-item {
    border: none;
    background: transparent;
    text-align: left;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 0.8rem;
    color: var(--text-secondary, #9b9a94);
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;
  }

  .toc-item:hover {
    background-color: var(--bg-hover, #2e3034);
    color: var(--text-primary, #e8e6e1);
  }

  .toc-item.level-1 {
    font-weight: 600;
    color: var(--text-primary, #e8e6e1);
    padding-left: 8px;
  }

  .toc-item.level-2 {
    padding-left: 18px;
  }

  .toc-item.level-3 {
    padding-left: 28px;
    font-size: 0.75rem;
  }

  .toc-item.level-4,
  .toc-item.level-5,
  .toc-item.level-6 {
    padding-left: 36px;
    font-size: 0.725rem;
  }

  .empty-hint {
    padding: 2rem 1rem;
    text-align: center;
    color: var(--text-faint, #6f6e69);
    font-size: 0.8rem;
  }

  /* Backdrop oscuro para móviles */
  .sidebar-backdrop {
    display: none;
  }

  @media (max-width: 768px) {
    .sidebar-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      background-color: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      z-index: 85;
      animation: fadeInBackdrop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes fadeInBackdrop {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .studio-sidebar {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      bottom: 0 !important;
      width: min(300px, 86vw) !important;
      min-width: unset !important;
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.45) !important;
      z-index: 90 !important;
      margin-left: 0 !important;
      transform: translateX(0) !important;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
      padding-top: env(safe-area-inset-top, 0px);
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }

    .studio-sidebar:not(.open) {
      transform: translateX(-100%) !important;
      margin-left: 0 !important;
      pointer-events: none !important;
    }

    .doc-item {
      min-height: 48px;
      padding: 10px 12px;
    }

    .tab-btn {
      min-height: 38px;
    }

    .tool-btn {
      min-height: 36px;
    }
  }
</style>
