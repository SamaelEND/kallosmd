/**
 * ES: Store reactivo para la gestión de documentos, carpetas, configuración y persistencia local.
 * EN: Reactive store for managing documents, folders, settings, and local persistence.
 */

import type {
  DocumentItem,
  FolderItem,
  Settings,
  TocHeading,
  ThemeMode,
  ViewMode,
  FontSize,
} from "../types";
import {
  getAllDocumentsFromDb,
  saveDocumentToDb,
  deleteDocumentFromDb,
  clearAllDocumentsFromDb,
  getAllFoldersFromDb,
  saveFolderToDb,
  deleteFolderFromDb,
  clearAllFoldersFromDb,
} from "../lib/db";
import { DEFAULT_CODE_THEME, isCodeThemeId } from "../lib/codeThemes";
import {
  DEFAULT_DOCUMENT_TITLE,
  DEFAULT_MARKDOWN,
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
} from "../lib/markdown/defaultDocument";
import {
  extractFirstH1,
  extractHeadings,
  normalizeDocTitle,
  toggleMarkdownTaskAtIndex,
} from "../lib/markdown/markdownUtils";
import { generateId } from "../lib/utils/formatters";

export { extractFirstH1, extractHeadings };

class DocumentStore {
  documents = $state<DocumentItem[]>([]);
  folders = $state<FolderItem[]>([]);
  activeId = $state<string>("");
  settings = $state<Settings>(DEFAULT_SETTINGS);
  tocHeadings = $state<TocHeading[]>([]);
  isReady = $state<boolean>(false);

  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingSaveDoc: DocumentItem | null = null;

