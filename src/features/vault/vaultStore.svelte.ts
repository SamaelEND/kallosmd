/**
 * Store reactivo para la gestión de documentos, carpetas, tabla de contenidos y persistencia local.
 * Delega las preferencias visuales en settingsStore y la persistencia en StorageAdapter.
 */

import {
  DEFAULT_DOCUMENT_TITLE,
  DEFAULT_MARKDOWN,
  getDefaultDocumentTitle,
  getDefaultGuideMarkdown,
  isDefaultGuideContent,
} from "../../core/markdown/defaultDocument";
import { i18n } from "../../shared/i18n/i18n.svelte";
import {
  extractFirstH1,
  extractHeadings,
  normalizeDocTitle,
  toggleMarkdownTaskAtIndex,
} from "../../core/markdown/markdownUtils";
import { indexedDbAdapter } from "../../core/storage/indexedDbAdapter";
import {
  clearLegacyStorageKeys,
  readCachedActiveDocument,
  writeActiveDocumentCache,
  writeActiveDocumentId,
} from "../../core/storage/localCache";
import type { StorageAdapter } from "../../core/storage/storagePort";
import { generateId } from "../../shared/utils/formatters";
import type {
  DocumentItem,
  FolderItem,
  FontSize,
  Settings,
  ThemeMode,
  TocHeading,
  ViewMode,
} from "../../core/types";
import { settingsStore } from "../settings/settingsStore.svelte";

export { extractFirstH1, extractHeadings };

class DocumentStore {
  documents = $state<DocumentItem[]>([]);
  folders = $state<FolderItem[]>([]);
  activeId = $state<string>("");
  tocHeadings = $state<TocHeading[]>([]);
  isReady = $state<boolean>(false);

  private storage: StorageAdapter = indexedDbAdapter;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingSaveDoc: DocumentItem | null = null;

