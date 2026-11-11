/**
 * ES: Formato de respaldo versionado del modo local. Valida el archivo completo antes de restaurar
 * y no incluye handles ni rutas absolutas; solo los campos permitidos de los modelos existentes.
 * EN: Versioned local-mode backup format. Validates the whole file before restoring and keeps native
 * handles and absolute paths out; only allowed fields from the existing models are serialized.
 */
import type { DocumentIdentity, DocumentItem, FolderItem, RecoveryDraft } from "../types";
import { getDraftKey, toPlainDraft, toPlainDoc, toPlainFolder } from "./documentRecords";

export const BACKUP_FORMAT = "kallosmd-backup";
export const BACKUP_VERSION = 1;

/** ES: Borrador serializable; nunca transporta el handle nativo del archivo.
 * EN: Serializable draft; never carries the native file handle. */
export type BackupDraft = Omit<RecoveryDraft, "fileHandle">;

export interface BackupData {
  documents: DocumentItem[];
  folders: FolderItem[];
  drafts: BackupDraft[];
}

export interface BackupFile extends BackupData {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: number;
}

export interface BackupRestore extends BackupData {
  /** ES: Reemplaza solo las identidades que coinciden; el resto se conserva.
   * EN: Replaces only matching identities; everything else is kept. */
  replace: boolean;
  /** ES: Comprueba que no hubo ediciones durante la restauración antes de confirmar la escritura.
   * EN: Checks that no edits happened during restoration before committing the write. */
  guard?: () => boolean;
}

export type BackupErrorCode = "malformed" | "invalidFormat" | "unsupportedVersion";

export class BackupValidationError extends Error {
  readonly code: BackupErrorCode;

  constructor(code: BackupErrorCode, message = "Invalid backup") {
    super(message);
    this.name = "BackupValidationError";
    this.code = code;
  }
}

/** ES: Se lanza sin modificar nada cuando hay colisiones y no se pidió reemplazo.
 * EN: Thrown without modifying anything when collisions exist and replacement was not requested. */
export class BackupCollisionError extends Error {
  constructor(message = "Backup collides with existing data") {
    super(message);
    this.name = "BackupCollisionError";
  }
}

/** ES: Se lanza y revierte la transacción si el usuario editó durante la importación.
 * EN: Thrown to roll back the transaction if the user edited during import. */
export class BackupChangedError extends Error {
  constructor(message = "Data changed during backup import") {
    super(message);
    this.name = "BackupChangedError";
  }
}

function fail(code: BackupErrorCode = "malformed"): never {
  throw new BackupValidationError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown): string {
  if (typeof value !== "string" || !value) fail();
  return value;
}

function text(value: unknown): string {
  if (typeof value !== "string") fail();
  return value;
}

function timestamp(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail();
  return value;
}

function readIdentity(value: unknown): DocumentIdentity {
  if (!isRecord(value)) fail();
  if (value.kind === "local") {
    return { kind: "local", id: requiredText(value.id) };
  }
  if (value.kind === "file") {
    const identity = {
      kind: "file" as const,
      workspaceId: requiredText(value.workspaceId),
      path: requiredText(value.path),
    };
    try {
      getDraftKey(identity);
    } catch {
      fail();
    }
    return identity;
  }
  return fail();
}

function readFolders(value: unknown): FolderItem[] {
  if (!Array.isArray(value)) fail();
  const ids = new Set<string>();
  return value.map((raw) => {
    if (!isRecord(raw)) fail();
    const id = requiredText(raw.id);
    if (ids.has(id)) fail();
    ids.add(id);
    return {
      id,
      name: requiredText(raw.name),
      createdAt: timestamp(raw.createdAt),
      updatedAt: timestamp(raw.updatedAt),
      // ES: v1 exige el campo y su tipo; no se corrigen valores inválidos en silencio.
      // EN: v1 requires the field and its type; invalid values are not silently corrected.
      isExpanded: requiredBoolean(raw.isExpanded),
    };
  });
}

function requiredBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") fail();
  return value;
}

function readDocuments(value: unknown, folderIds: Set<string>): DocumentItem[] {
  if (!Array.isArray(value)) fail();
  const ids = new Set<string>();
  return value.map((raw) => {
    if (!isRecord(raw)) fail();
    return readDocument(raw, folderIds, ids);
  });
}

