/**
 * ES: Store de documentos, carpetas, índice y persistencia local.
 * EN: Store for documents, folders, headings, and local persistence.
 */

import {
  extractFirstH1,
  extractHeadings,
  normalizeDocTitle,
  toggleMarkdownTaskAtIndex,
} from "../../core/markdown/markdownUtils";
import { indexedDbAdapter } from "../../core/storage/indexedDbAdapter";
import { getDraftKey } from "../../core/storage/documentRecords";
import {
  writeActiveDocumentCache,
  writeActiveDocumentId,
} from "../../core/storage/localCache";
import type { StorageAdapter } from "../../core/storage/storagePort";
import { generateId } from "../../shared/utils/formatters";
import type {
  DocumentItem,
  DocumentVersion,
  SaveFileHandle,
  RecoveryDraft,
  FolderItem,
  FontSize,
  Settings,
  ThemeMode,
  TocHeading,
  ViewMode,
} from "../../core/types";
import { ManualSave, type SaveEnvironment } from "./manualSave.svelte";
import { VaultPersistence } from "./vaultPersistence.svelte";
import { settingsStore } from "../settings/settingsStore.svelte";
import { deleteWorkspaceDrafts, renameWorkspaceDrafts } from "./workspaceDraftSync";
import type { DirectoryHandle } from "../../core/storage/workspacePort";

export { extractFirstH1, extractHeadings };

export class DocumentStore {
  documents = $state<DocumentItem[]>([]);
  folders = $state<FolderItem[]>([]);
  activeId = $state<string>("");
  tocHeadings = $state<TocHeading[]>([]);
  recoveryCandidate = $state<RecoveryDraft | null>(null);
  versions = $state<Record<string, DocumentVersion>>({});
  recoveries = $state<Record<string, RecoveryDraft>>({});

  fileSave: ManualSave;
  storage: StorageAdapter;
  persistence: VaultPersistence;
  workspaceMutation = $state(false);
  private initialization: Promise<void> | null = null;

  constructor(storage: StorageAdapter = indexedDbAdapter, saveEnvironment?: SaveEnvironment) {
    this.storage = storage;
    this.persistence = new VaultPersistence(storage);
    this.fileSave = new ManualSave({
      getDocument: id => this.workspaceMutation ? undefined : this.documents.find(doc => doc.id === id),
      getVersion: id => this.versions[id],
      protectDrafts: () => this.flushPendingSave(),
      confirmWrite: (snapshot, handle) => this.confirmFileWrite(snapshot, handle),
    }, saveEnvironment);
    if (typeof window !== "undefined") {
      void this.initialize();
      window.addEventListener("beforeunload", (event) => {
        if (this.fileSave.busy || this.persistence.hasPendingWrites || this.persistenceState === "error") {
          event.preventDefault();
          event.returnValue = "";
        }
        void this.flushPendingSave();
      });
    }
  }

  /**
   * ES: Lee la colección sin generar reemplazos cuando falla el almacenamiento.
   * EN: Reads the collection without generating replacements on storage failure.
   */
  public initialize(): Promise<void> {
    return this.initialization ??= this.loadDatabase();
  }

  private async loadDatabase(): Promise<void> {
    try {
      const { documents, folders, drafts } = await this.persistence.load();
      const existingIds = new Set(this.documents.map(d => d.id));
      const stored = new Map(documents.map(d => [d.id, d]));
      for (const doc of documents) {
        if (!existingIds.has(doc.id)) {
          this.versions[doc.id] = { identity: { kind: "local", id: doc.id }, confirmedContent: doc.content };
        }
      }
      for (const draft of drafts) {
        const id = draft.document.id;
        if (existingIds.has(id)) continue;
        this.versions[id] = { identity: draft.identity, confirmedContent: draft.confirmedContent,
          ...(draft.fileHandle ? { fileHandle: draft.fileHandle } : {}) };
        this.recoveries[id] = draft;
        stored.set(id, { ...draft.document, content: stored.get(id)?.content ?? draft.confirmedContent ?? "" });
      }
      this.documents = [...this.documents, ...[...stored.values()].filter(d => !existingIds.has(d.id))];
      this.folders = [...this.folders, ...folders];
      if (!this.documents.some(d => d.id === this.activeId)) this.activeId = "";
      writeActiveDocumentId(this.activeId);
      this.refreshDerivedMetadata(this.activeDocument);
      if (this.persistence.hasPendingWrites) void this.flushPendingSave();
    } catch (error) {
      this.persistence.state = "error";
      console.error("ES: Error al leer almacenamiento / EN: Storage read failed:", error);
    }
  }