  constructor() {
    this.loadSettings();
    this.initDatabase();

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        this.flushPendingSave();
      });
    }
  }

  /**
   * ES: Carga la configuración del usuario y la caché inicial desde localStorage.
   * EN: Loads user settings and initial cache from localStorage.
   */
  private loadSettings(): void {
    if (typeof window === "undefined") return;

    try {
      const rawTheme = localStorage.getItem(STORAGE_KEYS.THEME);
      const savedTheme: ThemeMode = rawTheme === "light" ? "light" : "dark";
      const savedViewMode =
        (localStorage.getItem(STORAGE_KEYS.VIEW_MODE) as ViewMode) || "split";
      const savedFontSize =
        (localStorage.getItem(STORAGE_KEYS.FONT_SIZE) as FontSize) || "medium";
      const rawCodeTheme = localStorage.getItem(STORAGE_KEYS.CODE_THEME);
      const savedCodeTheme = isCodeThemeId(rawCodeTheme)
        ? rawCodeTheme
        : DEFAULT_CODE_THEME;
      const savedSyncScroll =
        localStorage.getItem(STORAGE_KEYS.SYNC_SCROLL) !== "false";
      const savedLineNumbers =
        localStorage.getItem(STORAGE_KEYS.LINE_NUMBERS) !== "false";
      const savedMinimap =
        localStorage.getItem(STORAGE_KEYS.MINIMAP) !== "false";
      const savedSplitRatio =
        parseFloat(localStorage.getItem(STORAGE_KEYS.SPLIT_RATIO) || "50") ||
        50;
      const rawPdfUrl = localStorage.getItem(STORAGE_KEYS.INCLUDE_PDF_URL);
      const savedIncludePdfUrl =
        rawPdfUrl !== null ? rawPdfUrl === "true" : true;

      this.settings = {
        theme: savedTheme,
        viewMode: savedViewMode,
        fontSize: savedFontSize,
        codeTheme: savedCodeTheme,
        syncScroll: savedSyncScroll,
        lineNumbers: savedLineNumbers,
        minimap: savedMinimap,
        splitRatio: Math.max(15, Math.min(85, savedSplitRatio)),
        wordWrap: true,
        includePdfUrl: savedIncludePdfUrl,
      };

      this.applyTheme(savedTheme);

      // ES: Recupera el identificador activo y el documento en caché para arranque inmediato.
      // EN: Retrieves the active identifier and cached document for instant startup.
      const savedActiveId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ID);
      if (savedActiveId) {
        this.activeId = savedActiveId;
      }

      const cachedActiveRaw = localStorage.getItem(
        STORAGE_KEYS.ACTIVE_DOC_CACHE,
      );
      if (cachedActiveRaw) {
        try {
          const cachedDoc = JSON.parse(cachedActiveRaw);
          if (cachedDoc && cachedDoc.id) {
            this.documents = [cachedDoc];
            if (!this.activeId) this.activeId = cachedDoc.id;
            this.refreshDerivedMetadata(cachedDoc);
          }
        } catch { }
      }
    } catch (error) {
      console.error(
        "Error al cargar configuración inicial desde localStorage:",
        error,
      );
    }
  }

  /**
   * ES: Inicializa la conexión con IndexedDB y sincroniza la colección local de documentos y carpetas.
   * EN: Initializes the IndexedDB connection and synchronizes the local collection of documents and folders.
   */
  private async initDatabase(): Promise<void> {
    if (typeof window === "undefined") return;

    try {
      // ES: Limpia claves de almacenamiento heredadas en localStorage.
      // EN: Cleans legacy storage keys in localStorage.
      try {
        localStorage.removeItem(STORAGE_KEYS.DOCS);
        localStorage.removeItem(STORAGE_KEYS.TRANSITIONAL_DOCS);
      } catch { }

      let dbDocs = await getAllDocumentsFromDb();
      const dbFolders = await getAllFoldersFromDb();

      // ES: Si la base de datos local está vacía, genera el documento inicial con la guía predeterminada.
      // EN: If the local database is empty, generates the initial document with the default guide.
      if (dbDocs.length === 0) {
        const initialDoc: DocumentItem = {
          id: generateId(),
          title: DEFAULT_DOCUMENT_TITLE,
          content: DEFAULT_MARKDOWN,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          folderId: null,
          hasCustomTitle: false,
        };
        await saveDocumentToDb(initialDoc);
        dbDocs = [initialDoc];
      }

      this.documents = dbDocs;
      this.folders = dbFolders;

      const exists = this.documents.some((d) => d.id === this.activeId);
      if (!exists && this.documents.length > 0) {
        this.activeId = this.documents[0].id;
      }
      try {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, this.activeId);
      } catch { }

      this.refreshDerivedMetadata(this.activeDocument);
      this.updateActiveCache(this.activeDocument);
      this.isReady = true;
    } catch (error) {
      console.error("Error al inicializar IndexedDB:", error);
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
   * ES: Actualiza la tabla de contenidos y el título automático a partir del documento indicado.
   * EN: Updates the table of contents and automatic title from the specified document.
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

  /**
   * ES: Guarda una instantánea ligera en localStorage del documento activo para carga instantánea.
   * EN: Saves a lightweight snapshot of the active document in localStorage for instant startup.
   */
  private updateActiveCache(doc: DocumentItem | undefined): void {
    if (typeof window === "undefined") return;
    try {
      if (doc) {
        localStorage.setItem(
          STORAGE_KEYS.ACTIVE_DOC_CACHE,
          JSON.stringify({
            id: doc.id,
            title: doc.title,
            content: doc.content,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            folderId: doc.folderId || null,
            hasCustomTitle: Boolean(doc.hasCustomTitle),
          }),
        );
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_DOC_CACHE);
      }
    } catch { }
  }

  /**
   * ES: Programa el guardado asíncrono y la actualización de metadatos con debounce de 250 ms.
   * EN: Schedules asynchronous saving and metadata refresh with a 250 ms debounce.
   */
  private scheduleSave(doc: DocumentItem): void {
    this.pendingSaveDoc = doc;
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.flushPendingSave();
    }, 250);
  }

  /**
   * ES: Ejecuta de inmediato el guardado en IndexedDB y actualiza los metadatos pendientes en cola.
   * EN: Immediately executes IndexedDB saving and refreshes queued pending metadata.
   */
  public flushPendingSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.pendingSaveDoc) {
      const doc = this.pendingSaveDoc;
      this.pendingSaveDoc = null;
      this.refreshDerivedMetadata(doc);
      saveDocumentToDb(doc);
      this.updateActiveCache(doc);
    }
  }

  /**
   * ES: Persiste las opciones de configuración en claves individuales de localStorage.
   * EN: Persists configuration options to individual keys in localStorage.
   */
  private persistSettings(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, this.settings.theme);
      localStorage.setItem(STORAGE_KEYS.VIEW_MODE, this.settings.viewMode);
      localStorage.setItem(STORAGE_KEYS.FONT_SIZE, this.settings.fontSize);
      localStorage.setItem(STORAGE_KEYS.CODE_THEME, this.settings.codeTheme);
      localStorage.setItem(
        STORAGE_KEYS.SYNC_SCROLL,
        String(this.settings.syncScroll),
      );
      localStorage.setItem(
        STORAGE_KEYS.LINE_NUMBERS,
        String(this.settings.lineNumbers),
      );
      localStorage.setItem(STORAGE_KEYS.MINIMAP, String(this.settings.minimap));
      localStorage.setItem(
        STORAGE_KEYS.SPLIT_RATIO,
        String(this.settings.splitRatio),
      );
      localStorage.setItem(
        STORAGE_KEYS.INCLUDE_PDF_URL,
        String(Boolean(this.settings.includePdfUrl)),
      );
    } catch (error) {
      console.error("Error al guardar configuración en localStorage:", error);
    }
  }

  // ES: Propiedades derivadas de lectura para el documento activo y el estado del tema.
  // EN: Read-only derived properties for the active document and theme state.

  get activeDocument(): DocumentItem | undefined {
    return (
      this.documents.find((doc) => doc.id === this.activeId) ||
      this.documents[0]
    );
  }

  get isDark(): boolean {
    return this.settings.theme === "dark";
  }

  // ES: Operaciones CRUD de documentos.
  // EN: Document CRUD operations.

  createDocument(
    rawTitle = "nuevo-documento.md",
    content = "# Nuevo Documento\n\n",
    folderId: string | null = null,
  ): DocumentItem {
    this.flushPendingSave();
    const title = normalizeDocTitle(rawTitle);
    const newDoc: DocumentItem = {
      id: generateId(),
      title,
      content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      folderId,
      hasCustomTitle: false,
    };

    this.documents = [newDoc, ...this.documents];
    this.activeId = newDoc.id;
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, this.activeId);
    } catch { }

    this.refreshDerivedMetadata(newDoc);
    this.updateActiveCache(newDoc);
    saveDocumentToDb(newDoc);

    return newDoc;
  }

  selectDocument(id: string): void {
    if (this.documents.some((doc) => doc.id === id)) {
      this.flushPendingSave();
      this.activeId = id;
      try {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, this.activeId);
      } catch { }
      const active = this.activeDocument;
      this.refreshDerivedMetadata(active);
      this.updateActiveCache(active);
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

    doc.title = normalizeDocTitle(rawTitle);
    if (isManual) {
      doc.hasCustomTitle = true;
    }
    doc.updatedAt = Date.now();
    saveDocumentToDb(doc);
    this.updateActiveCache(doc);
  }

  updateDocumentTitle(id: string, rawTitle: string, isManual = true): void {
    const doc = this.documents.find((d) => d.id === id);
    if (!doc) return;

    doc.title = normalizeDocTitle(rawTitle);
    if (isManual) {
      doc.hasCustomTitle = true;
    }
    doc.updatedAt = Date.now();
    saveDocumentToDb(doc);
    if (this.activeId === id) {
      this.updateActiveCache(doc);
    }
  }

  // ES: Operaciones de gestión de carpetas.
  // EN: Folder management operations.

  createFolder(rawName = "Nueva Carpeta"): FolderItem {
    const cleanName = rawName.trim() || "Nueva Carpeta";
    const newFolder: FolderItem = {
      id: generateId(),
      name: cleanName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isExpanded: true,
    };

    this.folders = [...this.folders, newFolder];
    saveFolderToDb(newFolder);
    return newFolder;
  }

  updateFolderName(id: string, newName: string): void {
    const folder = this.folders.find((f) => f.id === id);
    if (!folder) return;

    const clean = newName.trim();
    if (!clean) return;

    folder.name = clean;
    folder.updatedAt = Date.now();
    saveFolderToDb(folder);
  }

  deleteFolder(id: string, deleteContainedFiles = false): void {
    const folder = this.folders.find((f) => f.id === id);
    if (!folder) return;

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
          saveDocumentToDb(d);
        }
      });
      if (this.activeDocument?.folderId === id) {
        this.updateActiveCache(this.activeDocument);
      }
    }

    this.folders = this.folders.filter((f) => f.id !== id);
    deleteFolderFromDb(id);
  }

  toggleFolderExpanded(id: string): void {
    const folder = this.folders.find((f) => f.id === id);
    if (!folder) return;

    folder.isExpanded = !folder.isExpanded;
    saveFolderToDb(folder);
  }

  moveDocumentToFolder(docId: string, folderId: string | null): void {
    const doc = this.documents.find((d) => d.id === docId);
    if (!doc) return;

    doc.folderId = folderId;
    doc.updatedAt = Date.now();
    saveDocumentToDb(doc);
    if (this.activeId === docId) {
      this.updateActiveCache(doc);
    }
  }

  deleteDocument(id: string): boolean {
    this.flushPendingSave();
    const index = this.documents.findIndex((doc) => doc.id === id);
    if (index === -1) return false;

    this.documents = this.documents.filter((doc) => doc.id !== id);
    deleteDocumentFromDb(id);

    if (this.documents.length === 0) {
      this.createDocument();
    } else if (this.activeId === id) {
      const nextIndex = Math.min(index, this.documents.length - 1);
      this.activeId = this.documents[nextIndex].id;
      try {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, this.activeId);
      } catch { }
      const active = this.activeDocument;
      this.refreshDerivedMetadata(active);
      this.updateActiveCache(active);
    }

    return true;
  }

  /**
   * ES: Vacía todos los documentos y carpetas e inicializa un documento en blanco.
   * EN: Clears all documents and folders and initializes a blank document.
   */
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
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, this.activeId);
    } catch { }
    this.refreshDerivedMetadata(freshDoc);
    this.updateActiveCache(freshDoc);

    Promise.all([clearAllDocumentsFromDb(), clearAllFoldersFromDb()]).then(
      () => {
        saveDocumentToDb(freshDoc);
      },
    );
  }

  /**
   * ES: Importa o actualiza un documento .md / .txt desde archivo local o arrastrar y soltar.
   * EN: Imports or updates a .md / .txt document from a local file or drag and drop.
   */
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
      try {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, this.activeId);
      } catch { }
      this.refreshDerivedMetadata(existing);
      this.updateActiveCache(existing);
      saveDocumentToDb(existing);
      return existing;
    }

    const newDoc: DocumentItem = {
      id: generateId(),
      title,
      content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.documents = [newDoc, ...this.documents];
    this.activeId = newDoc.id;
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, this.activeId);
    } catch { }
    this.refreshDerivedMetadata(newDoc);
    this.updateActiveCache(newDoc);
    saveDocumentToDb(newDoc);

    return newDoc;
  }

  /**
   * ES: Conmuta el estado de una tarea en el documento activo según su índice ordinal.
   * EN: Toggles the state of a task in the active document by its ordinal index.
   */
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

  // ES: Operaciones de configuración de interfaz y tema visual.
  // EN: UI and visual theme configuration operations.

  applyTheme(theme: ThemeMode): void {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const isDark = theme === "dark";

    const currentTheme = root.getAttribute("data-theme");
    const hasCorrectClass = isDark
      ? root.classList.contains("dark")
      : root.classList.contains("light");
    if (currentTheme === theme && hasCorrectClass) return;

    root.classList.add("no-transitions");

    root.setAttribute("data-theme", theme);
    if (isDark) {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }

    void root.offsetHeight;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove("no-transitions");
      });
    });
  }

  updateSettings(partial: Partial<Settings>): void {
    this.settings = { ...this.settings, ...partial };
    if (partial.theme) {
      this.applyTheme(partial.theme);
    }
    this.persistSettings();
  }

  setViewMode(mode: ViewMode): void {
    this.updateSettings({ viewMode: mode });
  }

  setFontSize(size: FontSize): void {
    this.updateSettings({ fontSize: size });
  }

  toggleTheme(): ThemeMode {
    const nextMode: ThemeMode =
      this.settings.theme === "dark" ? "light" : "dark";
    this.updateSettings({ theme: nextMode });
    return nextMode;
  }

  cycleTheme(): ThemeMode {
    return this.toggleTheme();
  }

  resetSplitRatio(): void {
    this.updateSettings({ splitRatio: 50 });
  }
}

export const documentStore = new DocumentStore();
