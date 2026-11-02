/**
 * Store reactivo para la gestión de documentos, configuración y persistencia de MD Studio.
 * Preparado con runas de Svelte 5 ($state, $derived).
 */

import type { DocumentItem, Settings, TocHeading, ThemeMode, ViewMode, FontSize } from '../types';
import {
  getAllDocumentsFromDb,
  saveDocumentToDb,
  saveAllDocumentsToDb,
  deleteDocumentFromDb,
  clearAllDocumentsFromDb,
} from '../lib/db';

/**
 * Claves estándar de almacenamiento en localStorage para MD Studio (preferencias y caché de UI).
 */
const STORAGE_KEYS = {
  DOCS: 'md_studio_docs_v1',
  ACTIVE_ID: 'md_studio_active_id_v1',
  THEME: 'md_studio_theme_v1',
  SYNC_SCROLL: 'md_studio_sync_scroll_v1',
  VIEW_MODE: 'md_studio_view_mode_v1',
  FONT_SIZE: 'md_studio_font_size_v1',
  LINE_NUMBERS: 'md_studio_line_numbers_v1',
  MINIMAP: 'md_studio_minimap_v1',
  SPLIT_RATIO: 'md_studio_split_ratio_v1',
  // Clave transicional para migración suave
  TRANSITIONAL_DOCS: 'md_studio_documents_v1',
  TRANSITIONAL_SETTINGS: 'md_studio_settings_v1',
  // Caché de arranque rápido para el documento activo
  ACTIVE_DOC_CACHE: 'md_studio_active_cache_v1',
  // Bandera para asegurar inicio 100% limpio desde cero con IndexedDB
  CLEAN_INIT_FLAG: 'md_studio_fresh_idb_v2',
};

const DEFAULT_MARKDOWN = `# Bienvenido a MD Studio 🚀

Un entorno de escritura y lectura centrado en la claridad tipográfica, el rendimiento y la ausencia de distracciones.

---

## 1. Características del Sistema

- **Editor con CodeMirror 6**: Resaltado nativo, números de línea precisos y minimapa vectorial.
- **Renderizado Reactivo**: Sanitización segura con DOMPurify.
- **Fórmulas KaTeX**: Ecuaciones integradas en línea y en bloque sin conflictos de formato.
- **Diagramas Mermaid**: Diagramas escalables con controles de zoom individuales.
- **Exportación Flexible**: Descarga como \`.md\` y exportación a \`PDF\` lista para imprimir.

---

## 2. Fórmulas Matemáticas con KaTeX

Ecuación en línea: $E = mc^2$ o la relación de Euler $e^{i\\pi} + 1 = 0$.

Ecuación en bloque:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

Y sumatorias complejas:

$$
\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}
$$

---

## 3. Diagramas Mermaid con Zoom

\`\`\`mermaid
flowchart LR
    A[Markdown Fuente] --> B(CodeMirror 6)
    B --> C{Pipeline Reactivo}
    C --> D[KaTeX Math Engine]
    C --> E[Mermaid Renderer]
    C --> F[DOMPurify]
    D --> G[Mesa de Lectura]
    E --> G
    F --> G
\`\`\`

---

## 4. Tareas Interactivas

- [x] Arquitectura modular con Vite + Svelte 5 + TypeScript
- [x] Sistema de diseño Mesa de Lectura con paleta ergonómica
- [x] Persistencia local segura con IndexedDB
- [x] Resaltado de sintaxis VS Code en Editor y Preview

---

## 5. Galería de Código Multi-Lenguaje

### Python 3 (Tipado estático y Clases Abstractas)

\`\`\`python
import asyncio
from dataclasses import dataclass
from typing import Protocol, Optional

@dataclass(frozen=True)
class Document:
    doc_id: str
    title: str
    content: str
    is_valid: bool = True

class MarkdownStorage(Protocol):
    async def save(self, doc: Document) -> None: ...
    async def find_by_id(self, doc_id: str) -> Optional[Document]: ...

async def main() -> None:
    doc = Document(doc_id="doc_101", title="README.md", content="# Hello World")
    print(f"Documento cargado: {doc.title}")

if __name__ == "__main__":
    asyncio.run(main())
\`\`\`

### TypeScript / JavaScript (Gestión de Eventos y Caché)

\`\`\`typescript
interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
}

export class SvgCacheManager {
  private cache = new Map<string, CacheEntry<string>>();

  public set(key: string, svg: string): void {
    this.cache.set(key, { key, value: svg, timestamp: Date.now() });
  }

  public get(key: string): string | null {
    const item = this.cache.get(key);
    return item ? item.value : null;
  }
}
\`\`\`
`;

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  viewMode: 'split',
  fontSize: 'medium',
  syncScroll: true,
  minimap: true,
  lineNumbers: true,
  splitRatio: 50,
  wordWrap: true,
};

function generateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'doc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
}

/**
 * Normaliza nombres de archivos asegurando la extensión .md.
 */
function normalizeDocTitle(rawTitle: string): string {
  const clean = rawTitle.trim();
  if (!clean) return 'documento.md';
  return clean.toLowerCase().endsWith('.md') ? clean : `${clean}.md`;
}

/**
 * Extrae encabezados del contenido Markdown para construir la tabla de contenidos (TOC).
 */
export function extractHeadings(markdown: string): TocHeading[] {
  const lines = markdown.split('\n');
  const headings: TocHeading[] = [];
  const slugCounts = new Map<string, number>();

  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('```') || line.trim().startsWith('~~~')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const rawText = match[2].trim().replace(/[*_`~[\]]/g, '');

      let slug = rawText
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');

      if (!slug) slug = `seccion-${headings.length + 1}`;

      const count = slugCounts.get(slug) || 0;
      slugCounts.set(slug, count + 1);
      const uniqueId = count > 0 ? `${slug}-${count}` : slug;

      headings.push({
        id: uniqueId,
        text: rawText,
        level,
      });
    }
  }

  return headings;
}

class DocumentStore {
  documents = $state<DocumentItem[]>([]);
  activeId = $state<string>('');
  settings = $state<Settings>(DEFAULT_SETTINGS);
  isReady = $state<boolean>(false);

  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingSaveDoc: DocumentItem | null = null;

  constructor() {
    this.loadSettings();
    this.initDatabase();

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flushPendingSave();
      });
    }
  }

  /**
   * Carga configuraciones de usuario de manera síncrona desde localStorage para arranque instantáneo.
   */
  private loadSettings(): void {
    if (typeof window === 'undefined') return;

    try {
      const rawTheme = localStorage.getItem(STORAGE_KEYS.THEME);
      const savedTheme: ThemeMode = rawTheme === 'light' ? 'light' : 'dark';
      const savedViewMode = (localStorage.getItem(STORAGE_KEYS.VIEW_MODE) as ViewMode) || 'split';
      const savedFontSize = (localStorage.getItem(STORAGE_KEYS.FONT_SIZE) as FontSize) || 'medium';
      const savedSyncScroll = localStorage.getItem(STORAGE_KEYS.SYNC_SCROLL) !== 'false';
      const savedLineNumbers = localStorage.getItem(STORAGE_KEYS.LINE_NUMBERS) !== 'false';
      const savedMinimap = localStorage.getItem(STORAGE_KEYS.MINIMAP) !== 'false';
      const savedSplitRatio = parseFloat(localStorage.getItem(STORAGE_KEYS.SPLIT_RATIO) || '50') || 50;

      this.settings = {
        theme: savedTheme,
        viewMode: savedViewMode,
        fontSize: savedFontSize,
        syncScroll: savedSyncScroll,
        lineNumbers: savedLineNumbers,
        minimap: savedMinimap,
        splitRatio: Math.max(15, Math.min(85, savedSplitRatio)),
        wordWrap: true,
      };

      const isCleanInitialized = localStorage.getItem(STORAGE_KEYS.CLEAN_INIT_FLAG) === 'true';

      if (!isCleanInitialized) {
        // Purgar de inmediato cualquier residuo de documentos en localStorage
        try {
          localStorage.removeItem(STORAGE_KEYS.DOCS);
          localStorage.removeItem(STORAGE_KEYS.TRANSITIONAL_DOCS);
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_DOC_CACHE);
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_ID);
        } catch {}
      } else {
        const savedActiveId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ID);
        if (savedActiveId) {
          this.activeId = savedActiveId;
        }

        // Cargar caché del documento activo para render instantáneo en el frame 0
        const cachedActiveRaw = localStorage.getItem(STORAGE_KEYS.ACTIVE_DOC_CACHE);
        if (cachedActiveRaw) {
          try {
            const cachedDoc = JSON.parse(cachedActiveRaw);
            if (cachedDoc && cachedDoc.id) {
              this.documents = [cachedDoc];
              if (!this.activeId) this.activeId = cachedDoc.id;
            }
          } catch {}
        }
      }
    } catch (error) {
      console.error('Error al cargar configuración inicial desde localStorage:', error);
    }
  }

  /**
   * Inicializa IndexedDB, purgando cualquier residuo previo en localStorage para arrancar 100% desde cero.
   */
  private async initDatabase(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const isCleanInitialized = localStorage.getItem(STORAGE_KEYS.CLEAN_INIT_FLAG) === 'true';

      // Si aún no se ha ejecutado el inicio limpio desde cero:
      if (!isCleanInitialized) {
        // 1. Purgar completamente las claves de documentos en localStorage
        try {
          localStorage.removeItem(STORAGE_KEYS.DOCS);
          localStorage.removeItem(STORAGE_KEYS.TRANSITIONAL_DOCS);
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_DOC_CACHE);
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_ID);
        } catch {}

        // 2. Limpiar documentos residuales de prueba en IndexedDB
        await clearAllDocumentsFromDb();

        // 3. Crear el documento inicial limpio oficial
        const initialDoc: DocumentItem = {
          id: generateId(),
          title: 'bienvenido.md',
          content: DEFAULT_MARKDOWN,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await saveDocumentToDb(initialDoc);

        // 4. Marcar que el inicio limpio ya se realizó
        try {
          localStorage.setItem(STORAGE_KEYS.CLEAN_INIT_FLAG, 'true');
          localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, initialDoc.id);
        } catch {}

        this.documents = [initialDoc];
        this.activeId = initialDoc.id;
        this.updateActiveCache(initialDoc);
        this.isReady = true;
        return;
      }

      // Flujo normal una vez inicializado con IndexedDB:
      let dbDocs = await getAllDocumentsFromDb();

      if (dbDocs.length === 0) {
        const initialDoc: DocumentItem = {
          id: generateId(),
          title: 'bienvenido.md',
          content: DEFAULT_MARKDOWN,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await saveDocumentToDb(initialDoc);
        dbDocs = [initialDoc];
      }

      this.documents = dbDocs;

      // Asegurar que activeId apunte a un documento existente
      const exists = this.documents.some((d) => d.id === this.activeId);
      if (!exists && this.documents.length > 0) {
        this.activeId = this.documents[0].id;
      }
      try {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, this.activeId);
      } catch {}

      this.updateActiveCache(this.activeDocument);
      this.isReady = true;
    } catch (error) {
      console.error('Error al inicializar IndexedDB:', error);
      if (this.documents.length === 0) {
        const fallbackDoc: DocumentItem = {
          id: generateId(),
          title: 'bienvenido.md',
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
    if (typeof window === 'undefined') return;
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
          })
        );
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_DOC_CACHE);
      }
    } catch {}
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
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, this.settings.theme);
      localStorage.setItem(STORAGE_KEYS.VIEW_MODE, this.settings.viewMode);
      localStorage.setItem(STORAGE_KEYS.FONT_SIZE, this.settings.fontSize);
      localStorage.setItem(STORAGE_KEYS.SYNC_SCROLL, String(this.settings.syncScroll));
      localStorage.setItem(STORAGE_KEYS.LINE_NUMBERS, String(this.settings.lineNumbers));
      localStorage.setItem(STORAGE_KEYS.MINIMAP, String(this.settings.minimap));
      localStorage.setItem(STORAGE_KEYS.SPLIT_RATIO, String(this.settings.splitRatio));
    } catch (error) {
      console.error('Error al guardar configuración en localStorage:', error);
    }
  }

  // --- Propiedades Derivadas ---

  get activeDocument(): DocumentItem | undefined {
    return this.documents.find((doc) => doc.id === this.activeId) || this.documents[0];
  }

  get tocHeadings(): TocHeading[] {
    const active = this.activeDocument;
    if (!active) return [];
    return extractHeadings(active.content);
  }

  get isDark(): boolean {
    return this.settings.theme === 'dark';
  }

  // --- Operaciones CRUD de Documentos ---

  createDocument(rawTitle = 'nuevo-documento.md', content = '# Nuevo Documento\n\n'): DocumentItem {
    this.flushPendingSave();
    const title = normalizeDocTitle(rawTitle);
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
    } catch {}

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
      } catch {}
      this.updateActiveCache(this.activeDocument);
    }
  }

  updateActiveContent(content: string): void {
    const doc = this.activeDocument;
    if (!doc) return;

    doc.content = content;
    doc.updatedAt = Date.now();
    this.scheduleSave(doc);
  }

  updateActiveTitle(rawTitle: string): void {
    const doc = this.activeDocument;
    if (!doc) return;

    doc.title = normalizeDocTitle(rawTitle);
    doc.updatedAt = Date.now();
    saveDocumentToDb(doc);
    this.updateActiveCache(doc);
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
      } catch {}
      this.updateActiveCache(this.activeDocument);
    }

    return true;
  }

  /**
   * Elimina todos los documentos y crea uno nuevo en blanco (Función 'Vaciar todo' de md-studio).
   */
  clearAllDocuments(): void {
    this.flushPendingSave();
    const freshDoc: DocumentItem = {
      id: generateId(),
      title: 'nuevo-documento.md',
      content: '# Nuevo Documento\n\n',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.documents = [freshDoc];
    this.activeId = freshDoc.id;
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, this.activeId);
    } catch {}
    this.updateActiveCache(freshDoc);

    clearAllDocumentsFromDb().then(() => {
      saveDocumentToDb(freshDoc);
    });
  }

  /**
   * Importa o actualiza un archivo .md / .txt desde disco o Drag & Drop.
   */
  importDocument(rawFilename: string, content: string): DocumentItem {
    this.flushPendingSave();
    const title = normalizeDocTitle(rawFilename);
    const existing = this.documents.find((d) => d.title.toLowerCase() === title.toLowerCase());

    if (existing) {
      existing.content = content;
      existing.updatedAt = Date.now();
      this.activeId = existing.id;
      try {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, this.activeId);
      } catch {}
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
    } catch {}
    this.updateActiveCache(newDoc);
    saveDocumentToDb(newDoc);

    return newDoc;
  }

  /**
   * Conmuta interactivamente una tarea en el Markdown activo según su índice ordinal.
   * Reproduce la funcionalidad clave del md-studio original.
   */
  toggleTaskCheckbox(taskIndex: number, isChecked: boolean): void {
    const doc = this.activeDocument;
    if (!doc) return;

    const md = doc.content;
    // Ocultar bloques de código para evitar modificar sintaxis dentro de ellos
    const masked = md.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (m) => ' '.repeat(m.length));
    const taskRegex = /(^|\n)(\s*[-*+]\s+\[)([ xX])(\]\s+)/g;

    let match: RegExpExecArray | null;
    let currentIndex = 0;
    let targetPos = -1;

    while ((match = taskRegex.exec(masked)) !== null) {
      if (currentIndex === taskIndex) {
        targetPos = match.index + match[1].length + match[2].length;
        break;
      }
      currentIndex++;
    }

    if (targetPos !== -1) {
      const newChar = isChecked ? 'x' : ' ';
      const updatedMd = md.substring(0, targetPos) + newChar + md.substring(targetPos + 1);
      this.updateActiveContent(updatedMd);
    }
  }

  // --- Operaciones de Configuración ---

  updateSettings(partial: Partial<Settings>): void {
    this.settings = { ...this.settings, ...partial };
    this.persistSettings();
  }

  setViewMode(mode: ViewMode): void {
    this.updateSettings({ viewMode: mode });
  }

  setFontSize(size: FontSize): void {
    this.updateSettings({ fontSize: size });
  }

  toggleTheme(): ThemeMode {
    const nextMode: ThemeMode = this.settings.theme === 'dark' ? 'light' : 'dark';
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