  get isReady(): boolean { return this.persistence.isReady; }
  get persistenceState() { return this.persistence.state; }
  get hasUnsavedChanges(): boolean {
    const doc = this.activeDocument;
    if (!doc) return false;
    const version = this.versions[doc.id];
    return version.confirmedContent === null || doc.content !== version.confirmedContent;
  }

  /**
   * ES: Actualiza el índice y el título automático de borradores sin nombre fijo.
   * EN: Updates headings and automatic titles for drafts without a fixed name.
   */
  private refreshDerivedMetadata(doc: DocumentItem | undefined): void {
    if (!doc) {
      this.tocHeadings = [];
      return;
    }

    if (!doc.hasCustomTitle && this.versions[doc.id].identity.kind !== "file") {
      const h1Title = extractFirstH1(doc.content);
      if (h1Title) {
        const normalized = normalizeDocTitle(h1Title);
        if (doc.title !== normalized) {
          doc.title = normalized;
        }
      }
    }

    this.tocHeadings = extractHeadings(doc.content);
  }

  private scheduleSave(doc: DocumentItem): void {
    this.fileSave.edited(doc.id);
    const recovery = this.recoveries[doc.id];
    let snapshot = doc;
    if (recovery) {
      snapshot = { ...doc, content: recovery.document.content };
      this.recoveries[doc.id] = { ...recovery, document: snapshot };
      if (this.recoveryCandidate?.document.id === doc.id) {
        this.recoveryCandidate = this.recoveries[doc.id];
      }
    } else {
      this.refreshDerivedMetadata(doc);
    }
    this.persistence.schedule(snapshot, this.versions[doc.id]);
    writeActiveDocumentCache(this.activeDocument);
  }

  private confirmFileWrite(snapshot: DocumentItem, handle: SaveFileHandle): Promise<boolean> {
    const doc = this.documents.find(d => d.id === snapshot.id);
    if (!doc) return Promise.resolve(true);
    this.versions[doc.id] = { ...this.versions[doc.id], confirmedContent: snapshot.content, fileHandle: handle };
    doc.title = handle.name;
    doc.hasCustomTitle = true;
    writeActiveDocumentCache(this.activeDocument);
    return this.persistence.confirmWrite(this.versions[doc.id], () => this.documents.find(d => d.id === snapshot.id));
  }

  public flushPendingSave(): Promise<boolean> {
    return this.persistence.flush();
  }

  get activeDocument(): DocumentItem | undefined {
    return this.documents.find((doc) => doc.id === this.activeId);
  }

  isWorkspaceDocument(id: string): boolean {
    return this.versions[id]?.identity.kind === "file";
  }

  closeActiveDocument(): void {
    void this.flushPendingSave();
    this.activeId = "";
    this.recoveryCandidate = null;
    writeActiveDocumentId("");
    this.refreshDerivedMetadata(undefined);
    writeActiveDocumentCache(undefined);
  }

  /** ES: Solo la apertura explícita lee contenido; conserva ediciones y versiones de recuperación.
   * EN: Only explicit opening reads content; preserves edits and recovery versions. */
  async openWorkspaceFile(workspaceId: string, path: string, handle: SaveFileHandle): Promise<void> {
    await this.initialize();
    const identity = { kind: "file" as const, workspaceId, path };
    const id = getDraftKey(identity);
    const existing = this.documents.find(doc => doc.id === id);
    if (existing && (this.recoveries[id] || existing.content !== this.versions[id].confirmedContent)) {
      this.versions[id].fileHandle = handle;
      this.selectDocument(id);
      return;
    }
    const content = await (await handle.getFile()).text();
    // ES: Una edición durante la lectura sigue teniendo prioridad sobre la instantánea del disco.
    // EN: An edit during the read still takes priority over the disk snapshot.
    if (existing && existing.content !== this.versions[id].confirmedContent) {
      this.selectDocument(id);
      return;
    }
    const doc = { id, title: handle.name, content, hasCustomTitle: true, updatedAt: Date.now() };
    this.versions[id] = { identity, confirmedContent: content, fileHandle: handle };
    this.documents = [...this.documents.filter(d => d.id !== id), doc];
    this.selectDocument(id);
  }