function readDocument(
  raw: Record<string, unknown>, folderIds: Set<string>, ids: Set<string>,
): DocumentItem {
  const id = requiredText(raw.id);
  if (ids.has(id)) fail();
  ids.add(id);
  if (!("folderId" in raw)) fail();
  const folderId = raw.folderId === null ? null : requiredText(raw.folderId);
  // ES: Una referencia rota mezclaría la jerarquía; se rechaza el archivo completo.
  // EN: A broken reference would silently mix the hierarchy; the whole file is rejected.
  if (folderId && !folderIds.has(folderId)) fail();
  const document: DocumentItem = {
    id,
    title: text(raw.title),
    content: text(raw.content),
    createdAt: timestamp(raw.createdAt),
    updatedAt: timestamp(raw.updatedAt),
    folderId,
    hasCustomTitle: requiredBoolean(raw.hasCustomTitle),
  };
  if (raw.tags !== undefined) {
    if (!Array.isArray(raw.tags) || !raw.tags.every(tag => typeof tag === "string")) fail();
    document.tags = [...raw.tags];
  }
  if (raw.isFavorite !== undefined) {
    if (typeof raw.isFavorite !== "boolean") fail();
    document.isFavorite = raw.isFavorite;
  }
  return document;
}

function readDrafts(value: unknown, folderIds: Set<string>): BackupDraft[] {
  if (!Array.isArray(value)) fail();
  const keys = new Set<string>();
  const documentIds = new Set<string>();
  return value.map((raw) => {
    if (!isRecord(raw)) fail();
    // ES: Un respaldo nunca debe transportar referencias nativas del navegador.
    // EN: A backup must never carry native browser references.
    if ("fileHandle" in raw) fail();
    const key = requiredText(raw.key);
    if (keys.has(key)) fail();
    keys.add(key);
    const identity = readIdentity(raw.identity);
    if (raw.confirmedContent !== null && typeof raw.confirmedContent !== "string") fail();
    if (!isRecord(raw.document)) fail();
    const document = readDocument(raw.document, folderIds, documentIds);
    let plain: RecoveryDraft;
    try {
      plain = toPlainDraft({ key, identity, confirmedContent: raw.confirmedContent, document });
    } catch {
      fail();
    }
    if (plain.key !== key) fail();
    return { key, identity, confirmedContent: raw.confirmedContent, document: plain.document };
  });
}

/** ES: Lee y valida la carga útil; no toca almacenamiento.
 * EN: Reads and validates the payload; does not touch storage. */
function readData(raw: Record<string, unknown>): BackupData {
  const folders = readFolders(raw.folders);
  const folderIds = new Set(folders.map(folder => folder.id));
  return {
    folders,
    documents: readDocuments(raw.documents, folderIds),
    drafts: readDrafts(raw.drafts, folderIds),
  };
}

/** ES: Normaliza el estado actual antes de exportarlo.
 * EN: Normalizes the current state before exporting it. */
export function toBackupData(snapshot: BackupData): BackupData {
  try {
    return readData({
      documents: snapshot.documents.map(toPlainDoc),
      folders: snapshot.folders.map(toPlainFolder),
      drafts: snapshot.drafts.map((draft) => {
        const { fileHandle: _handle, ...plain } = toPlainDraft(draft);
        return plain;
      }),
    });
  } catch (error) {
    if (error instanceof BackupValidationError) throw error;
    throw new BackupValidationError("malformed");
  }
}

export function createBackupText(
  snapshot: BackupData,
  exportedAt = Date.now(),
): string {
  const data = toBackupData(snapshot);
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: timestamp(exportedAt),
    ...data,
  };
  return JSON.stringify(file, null, 2);
}

/** ES: Comprueba formato, versión y cada entrada antes de devolver datos utilizables.
 * EN: Checks format, version, and every entry before returning usable data. */
export function parseBackup(content: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    fail();
  }
  if (!isRecord(parsed)) fail();
  if (parsed.format !== BACKUP_FORMAT) fail("invalidFormat");
  if (parsed.version !== BACKUP_VERSION) fail("unsupportedVersion");
  const exportedAt = timestamp(parsed.exportedAt);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    ...readData(parsed),
  };
}

/** ES: Cuenta los registros actuales que el respaldo reemplazaría.
 * EN: Counts current records the backup would replace. */
export function countBackupConflicts(current: BackupData, incoming: BackupData): number {
  const folderIds = new Set(current.folders.map(folder => folder.id));
  const incomingFolderIds = new Set(incoming.folders.map(folder => folder.id));
  const incomingDocumentIds = new Set([
    ...incoming.documents.map(document => document.id),
    ...incoming.drafts.map(draft => draft.document.id),
  ]);
  const incomingDraftKeys = new Set(incoming.drafts.map(draft => draft.key));

  const folders = current.folders.filter(folder => incomingFolderIds.has(folder.id)).length;
  const documents = current.documents.filter(document => incomingDocumentIds.has(document.id)).length;
  const drafts = current.drafts.filter(draft => incomingDraftKeys.has(draft.key)
    || incomingDocumentIds.has(draft.document.id)).length;
  return folders + documents + drafts;
}