  constructor() {
    const { activeId, cachedDoc } = readCachedActiveDocument();
    if (activeId) this.activeId = activeId;
    if (cachedDoc) {
      this.documents = [cachedDoc];
      this.refreshDerivedMetadata(cachedDoc);
    }
    this.initDatabase();

    i18n.onLocaleChange((locale) => {
      this.syncDefaultGuideLocale(locale);
    });

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => this.flushPendingSave());
    }
  }

  /**
   * Inicializa la conexión con el adaptador de almacenamiento y sincroniza documentos y carpetas.
   */
  private async initDatabase(): Promise<void> {
    if (typeof window === "undefined") return;

    try {
      clearLegacyStorageKeys();
      let dbDocs = await this.storage.getAllDocuments();
      const dbFolders = await this.storage.getAllFolders();

      if (dbDocs.length === 0) {
        const locale = i18n.locale;
        const initialDoc: DocumentItem = {
          id: generateId(),
          title: getDefaultDocumentTitle(locale),
          content: getDefaultGuideMarkdown(locale),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          folderId: null,
          hasCustomTitle: false,
        };
        await this.storage.saveDocument(initialDoc);
        dbDocs = [initialDoc];
      }

      this.documents = dbDocs;
      this.folders = dbFolders;
      this.syncDefaultGuideLocale(i18n.locale);

      const exists = this.documents.some((d) => d.id === this.activeId);
      if (!exists && this.documents.length > 0) {
        this.activeId = this.documents[0].id;
      }
      writeActiveDocumentId(this.activeId);
      this.refreshDerivedMetadata(this.activeDocument);
      writeActiveDocumentCache(this.activeDocument);
      this.isReady = true;
    } catch (error) {
      console.error("Error al inicializar el almacenamiento local:", error);
      if (this.documents.length === 0) {
        const fallbackDoc: DocumentItem = {
          id: generateId(),
          title: DEFAULT_DOCUMENT_TITLE,
          content: DEFAULT_MARKDOWN,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        this.documents = [fallbackDoc];
        this.activeId = fallbackDoc.id;
        this.refreshDerivedMetadata(fallbackDoc);
      }
    }
  }

  /**
   * Actualiza la tabla de contenidos y el título automático a partir del documento indicado.
   */
  private refreshDerivedMetadata(doc: DocumentItem | undefined): void {
    if (!doc) {
      this.tocHeadings = [];
      return;
    }

    if (!doc.hasCustomTitle) {
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
    this.pendingSaveDoc = doc;
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.flushPendingSave(), 250);
  }

  public flushPendingSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.pendingSaveDoc) {
      const doc = this.pendingSaveDoc;
      this.pendingSaveDoc = null;
      this.refreshDerivedMetadata(doc);
      this.storage.saveDocument(doc);
      writeActiveDocumentCache(doc);
    }
  }

  get activeDocument(): DocumentItem | undefined {
    return (
      this.documents.find((doc) => doc.id === this.activeId) ||
      this.documents[0]
    );
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
  ): DocumentItem {
    this.flushPendingSave();
    const newDoc: DocumentItem = {
      id: generateId(),
      title: normalizeDocTitle(rawTitle),
      content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      folderId,
      hasCustomTitle: false,
    };

    this.documents = [newDoc, ...this.documents];
    this.activeId = newDoc.id;
    writeActiveDocumentId(this.activeId);
    this.refreshDerivedMetadata(newDoc);
    writeActiveDocumentCache(newDoc);
    this.storage.saveDocument(newDoc);
    return newDoc;
  }

  selectDocument(id: string): void {
    if (this.documents.some((doc) => doc.id === id)) {
      this.flushPendingSave();
      this.activeId = id;
      writeActiveDocumentId(this.activeId);
      const active = this.activeDocument;
      this.refreshDerivedMetadata(active);
      writeActiveDocumentCache(active);
    }
  }

  updateActiveContent(content: string): void {
    const doc = this.activeDocument;
    if (!doc) return;
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
    this.storage.saveDocument(doc);
    if (this.activeId === id) writeActiveDocumentCache(doc);
  }

  createFolder(rawName = "Nueva Carpeta"): FolderItem {
    const newFolder: FolderItem = {
      id: generateId(),
      name: rawName.trim() || "Nueva Carpeta",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isExpanded: true,
    };
    this.folders = [...this.folders, newFolder];
    this.storage.saveFolder(newFolder);
    return newFolder;
  }

  updateFolderName(id: string, newName: string): void {
    const folder = this.folders.find((f) => f.id === id);
    const clean = newName.trim();
    if (!folder || !clean) return;
    folder.name = clean;
    folder.updatedAt = Date.now();
    this.storage.saveFolder(folder);
  }

  deleteFolder(id: string, deleteContainedFiles = false): void {
    if (!this.folders.some((f) => f.id === id)) return;

    if (deleteContainedFiles) {
      const docsToDelete = this.documents.filter((d) => d.folderId === id);
      for (const d of docsToDelete) {
        this.deleteDocument(d.id);
      }
    } else {
      this.documents.forEach((d) => {
        if (d.folderId === id) {
          d.folderId = null;
          d.updatedAt = Date.now();
          this.storage.saveDocument(d);
        }
      });
      if (this.activeDocument?.folderId === id) {
        writeActiveDocumentCache(this.activeDocument);
      }
    }

    this.folders = this.folders.filter((f) => f.id !== id);
    this.storage.deleteFolder(id);
  }

  toggleFolderExpanded(id: string): void {
    const folder = this.folders.find((f) => f.id === id);
    if (!folder) return;
    folder.isExpanded = !folder.isExpanded;
    this.storage.saveFolder(folder);
  }

  moveDocumentToFolder(docId: string, folderId: string | null): void {
    const doc = this.documents.find((d) => d.id === docId);
    if (!doc) return;
    doc.folderId = folderId;
    doc.updatedAt = Date.now();
    this.storage.saveDocument(doc);
    if (this.activeId === docId) writeActiveDocumentCache(doc);
  }

  deleteDocument(id: string): boolean {
    this.flushPendingSave();
    const index = this.documents.findIndex((doc) => doc.id === id);
    if (index === -1) return false;

    this.documents = this.documents.filter((doc) => doc.id !== id);
    this.storage.deleteDocument(id);

    if (this.documents.length === 0) {
      this.createDocument();
    } else if (this.activeId === id) {
      const nextIndex = Math.min(index, this.documents.length - 1);
      this.activeId = this.documents[nextIndex].id;
      writeActiveDocumentId(this.activeId);
      const active = this.activeDocument;
      this.refreshDerivedMetadata(active);
      writeActiveDocumentCache(active);
    }

    return true;
  }

  clearAllDocuments(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.pendingSaveDoc = null;

    const freshDoc: DocumentItem = {
      id: generateId(),
      title: "nuevo-documento.md",
      content: "# Nuevo Documento\n\n",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.documents = [freshDoc];
    this.folders = [];
    this.activeId = freshDoc.id;
    writeActiveDocumentId(this.activeId);
    this.refreshDerivedMetadata(freshDoc);
    writeActiveDocumentCache(freshDoc);

    Promise.all([
      this.storage.clearAllDocuments(),
      this.storage.clearAllFolders(),
    ]).then(() => {
      this.storage.saveDocument(freshDoc);
    });
  }

  importDocument(rawFilename: string, content: string): DocumentItem {
    this.flushPendingSave();
    const title = normalizeDocTitle(rawFilename);
    const existing = this.documents.find(
      (d) => d.title.toLowerCase() === title.toLowerCase(),
    );

    if (existing) {
      existing.content = content;
      existing.updatedAt = Date.now();
      this.activeId = existing.id;
      writeActiveDocumentId(this.activeId);
      this.refreshDerivedMetadata(existing);
      writeActiveDocumentCache(existing);
      this.storage.saveDocument(existing);
      return existing;
    }

    return this.createDocument(title, content);
  }

  toggleTaskCheckbox(taskIndex: number, isChecked: boolean): void {
    const doc = this.activeDocument;
    if (!doc) return;
    const updatedMd = toggleMarkdownTaskAtIndex(
      doc.content,
      taskIndex,
      isChecked,
    );
    if (updatedMd !== null) {
      this.updateActiveContent(updatedMd);
    }
  }

  applyTheme(theme: ThemeMode): void {
    settingsStore.applyTheme(theme);
  }

  updateSettings(partial: Partial<Settings>): void {
    settingsStore.updateSettings(partial);
  }

  setViewMode(mode: ViewMode): void {
    settingsStore.setViewMode(mode);
  }

  setFontSize(size: FontSize): void {
    settingsStore.setFontSize(size);
  }

  toggleTheme(): ThemeMode {
    return settingsStore.toggleTheme();
  }

  cycleTheme(): ThemeMode {
    return settingsStore.cycleTheme();
  }

  resetSplitRatio(): void {
    settingsStore.resetSplitRatio();
  }

  /**
   * Sincroniza el documento de guía de ejemplo inicial cuando el usuario cambia el idioma.
   * Solo modifica el documento si no tiene título personalizado y su contenido/título coincide con una guía de ejemplo.
   */
  syncDefaultGuideLocale(locale: "es" | "en"): void {
    const targetDoc = this.documents.find(
      (d) => !d.hasCustomTitle && isDefaultGuideContent(d.content, d.title),
    );
    if (!targetDoc) return;

    const newContent = getDefaultGuideMarkdown(locale);
    const newTitle = getDefaultDocumentTitle(locale);

    if (targetDoc.content !== newContent || targetDoc.title !== newTitle) {
      targetDoc.content = newContent;
      targetDoc.title = newTitle;
      targetDoc.updatedAt = Date.now();
      this.storage.saveDocument(targetDoc);
      if (targetDoc.id === this.activeId) {
        this.refreshDerivedMetadata(targetDoc);
        writeActiveDocumentCache(targetDoc);
      }
    }
  }
}

export const vaultStore = new DocumentStore();
export const documentStore = vaultStore;
