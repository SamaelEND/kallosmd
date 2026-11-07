/**
 * ES: Adaptador de almacenamiento local sobre IndexedDB que implementa el contrato StorageAdapter.
 * EN: IndexedDB local storage adapter implementing the StorageAdapter contract.
 */

import {
  clearAllDocumentsFromDb,
  clearAllFoldersFromDb,
  deleteDocumentFromDb,
  deleteFolderFromDb,
  getAllDocumentsFromDb,
  getAllFoldersFromDb,
  saveAllDocumentsToDb,
  saveAllFoldersToDb,
  saveDocumentToDb,
  saveFolderToDb,
} from "./db";
import type { StorageAdapter } from "./storagePort";

export const indexedDbAdapter: StorageAdapter = {
  getAllDocuments: getAllDocumentsFromDb,
  saveDocument: saveDocumentToDb,
  saveAllDocuments: saveAllDocumentsToDb,
  deleteDocument: deleteDocumentFromDb,
  clearAllDocuments: clearAllDocumentsFromDb,

  getAllFolders: getAllFoldersFromDb,
  saveFolder: saveFolderToDb,
  saveAllFolders: saveAllFoldersToDb,
  deleteFolder: deleteFolderFromDb,
  clearAllFolders: clearAllFoldersFromDb,
};

