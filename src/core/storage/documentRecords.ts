/**
 * ES: Registros serializables e identidades de recuperación sin colisiones.
 * EN: Serializable records and collision-free recovery identities.
 */
import type { DocumentIdentity, DocumentItem, FolderItem, RecoveryDraft } from "../types";

/**
 * ES: Normaliza un DocumentItem a un objeto plano serializable sin proxies reactivos.
 * EN: Normalizes a DocumentItem into a plain serializable object without reactive proxies.
 */
export function toPlainDoc(doc: DocumentItem): DocumentItem {
  return {
    id: String(doc.id),
    title: String(doc.title || "documento.md"),
    content: typeof doc.content === "string" ? doc.content : "",
    createdAt: Number(doc.createdAt) || Date.now(),
    updatedAt: Number(doc.updatedAt) || Date.now(),
    folderId: doc.folderId ? String(doc.folderId) : null,
    hasCustomTitle: Boolean(doc.hasCustomTitle),
    ...(Array.isArray(doc.tags) ? { tags: [...doc.tags] } : {}),
    ...(typeof doc.isFavorite === "boolean" ? { isFavorite: doc.isFavorite } : {}),
  };
}

/**
 * ES: Normaliza un FolderItem a un objeto plano serializable sin proxies reactivos.
 * EN: Normalizes a FolderItem into a plain serializable object without reactive proxies.
 */
export function toPlainFolder(folder: FolderItem): FolderItem {
  return {
    id: String(folder.id),
    name: String(folder.name || "Nueva Carpeta"),
    createdAt: Number(folder.createdAt) || Date.now(),
    updatedAt: Number(folder.updatedAt) || Date.now(),
    isExpanded: folder.isExpanded !== false,
  };
}

/**
 * ES: Codifica la identidad completa; rechaza rutas ambiguas o fuera del espacio de trabajo.
 * EN: Encodes the full identity; rejects ambiguous paths or paths outside the workspace.
 */
export function getDraftKey(identity: DocumentIdentity): string {
  if (identity.kind === "local" && typeof identity.id === "string" && identity.id) {
    return JSON.stringify(["local", identity.id]);
  }
  if (identity.kind === "file" && typeof identity.workspaceId === "string" && identity.workspaceId
    && typeof identity.path === "string" && identity.path
    && !/[\\\x00-\x1f]/.test(identity.path)
    && !identity.path.split("/").some(part => !part || part === "." || part === "..")
    && !/^[a-z]:/i.test(identity.path)) {
    return JSON.stringify(["file", identity.workspaceId, identity.path]);
  }
  throw new Error("Invalid document identity");
}

/**
 * ES: Valida y copia campos permitidos antes de persistir o recuperar una instantánea.
 * EN: Validates and copies allowed fields before persisting or recovering a snapshot.
 */
export function toPlainDraft(draft: RecoveryDraft): RecoveryDraft {
  const key = getDraftKey(draft.identity);
  const expectedId = draft.identity.kind === "local" ? draft.identity.id : key;
  if (draft.key !== key || draft.document.id !== expectedId
    || typeof draft.document.content !== "string"
    || typeof draft.document.title !== "string"
    || !(draft.confirmedContent === null || typeof draft.confirmedContent === "string")) {
    throw new Error("Invalid recovery draft");
  }
  const handle = draft.fileHandle;
  if (handle !== undefined && (typeof handle.name !== "string" || typeof handle.getFile !== "function"
    || typeof handle.createWritable !== "function" || typeof handle.isSameEntry !== "function")) {
    throw new Error("Invalid recovery file reference");
  }
  const identity: DocumentIdentity = draft.identity.kind === "local"
    ? { kind: "local", id: draft.identity.id }
    : { kind: "file", workspaceId: draft.identity.workspaceId, path: draft.identity.path };
  return { key, identity, confirmedContent: draft.confirmedContent, document: toPlainDoc(draft.document),
    ...(handle ? { fileHandle: handle } : {}) };
}
