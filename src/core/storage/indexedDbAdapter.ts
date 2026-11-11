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
import { getAllDraftsFromDb, saveDraftToDb, deleteDraftFromDb, clearAllDraftsFromDb, replaceDraftsInDb } from "./draftDb";
import { restoreBackupToDb } from "./backupDb";
import type { StorageAdapter } from "./storagePort";

export const indexedDbAdapter: StorageAdapter = {
  restoreBackup: restoreBackupToDb,

  getAllDrafts: getAllDraftsFromDb,
  saveDraft: saveDraftToDb,
  replaceDrafts: replaceDraftsInDb,
  deleteDraft: deleteDraftFromDb,
  clearAllDrafts: clearAllDraftsFromDb,

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

