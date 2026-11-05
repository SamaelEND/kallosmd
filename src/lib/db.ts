/**
 * ES: Capa de persistencia local asíncrona en IndexedDB para documentos y carpetas de Markdown Studio.
 * EN: Asynchronous local persistence layer in IndexedDB for Markdown Studio documents and folders.
 */
import { openDB, type IDBPDatabase } from "idb";
import type { DocumentItem, FolderItem } from "../types";

const DB_NAME = "md_studio_db";
const DB_VERSION = 2;
const STORE_NAME = "documents";
const FOLDERS_STORE_NAME = "folders";

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
 * ES: Normaliza un DocumentItem a un objeto plano serializable sin proxies reactivos.
 * EN: Normalizes a DocumentItem into a plain serializable object without reactive proxies.
 */
function toPlainDoc(doc: DocumentItem): DocumentItem {
  return {
    id: String(doc.id),
    title: String(doc.title || "documento.md"),
    content: typeof doc.content === "string" ? doc.content : "",
    createdAt: Number(doc.createdAt) || Date.now(),
    updatedAt: Number(doc.updatedAt) || Date.now(),
    folderId: doc.folderId ? String(doc.folderId) : null,
    hasCustomTitle: Boolean(doc.hasCustomTitle),
  };
}

/**
 * ES: Normaliza un FolderItem a un objeto plano serializable sin proxies reactivos.
 * EN: Normalizes a FolderItem into a plain serializable object without reactive proxies.
 */
function toPlainFolder(folder: FolderItem): FolderItem {
  return {
    id: String(folder.id),
    name: String(folder.name || "Nueva Carpeta"),
    createdAt: Number(folder.createdAt) || Date.now(),
    updatedAt: Number(folder.updatedAt) || Date.now(),
    isExpanded: folder.isExpanded !== false,
  };
}

/**
 * ES: Obtiene la conexión singleton a la base de datos IndexedDB e inicializa los almacenes de objetos.
 * EN: Retrieves the singleton connection to the IndexedDB database and initializes object stores.
 */
export function getDb(): Promise<IDBPDatabase<MdStudioDbSchema>> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("IndexedDB solo está disponible en el navegador."),
    );
  }

  if (!dbPromise) {
    dbPromise = openDB<MdStudioDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("by_updated", "updatedAt");
        }
        if (!db.objectStoreNames.contains(FOLDERS_STORE_NAME)) {
          const folderStore = db.createObjectStore(FOLDERS_STORE_NAME, {
            keyPath: "id",
          });
          folderStore.createIndex("by_updated", "updatedAt");
        }
      },
    });
  }

  return dbPromise;
}

/**
 * ES: Obtiene todos los documentos almacenados en IndexedDB ordenados por fecha de modificación descendente.
 * EN: Retrieves all documents stored in IndexedDB sorted by modification date descending.
 */
export async function getAllDocumentsFromDb(): Promise<DocumentItem[]> {
  try {
    const db = await getDb();
    const docs = await db.getAll(STORE_NAME);
    return docs.map(toPlainDoc).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.error("Error al leer documentos desde IndexedDB:", error);
    return [];
  }
}

/**
 * ES: Guarda o actualiza un documento individual en IndexedDB.
 * EN: Saves or updates an individual document in IndexedDB.
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
 * ES: Guarda un conjunto completo de documentos en una sola transacción de lectura/escritura.
 * EN: Saves a complete set of documents in a single read/write transaction.
 */
export async function saveAllDocumentsToDb(
  docs: DocumentItem[],
): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const plainDocs = docs.map(toPlainDoc);
    await Promise.all([...plainDocs.map((d) => tx.store.put(d)), tx.done]);
  } catch (error) {
    console.error("Error al guardar lote de documentos en IndexedDB:", error);
  }
}

/**
 * ES: Elimina un documento de IndexedDB mediante su identificador.
 * EN: Deletes a document from IndexedDB by its identifier.
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
 * ES: Vacía todos los documentos almacenados en IndexedDB.
 * EN: Clears all documents stored in IndexedDB.
 */
export async function clearAllDocumentsFromDb(): Promise<void> {
  try {
    const db = await getDb();
    await db.clear(STORE_NAME);
  } catch (error) {
    console.error("Error al vaciar documentos en IndexedDB:", error);
  }
}

/**
 * ES: Obtiene todas las carpetas almacenadas en IndexedDB ordenadas por fecha de creación.
 * EN: Retrieves all folders stored in IndexedDB sorted by creation date.
 */
export async function getAllFoldersFromDb(): Promise<FolderItem[]> {
  try {
    const db = await getDb();
    if (!db.objectStoreNames.contains(FOLDERS_STORE_NAME)) {
      return [];
    }
    const folders = await db.getAll(FOLDERS_STORE_NAME);
    return folders
      .map(toPlainFolder)
      .sort((a, b) => a.createdAt - b.createdAt);
  } catch (error) {
    console.error("Error al leer carpetas desde IndexedDB:", error);
    return [];
  }
}

/**
 * ES: Guarda o actualiza una carpeta individual en IndexedDB.
 * EN: Saves or updates an individual folder in IndexedDB.
 */
export async function saveFolderToDb(folder: FolderItem): Promise<void> {
  try {
    const db = await getDb();
    await db.put(FOLDERS_STORE_NAME, toPlainFolder(folder));
  } catch (error) {
    console.error(
      `Error al guardar carpeta [${folder.id}] en IndexedDB:`,
      error,
    );
  }
}

/**
 * ES: Guarda un conjunto completo de carpetas en una sola transacción de lectura/escritura.
 * EN: Saves a complete set of folders in a single read/write transaction.
 */
export async function saveAllFoldersToDb(
  folders: FolderItem[],
): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(FOLDERS_STORE_NAME, "readwrite");
    const plainFolders = folders.map(toPlainFolder);
    await Promise.all([
      ...plainFolders.map((f) => tx.store.put(f)),
      tx.done,
    ]);
  } catch (error) {
    console.error("Error al guardar lote de carpetas en IndexedDB:", error);
  }
}

/**
 * ES: Elimina una carpeta de IndexedDB mediante su identificador.
 * EN: Deletes a folder from IndexedDB by its identifier.
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
 * ES: Vacía todas las carpetas almacenadas en IndexedDB.
 * EN: Clears all folders stored in IndexedDB.
 */
export async function clearAllFoldersFromDb(): Promise<void> {
  try {
    const db = await getDb();
    if (db.objectStoreNames.contains(FOLDERS_STORE_NAME)) {
      await db.clear(FOLDERS_STORE_NAME);
    }
  } catch (error) {
    console.error("Error al vaciar carpetas en IndexedDB:", error);
  }
}
