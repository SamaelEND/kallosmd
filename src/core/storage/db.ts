/**
 * ES: Capa de persistencia local asíncrona en IndexedDB para documentos y carpetas de Markdown Studio.
 * EN: Asynchronous local persistence layer in IndexedDB for Markdown Studio documents and folders.
 */
import { openDB, type IDBPDatabase } from "idb";
import type { DocumentItem, FolderItem, RecoveryDraft } from "../types";
import { toPlainDoc, toPlainFolder } from "./documentRecords";
import type { WorkspaceReference } from "./workspacePort";
import type { RetireDocumentOutcome, RetireExpectation } from "./storagePort";

const DB_NAME = "md_studio_db";
const DB_VERSION = 4;
const STORE_NAME = "documents";
const FOLDERS_STORE_NAME = "folders";

export interface MdStudioDbSchema {
  workspaces: { key: string; value: WorkspaceReference; };
  recoveryDrafts: { key: string; value: RecoveryDraft; };
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
        if (!db.objectStoreNames.contains("workspaces")) {
          db.createObjectStore("workspaces", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("recoveryDrafts")) {
          db.createObjectStore("recoveryDrafts", { keyPath: "key" });
        }
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
  const db = await getDb();
  const docs = await db.getAll(STORE_NAME);
  return docs.map(toPlainDoc).sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * ES: Guarda o actualiza un documento individual en IndexedDB.
 * EN: Saves or updates an individual document in IndexedDB.
 */
export async function saveDocumentToDb(doc: DocumentItem): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, toPlainDoc(doc));
}

/**
 * ES: Guarda un conjunto completo de documentos en una sola transacción de lectura/escritura.
 * EN: Saves a complete set of documents in a single read/write transaction.
 */
export async function saveAllDocumentsToDb(
  docs: DocumentItem[],
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const plainDocs = docs.map(toPlainDoc);
  await Promise.all([...plainDocs.map((d) => tx.store.put(d)), tx.done]);
}

/**
 * ES: Elimina un documento de IndexedDB mediante su identificador.
 * EN: Deletes a document from IndexedDB by its identifier.
 */
export async function deleteDocumentFromDb(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, id);
}

/**
 * ES: Retira documento y borrador en una sola transacción, comprobando que ninguno
 * contenga una versión posterior a la verificada. Una edición concurrente cancela el borrado.
 * EN: Retires document and draft in a single transaction, checking that neither holds a
 * version newer than the verified one. A concurrent edit cancels the deletion.
 */
export async function retireDocumentIfUnchangedFromDb(
  id: string,
  draftKey: string,
  expected: RetireExpectation,
): Promise<RetireDocumentOutcome> {
  const db = await getDb();
  const tx = db.transaction([STORE_NAME, "recoveryDrafts"], "readwrite");
  const [doc, draft] = await Promise.all([
    tx.objectStore(STORE_NAME).get(id),
    tx.objectStore("recoveryDrafts").get(draftKey),
  ]);

  const isNewer = (record: { content: string; updatedAt: number } | undefined): boolean =>
    Boolean(record) && (
      record!.updatedAt > expected.updatedAt
      || (record!.updatedAt === expected.updatedAt && record!.content !== expected.content)
    );

  if (isNewer(doc) || isNewer(draft?.document)) {
    await tx.done;
    return "edited";
  }
  if (!doc && !draft) {
    await tx.done;
    return "missing";
  }

  await Promise.all([
    tx.objectStore(STORE_NAME).delete(id),
    tx.objectStore("recoveryDrafts").delete(draftKey),
  ]);
  await tx.done;
  return "retired";
}

/**
 * ES: Vacía todos los documentos almacenados en IndexedDB.
 * EN: Clears all documents stored in IndexedDB.
 */
export async function clearAllDocumentsFromDb(): Promise<void> {
  const db = await getDb();
  await db.clear(STORE_NAME);
}

/**
 * ES: Obtiene todas las carpetas almacenadas en IndexedDB ordenadas por fecha de creación.
 * EN: Retrieves all folders stored in IndexedDB sorted by creation date.
 */
export async function getAllFoldersFromDb(): Promise<FolderItem[]> {
  const db = await getDb();
  if (!db.objectStoreNames.contains(FOLDERS_STORE_NAME)) {
    return [];
  }
  const folders = await db.getAll(FOLDERS_STORE_NAME);
  return folders
    .map(toPlainFolder)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * ES: Guarda o actualiza una carpeta individual en IndexedDB.
 * EN: Saves or updates an individual folder in IndexedDB.
 */
export async function saveFolderToDb(folder: FolderItem): Promise<void> {
  const db = await getDb();
  await db.put(FOLDERS_STORE_NAME, toPlainFolder(folder));
}

/**
 * ES: Guarda un conjunto completo de carpetas en una sola transacción de lectura/escritura.
 * EN: Saves a complete set of folders in a single read/write transaction.
 */
export async function saveAllFoldersToDb(
  folders: FolderItem[],
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(FOLDERS_STORE_NAME, "readwrite");
  const plainFolders = folders.map(toPlainFolder);
  await Promise.all([
    ...plainFolders.map((f) => tx.store.put(f)),
    tx.done,
  ]);
}

/**
 * ES: Elimina una carpeta de IndexedDB mediante su identificador.
 * EN: Deletes a folder from IndexedDB by its identifier.
 */
export async function deleteFolderFromDb(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(FOLDERS_STORE_NAME, id);
}

/**
 * ES: Vacía todas las carpetas almacenadas en IndexedDB.
 * EN: Clears all folders stored in IndexedDB.
 */
export async function clearAllFoldersFromDb(): Promise<void> {
  const db = await getDb();
  if (db.objectStoreNames.contains(FOLDERS_STORE_NAME)) {
    await db.clear(FOLDERS_STORE_NAME);
  }
}