  /** ES: Sincroniza borradores de archivos o carpetas renombrados/movidos en disco.
   * EN: Syncs drafts of files or directories renamed/moved on disk. */
  renameWorkspacePath(workspaceId: string, oldPath: string, newPath: string, handle?: SaveFileHandle, root?: DirectoryHandle): Promise<boolean> {
    return renameWorkspaceDrafts(this, workspaceId, oldPath, newPath, handle, root);
  }

  /** ES: Elimina borradores asociados a un archivo o carpeta eliminado en disco.
   * EN: Removes drafts associated with a file or directory deleted from disk. */
  deleteWorkspacePath(workspaceId: string, path: string): Promise<boolean> {
    return deleteWorkspaceDrafts(this, workspaceId, path);
  }

  get settings(): Settings {
    return settingsStore.settings;
  }

  get isDark(): boolean {
    return settingsStore.isDark;
  }

  createDocument(
    rawTitle = "nuevo-documento.md",
    content = "# Nuevo Documento\n\n",
    folderId: string | null = null,
    hasCustomTitle = false,
  ): DocumentItem {
    void this.flushPendingSave();
    const newDoc: DocumentItem = {
      id: generateId(),
      title: normalizeDocTitle(rawTitle),
      content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      folderId,
      hasCustomTitle,
    };

    this.versions[newDoc.id] = { identity: { kind: "local", id: newDoc.id }, confirmedContent: null };
    this.documents = [newDoc, ...this.documents];
    this.activeId = newDoc.id;
    writeActiveDocumentId(this.activeId);
    this.refreshDerivedMetadata(newDoc);
    writeActiveDocumentCache(newDoc);
    this.scheduleSave(newDoc);
    return newDoc;
  }

  selectDocument(id: string): void {
    if (!this.documents.some(doc => doc.id === id)) return;
    if (this.recoveries[id]) {
      this.recoveryCandidate = this.recoveries[id];
      return;
    }
    this.recoveryCandidate = null;
    void this.flushPendingSave();
    this.activeId = id;
    writeActiveDocumentId(id);
    this.refreshDerivedMetadata(this.activeDocument);
    writeActiveDocumentCache(this.activeDocument);
  }

  /**
   * ES: Cancelar conserva el borrador; recuperarlo no lo elimina ni confirma una escritura al original.
   * EN: Cancel keeps the draft; recovery neither deletes it nor confirms an original file write.
   */
  resolveRecovery(candidate: RecoveryDraft, recover: boolean): void {
    if (this.recoveryCandidate !== candidate) return;
    this.recoveryCandidate = null;
    const id = candidate.document.id;
    if (!recover || !this.documents.some(doc => doc.id === id)) return;
    this.documents = this.documents.map(doc => doc.id === id ? { ...candidate.document } : doc);
    delete this.recoveries[id];
    this.selectDocument(id);
    if (this.persistence.state === "idle") this.persistence.state = "saved";
  }

  updateActiveContent(content: string): void {
    const doc = this.activeDocument;
    if (!doc || doc.content === content) return;
    doc.content = content;
    doc.updatedAt = Date.now();
    this.scheduleSave(doc);
  }

  updateActiveTitle(rawTitle: string, isManual = true): void {
    const doc = this.activeDocument;
    if (!doc) return;
    this.updateDocumentTitle(doc.id, rawTitle, isManual);
  }

  updateDocumentTitle(id: string, rawTitle: string, isManual = true): void {
    const doc = this.documents.find((d) => d.id === id);
    if (!doc) return;
    doc.title = normalizeDocTitle(rawTitle);
    if (isManual) doc.hasCustomTitle = true;
    doc.updatedAt = Date.now();
    this.scheduleSave(doc);
    if (this.activeId === id) writeActiveDocumentCache(doc);
  }

  createFolder(rawName = "Nueva Carpeta"): FolderItem {
    const newFolder: FolderItem = {
      id: generateId(), name: rawName.trim() || "Nueva Carpeta",
      createdAt: Date.now(), updatedAt: Date.now(), isExpanded: true,
    };
    this.folders = [...this.folders, newFolder];
    void this.persistence.run(() => this.storage.saveFolder({ ...newFolder }));
    return newFolder;
  }

