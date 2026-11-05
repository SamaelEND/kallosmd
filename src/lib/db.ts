/**
 * Capa de persistencia local en IndexedDB para MD Studio.
 * Utiliza 'idb' para manejar la base de datos de forma asíncrona,
 * sin bloquear el hilo principal y con capacidad prácticamente ilimitada.
 */
import { openDB, type IDBPDatabase } from 'idb';
import type { DocumentItem, FolderItem } from '../types';

const DB_NAME = 'md_studio_db';
const DB_VERSION = 2;
const STORE_NAME = 'documents';
const FOLDERS_STORE_NAME = 'folders';

export interface MdStudioDbSchema {
  documents: {
    key: string;
    value: DocumentItem;
    indexes: {
      by_updated: number;
    };
  };
  folders: {
    key: string;
    value: FolderItem;
    indexes: {
      by_updated: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<MdStudioDbSchema>> | null = null;

/**
 * Normaliza un DocumentItem a un objeto plano sin proxies reactivos.
 */
function toPlainDoc(doc: DocumentItem): DocumentItem {
  return {
    id: String(doc.id),
    title: String(doc.title || 'documento.md'),
    content: typeof doc.content === 'string' ? doc.content : '',
    createdAt: Number(doc.createdAt) || Date.now(),
    updatedAt: Number(doc.updatedAt) || Date.now(),
    folderId: doc.folderId ? String(doc.folderId) : null,
    hasCustomTitle: Boolean(doc.hasCustomTitle),
  };
}

/**
 * Normaliza un FolderItem a un objeto plano sin proxies reactivos.
 */
function toPlainFolder(folder: FolderItem): FolderItem {
  return {
    id: String(folder.id),
    name: String(folder.name || 'Nueva Carpeta'),
    createdAt: Number(folder.createdAt) || Date.now(),
    updatedAt: Number(folder.updatedAt) || Date.now(),
    isExpanded: folder.isExpanded !== false,
  };
}

/**
 * Obtiene la conexión singleton a la base de datos IndexedDB.
 */
export function getDb(): Promise<IDBPDatabase<MdStudioDbSchema>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB solo está disponible en el navegador.'));
  }

  if (!dbPromise) {
    dbPromise = openDB<MdStudioDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('by_updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains(FOLDERS_STORE_NAME)) {
          const folderStore = db.createObjectStore(FOLDERS_STORE_NAME, { keyPath: 'id' });
          folderStore.createIndex('by_updated', 'updatedAt');
        }
      },
    });
  }

  return dbPromise;
}

/**
 * Obtiene todos los documentos almacenados en IndexedDB.
 */
export async function getAllDocumentsFromDb(): Promise<DocumentItem[]> {
  try {
    const db = await getDb();
    const docs = await db.getAll(STORE_NAME);
    // Ordenar por fecha de modificación descendente (más recientes primero)
    return docs.map(toPlainDoc).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.error('Error al leer documentos desde IndexedDB:', error);
    return [];
  }
}

/**
 * Guarda o actualiza un documento individual en IndexedDB.
 */
export async function saveDocumentToDb(doc: DocumentItem): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE_NAME, toPlainDoc(doc));
  } catch (error) {
    console.error(`Error al guardar documento [${doc.id}] en IndexedDB:`, error);
  }
}

/**
 * Guarda un conjunto completo de documentos en una sola transacción.
 */
export async function saveAllDocumentsToDb(docs: DocumentItem[]): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const plainDocs = docs.map(toPlainDoc);
    await Promise.all([
      ...plainDocs.map((d) => tx.store.put(d)),
      tx.done,
    ]);
  } catch (error) {
    console.error('Error al guardar lote de documentos en IndexedDB:', error);
  }
}

/**
 * Elimina un documento por su ID de IndexedDB.
 */
export async function deleteDocumentFromDb(id: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(STORE_NAME, id);
  } catch (error) {
    console.error(`Error al eliminar documento [${id}] de IndexedDB:`, error);
  }
}

/**
 * Vacía todos los documentos de IndexedDB.
 */
export async function clearAllDocumentsFromDb(): Promise<void> {
  try {
    const db = await getDb();
    await db.clear(STORE_NAME);
  } catch (error) {
    console.error('Error al vaciar documentos en IndexedDB:', error);
  }
}

/**
 * Obtiene todas las carpetas almacenadas en IndexedDB.
 */
export async function getAllFoldersFromDb(): Promise<FolderItem[]> {
  try {
    const db = await getDb();
    if (!db.objectStoreNames.contains(FOLDERS_STORE_NAME)) {
      return [];
    }
    const folders = await db.getAll(FOLDERS_STORE_NAME);
    return folders.map(toPlainFolder).sort((a, b) => a.createdAt - b.createdAt);
  } catch (error) {
    console.error('Error al leer carpetas desde IndexedDB:', error);
    return [];
  }
}

/**
 * Guarda o actualiza una carpeta individual en IndexedDB.
 */
export async function saveFolderToDb(folder: FolderItem): Promise<void> {
  try {
    const db = await getDb();
    await db.put(FOLDERS_STORE_NAME, toPlainFolder(folder));
  } catch (error) {
    console.error(`Error al guardar carpeta [${folder.id}] en IndexedDB:`, error);
  }
}

/**
 * Guarda un conjunto completo de carpetas en una sola transacción.
 */
export async function saveAllFoldersToDb(folders: FolderItem[]): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(FOLDERS_STORE_NAME, 'readwrite');
    const plainFolders = folders.map(toPlainFolder);
    await Promise.all([
      ...plainFolders.map((f) => tx.store.put(f)),
      tx.done,
    ]);
  } catch (error) {
    console.error('Error al guardar lote de carpetas en IndexedDB:', error);
  }
}

/**
 * Elimina una carpeta por su ID de IndexedDB.
 */
export async function deleteFolderFromDb(id: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(FOLDERS_STORE_NAME, id);
  } catch (error) {
    console.error(`Error al eliminar carpeta [${id}] de IndexedDB:`, error);
  }
}

/**
 * Vacía todas las carpetas en IndexedDB.
 */
export async function clearAllFoldersFromDb(): Promise<void> {
  try {
    const db = await getDb();
    if (db.objectStoreNames.contains(FOLDERS_STORE_NAME)) {
      await db.clear(FOLDERS_STORE_NAME);
    }
  } catch (error) {
    console.error('Error al vaciar carpetas en IndexedDB:', error);
  }
}
