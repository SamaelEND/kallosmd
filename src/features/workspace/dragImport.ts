/**
 * ES: Solo los archivos del sistema activan la zona global de importación.
 * EN: Only system files activate the global import drop zone.
 */
export function isExternalFileDrag(transfer: DataTransfer | null): boolean {
  return Boolean(transfer && Array.from(transfer.types).includes("Files"));
}

export const LOCAL_DOCUMENT_DRAG_TYPE = "application/x-kallosmd-document-id";

export function isLocalDocumentDrag(transfer: DataTransfer | null): boolean {
  return Boolean(transfer && Array.from(transfer.types).includes(LOCAL_DOCUMENT_DRAG_TYPE));
}