  updateFolderName(id: string, newName: string): void {
    const folder = this.folders.find((f) => f.id === id);
    const clean = newName.trim();
    if (!folder || !clean) return;
    folder.name = clean;
    folder.updatedAt = Date.now();
    void this.persistence.run(() => this.storage.saveFolder({ ...folder }));
  }

  deleteFolder(id: string, deleteContainedFiles = false): void {
    if (!this.folders.some((f) => f.id === id)) return;
    if (deleteContainedFiles) {
      for (const d of this.documents.filter((d) => d.folderId === id)) this.deleteDocument(d.id);
    } else {
      this.documents.forEach((d) => {
        if (d.folderId === id) { d.folderId = null; d.updatedAt = Date.now(); this.scheduleSave(d); }
      });
      if (this.activeDocument?.folderId === id) writeActiveDocumentCache(this.activeDocument);
    }
    this.folders = this.folders.filter((f) => f.id !== id);
    void this.persistence.run(() => this.storage.deleteFolder(id));
  }

  toggleFolderExpanded(id: string): void {
    const folder = this.folders.find((f) => f.id === id);
    if (!folder) return;
    folder.isExpanded = !folder.isExpanded;
    void this.persistence.run(() => this.storage.saveFolder({ ...folder }));
  }

  moveDocumentToFolder(docId: string, folderId: string | null): void {
    const doc = this.documents.find((d) => d.id === docId);
    if (!doc) return;
    doc.folderId = folderId;
    doc.updatedAt = Date.now();
    this.scheduleSave(doc);
    if (this.activeId === docId) writeActiveDocumentCache(doc);
  }

  deleteDocument(id: string): boolean {
    void this.flushPendingSave();
    const index = this.documents.findIndex((doc) => doc.id === id);
    if (index === -1) return false;

    this.documents = this.documents.filter((doc) => doc.id !== id);
    this.fileSave.forget(id);
    this.persistence.deleteDocument(id, this.versions[id]);
    delete this.versions[id];
    delete this.recoveries[id];
    if (this.recoveryCandidate?.document.id === id) this.recoveryCandidate = null;

    if (this.activeId === id) {
      const nextIndex = Math.min(index, this.documents.length - 1);
      this.activeId = "";
      writeActiveDocumentId("");
      this.refreshDerivedMetadata(undefined);
      writeActiveDocumentCache(undefined);
      const nextId = this.documents[nextIndex]?.id;
      if (nextId) this.selectDocument(nextId);
    }

    return true;
  }

  clearAllDocuments(): void {
    for (const doc of this.documents) this.fileSave.forget(doc.id);
    this.persistence.clear();
    this.versions = {};
    this.recoveries = {};
    this.recoveryCandidate = null;
    this.documents = [];
    this.folders = [];
    this.activeId = "";
    writeActiveDocumentId("");
    this.refreshDerivedMetadata(undefined);
    writeActiveDocumentCache(undefined);
  }

  importDocument(rawFilename: string, content: string): DocumentItem {
    const title = normalizeDocTitle(rawFilename);
    const stem = title.replace(/\.md$/i, "");
    let candidate = title;
    let suffix = 2;
    while (this.documents.some(d => d.title.toLowerCase() === candidate.toLowerCase())) {
      candidate = `${stem} (${suffix++}).md`;
    }
    const doc = this.createDocument(candidate, content, null, true);
    this.versions[doc.id].confirmedContent = content;
    this.scheduleSave(doc);
    return doc;
  }

  toggleTaskCheckbox(taskIndex: number, isChecked: boolean): void {
    const doc = this.activeDocument;
    if (!doc) return;
    const updatedMd = toggleMarkdownTaskAtIndex(doc.content, taskIndex, isChecked);
    if (updatedMd !== null) this.updateActiveContent(updatedMd);
  }

  applyTheme(theme: ThemeMode): void { settingsStore.applyTheme(theme); }
  updateSettings(partial: Partial<Settings>): void { settingsStore.updateSettings(partial); }
  setViewMode(mode: ViewMode): void { settingsStore.setViewMode(mode); }
  setFontSize(size: FontSize): void { settingsStore.setFontSize(size); }
  toggleTheme(): ThemeMode { return settingsStore.toggleTheme(); }
  cycleTheme(): ThemeMode { return settingsStore.cycleTheme(); }
  resetSplitRatio(): void { settingsStore.resetSplitRatio(); }
}

export const vaultStore = new DocumentStore();
export const documentStore = vaultStore;
