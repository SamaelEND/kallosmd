/**
 * Store reactivo para la gestión de documentos, configuración y persistencia de Markdown Studio.
 * Preparado con runas de Svelte 5 ($state, $derived).
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
   * Carga configuraciones de usuario de manera síncrona desde localStorage para arranque instantáneo.
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

      const isCleanInitialized =
        localStorage.getItem(STORAGE_KEYS.CLEAN_INIT_FLAG) === "true";

      if (!isCleanInitialized) {
        try {
          localStorage.removeItem(STORAGE_KEYS.DOCS);
          localStorage.removeItem(STORAGE_KEYS.TRANSITIONAL_DOCS);
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_DOC_CACHE);
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_ID);
        } catch { }
      } else {
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
            }
          } catch { }
        }
      }
    } catch (error) {
      console.error(
        "Error al cargar configuración inicial desde localStorage:",
        error,
      );
    }
  }

  /**
   * Inicializa IndexedDB, purgando cualquier residuo previo en localStorage para arrancar 100% desde cero.
   */
  private async initDatabase(): Promise<void> {
    if (typeof window === "undefined") return;

    try {
      const isCleanInitialized =
        localStorage.getItem(STORAGE_KEYS.CLEAN_INIT_FLAG) === "true";

      if (!isCleanInitialized) {
        try {
          localStorage.removeItem(STORAGE_KEYS.DOCS);
          localStorage.removeItem(STORAGE_KEYS.TRANSITIONAL_DOCS);
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_DOC_CACHE);
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_ID);
        } catch { }

        await clearAllDocumentsFromDb();
        await clearAllFoldersFromDb();

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

        try {
          localStorage.setItem(STORAGE_KEYS.CLEAN_INIT_FLAG, "true");
          localStorage.setItem(STORAGE_KEYS.GUIDE_MIGRATED_FLAG, "true");
          localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, initialDoc.id);
        } catch { }

        this.documents = [initialDoc];
        this.folders = [];
        this.activeId = initialDoc.id;
        this.updateActiveCache(initialDoc);
        this.isReady = true;
        return;
      }

      let dbDocs = await getAllDocumentsFromDb();
      const dbFolders = await getAllFoldersFromDb();

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
      } else if (
        localStorage.getItem(STORAGE_KEYS.GUIDE_MIGRATED_FLAG) !== "true"
      ) {
        // Actualizar el documento de bienvenida anterior por la nueva guía completa por defecto
        const legacyWelcomeDoc = dbDocs.find(
          (d) =>
            d.title.toLowerCase() === "bienvenido.md" ||
            d.title.toLowerCase().startsWith("bienvenido a md studio"),
        );

        if (legacyWelcomeDoc) {
          legacyWelcomeDoc.title = DEFAULT_DOCUMENT_TITLE;
          legacyWelcomeDoc.content = DEFAULT_MARKDOWN;
          legacyWelcomeDoc.updatedAt = Date.now();
          await saveDocumentToDb(legacyWelcomeDoc);
        }

        try {
          localStorage.setItem(STORAGE_KEYS.GUIDE_MIGRATED_FLAG, "true");
        } catch { }
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
      }
    }
  }

  /**
   * Mantiene un snapshot ligero en localStorage exclusivamente del documento activo para carga instantánea.
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
   * Programa el guardado asíncrono con debounce (250 ms) para evitar sobrecargar el disco en escritura continua.
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
   * Fuerza el guardado inmediato en IndexedDB si hay cambios pendientes en cola.
   */
  public flushPendingSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.pendingSaveDoc) {
      saveDocumentToDb(this.pendingSaveDoc);
      this.updateActiveCache(this.pendingSaveDoc);
      this.pendingSaveDoc = null;
    }
  }

  /**
   * Guarda las opciones de configuración en las claves individuales de localStorage.
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

  // --- Propiedades Derivadas ---

  get activeDocument(): DocumentItem | undefined {
    return (
      this.documents.find((doc) => doc.id === this.activeId) ||
      this.documents[0]
    );
  }

  get tocHeadings(): TocHeading[] {
    const active = this.activeDocument;
    if (!active) return [];
    return extractHeadings(active.content);
  }

  get isDark(): boolean {
    return this.settings.theme === "dark";
  }

  // --- Operaciones CRUD de Documentos ---

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
      this.updateActiveCache(this.activeDocument);
    }
  }

  updateActiveContent(content: string): void {
    const doc = this.activeDocument;
    if (!doc) return;

    doc.content = content;
    doc.updatedAt = Date.now();

    if (!doc.hasCustomTitle) {
      const h1Title = extractFirstH1(content);
      if (h1Title) {
        const normalized = normalizeDocTitle(h1Title);
        if (doc.title !== normalized) {
          doc.title = normalized;
          this.updateActiveCache(doc);
        }
      }
    }

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

  // --- Operaciones de Carpetas (Folders) ---

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
      this.updateActiveCache(this.activeDocument);
    }

    return true;
  }

  /**
   * Elimina todos los documentos y crea uno nuevo en blanco.
   */
  clearAllDocuments(): void {
    this.flushPendingSave();
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
    this.updateActiveCache(freshDoc);

    clearAllDocumentsFromDb().then(() => {
      saveDocumentToDb(freshDoc);
    });
    clearAllFoldersFromDb();
  }

  /**
   * Importa o actualiza un archivo .md / .txt desde disco o Drag & Drop.
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
    this.updateActiveCache(newDoc);
    saveDocumentToDb(newDoc);

    return newDoc;
  }

  /**
   * Conmuta interactivamente una tarea en el Markdown activo según su índice ordinal.
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

  // --- Operaciones de Configuración ---

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
    this.applyTheme(nextMode);
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
