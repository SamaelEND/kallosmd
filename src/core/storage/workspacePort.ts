/** ES: Referencias y capacidades de carpetas; independientes de los borradores y escrituras de archivos.
 * EN: Directory references and capabilities, independent of drafts and file writes. */
import type { SaveFileHandle } from "../types";

export interface WorkspaceFileHandle extends SaveFileHandle {
  readonly kind: "file";
  // ES: Capacidad nativa de renombrado o movimiento según soporte del navegador.
  // EN: Native rename or move capability depending on browser support.
  move?(newName: string): Promise<void>;
  move?(destination: DirectoryHandle, newName?: string): Promise<void>;
}

export interface DirectoryHandle {
  readonly kind: "directory";
  readonly name: string;
  values(): AsyncIterable<DirectoryHandle | WorkspaceFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<WorkspaceFileHandle>;
  isSameEntry(other: DirectoryHandle): Promise<boolean>;
  queryPermission(options: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission(options: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  removeEntry?(name: string, options?: { recursive?: boolean }): Promise<void>;
  move?(newName: string): Promise<void>;
  move?(destination: DirectoryHandle, newName?: string): Promise<void>;
}

export interface WorkspaceReference {
  id: string;
  name: string;
  handle: DirectoryHandle;
  lastUsed: number;
  pendingChange?: { path: string; newPath: string | null };
}

export interface WorkspaceReferencePort {
  getWorkspaces(): Promise<WorkspaceReference[]>;
  saveWorkspace(workspace: WorkspaceReference): Promise<void>;
}

export interface WorkspaceEntry {
  kind: "directory" | "file";
  name: string;
  path: string;
}
