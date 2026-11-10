/** ES: Sesión de carpeta real; reabrir es explícito y explorar nunca importa documentos.
 * EN: Real directory session; reopening is explicit and browsing never imports documents. */
import { directoryAt, listWorkspaceDirectory, pickWorkspaceDirectory, workspacePathParts } from "../../core/storage/fileSystemAdapter";
import { workspaceReferences } from "../../core/storage/workspaceDb";
import {
  createWorkspaceFolder,
  deleteWorkspaceEntry,
  EntryCollisionError,
  FolderCollisionError,
  isValidEntryName,
  isValidFolderName,
  moveWorkspaceEntry,
  renameWorkspaceEntry,
  splitWorkspacePath,
  UnsupportedCapabilityError,
} from "../../core/storage/workspaceOperations";
import type { DirectoryHandle, WorkspaceEntry, WorkspaceReference, WorkspaceReferencePort } from "../../core/storage/workspacePort";
import { generateId } from "../../shared/utils/formatters";
import { vaultStore, type DocumentStore } from "./vaultStore.svelte";
import { assertWorkspaceDestination } from "./workspaceDraftSync";
import { PendingWorkspaceChangeError, protectWorkspaceDrafts, resumeWorkspaceChange, WorkspaceStorageError, workspaceEntryAt } from "./workspaceChangeRecovery";

export class WorkspaceStore {
  current = $state.raw<WorkspaceReference | null>(null);
  last = $state.raw<WorkspaceReference | null>(null);
  entries = $state<WorkspaceEntry[]>([]);
  busy = $state(false);
  error = $state<"permission" | "storage" | "read" | "unsupported" | "invalidName" | "collision" | "write" | "pendingChange" | "saving" | null>(null);
  createdFolder = $state("");
  private references: WorkspaceReference[] = [];
  private initialization: Promise<void> | null = null;
  private documents: DocumentStore;
  private storage: WorkspaceReferencePort;
  private picker: () => Promise<DirectoryHandle> | null;

  constructor(documents: DocumentStore, storage = workspaceReferences, picker = pickWorkspaceDirectory) {
    this.documents = documents;
    this.storage = storage;
    this.picker = picker;
  }

  initialize(): Promise<void> {
    return this.initialization ??= this.storage.getWorkspaces().then(records => {
      this.references = records;
      this.last = [...records].sort((a, b) => b.lastUsed - a.lastUsed)[0] ?? null;
    }).catch(() => {
      this.error = "storage";
      this.initialization = null;
      throw new Error("Workspace references unavailable");
    });
  }

  async choose(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = null;
    try {
      // ES: El selector se invoca antes de esperar almacenamiento para conservar el gesto.
      // EN: Invoke the picker before awaiting storage to retain user activation.
      const picked = this.picker();
      if (!picked) { this.error = "unsupported"; return; }
      const handle = await picked;
      await this.initialize();
      let previous: WorkspaceReference | undefined;
      for (const reference of this.references) {
        if (await handle.isSameEntry(reference.handle)) { previous = reference; break; }
      }
      await this.activate(handle, previous?.id ?? generateId(), previous?.pendingChange);
    } catch (error) {
      this.report(error);
    } finally {
      this.busy = false;
    }
  }

  async reopen(): Promise<void> {
    if (this.busy || !this.last) return;
    this.busy = true;
    this.error = null;
    try {
      const reference = this.last;
      // ES: Pedir permiso directamente desde el clic; nunca durante la restauración inicial.
      // EN: Request permission directly from the click, never during initial restoration.
      const permission = await reference.handle.requestPermission({ mode: "read" });
      if (permission !== "granted") { this.error = "permission"; return; }
      await this.activate(reference.handle, reference.id, reference.pendingChange);
    } catch (error) {
      this.report(error);
    } finally {
      this.busy = false;
    }
  }

  private async activate(handle: DirectoryHandle, id: string, pendingChange?: WorkspaceReference["pendingChange"]): Promise<void> {
    if (await handle.queryPermission({ mode: "read" }) !== "granted") {
      this.error = "permission";
      return;
    }
    const reference: WorkspaceReference = { id, name: handle.name, handle,
      ...(pendingChange ? { pendingChange } : {}),
      lastUsed: Math.max(Date.now(), ...this.references.map(r => r.lastUsed + 1)) };
    try {
      if (pendingChange) {
        if (this.documents.fileSave.busy) { this.error = "saving"; return; }
        this.documents.workspaceMutation = true;
        try { await resumeWorkspaceChange(this.documents, reference); }
        finally { this.documents.workspaceMutation = false; }
        delete reference.pendingChange;
      }
      await this.storage.saveWorkspace(reference);
    } catch (error) {
      this.error = error instanceof PendingWorkspaceChangeError ? "pendingChange" : "storage";
      return;
    }
    const entries = await listWorkspaceDirectory(handle, "");
    this.references = [...this.references.filter(r => r.id !== id), reference];
    this.current = reference;
    this.createdFolder = "";
    this.last = reference;
    this.entries = entries;
    this.documents.closeActiveDocument();
  }

  async list(path: string): Promise<WorkspaceEntry[]> {
    if (!this.current) throw new Error("No workspace selected");
    return listWorkspaceDirectory(this.current.handle, path);
  }

  async readFile(path: string) {
    if (!this.current) throw new Error("No workspace selected");
    const parts = workspacePathParts(path);
    const name = parts.pop()!;
    const directory = await directoryAt(this.current.handle, parts.join("/"));
    return (await directory.getFileHandle(name)).getFile();
  }

  async openFile(path: string): Promise<void> {
    if (this.busy || !this.current) return;
    this.busy = true;
    this.error = null;
    try {
      const parts = workspacePathParts(path);
      const name = parts.pop()!;
      const reference = this.current;
      const directory = await directoryAt(reference.handle, parts.join("/"));
      const handle = await directory.getFileHandle(name);
      await this.documents.openWorkspaceFile(reference.id, path, handle);
    } catch (error) {
      this.report(error);
    } finally {
      this.busy = false;
    }
  }

  close(): void {
    if (this.busy) return;
    this.current = null;
    this.entries = [];
    this.createdFolder = "";
    this.documents.closeActiveDocument();
  }

  /** ES: Solo la confirmación solicita escritura y crea una carpeta; no guarda documentos.
   * EN: Only confirmation requests write access and creates a directory; never saves documents. */
  async createFolder(parentPath: string, name: string): Promise<boolean> {
    if (this.busy || !this.current) return false;
    if (this.current.pendingChange) { this.error = "pendingChange"; return false; }
    this.error = null;
    this.createdFolder = "";
    try {
      if (!isValidFolderName(name)) throw new Error("Invalid name");
      if (parentPath) workspacePathParts(parentPath);
    } catch {
      this.error = "invalidName";
      return false;
    }
    const reference = this.current;
    this.busy = true;
    try {
      // ES: Solicita el permiso antes de cualquier await para conservar la activación del usuario.
      // EN: Request permission before any await to preserve user activation.
      const permission = reference.handle.requestPermission({ mode: "readwrite" });
      if (await permission !== "granted") { this.error = "permission"; return false; }
      const folder = await createWorkspaceFolder(reference.handle, parentPath, name);
      this.createdFolder = parentPath ? `${parentPath}/${folder.name}` : folder.name;
      // ES: La creación confirmada sigue siendo éxito aunque falle actualizar el árbol.
      // EN: Confirmed creation remains successful even if refreshing the tree fails.
      try {
        this.entries = await listWorkspaceDirectory(reference.handle, "");
        this.current = { ...reference };
      } catch {
        this.error = "read";
      }
      return true;
    } catch (error) {
      if (error instanceof FolderCollisionError) this.error = "collision";
      else this.report(error, "write");
      return false;
    } finally {
      this.busy = false;
    }
  }

  /** ES: Valida y delega las acciones de disco a una única secuencia recuperable.
   * EN: Validates and delegates disk actions to a single recoverable sequence. */
  async renameEntry(path: string, newName: string): Promise<boolean> {
    if (this.busy || !this.current) return false;
    try {
      if (!path || !isValidEntryName(newName)) throw new Error("Invalid name");
      const { parentPath, name } = splitWorkspacePath(path);
      if (name === newName) { this.error = null; return true; }
      const target = parentPath ? `${parentPath}/${newName}` : newName;
      return this.changeEntry(path, target, root => renameWorkspaceEntry(root, path, newName));
    } catch { this.error = "invalidName"; return false; }
  }

  async moveEntry(path: string, parentPath: string, newName?: string): Promise<boolean> {
    if (this.busy || !this.current) return false;
    try {
      if (!path) throw new Error("Missing path");
      const { name } = splitWorkspacePath(path);
      if (parentPath) workspacePathParts(parentPath);
      if (!isValidEntryName(newName ?? name)) throw new Error("Invalid name");
      const target = parentPath ? `${parentPath}/${newName ?? name}` : newName ?? name;
      if (path === target) { this.error = null; return true; }
      return this.changeEntry(path, target, root => moveWorkspaceEntry(root, path, parentPath, newName));
    } catch { this.error = "invalidName"; return false; }
  }

  async deleteEntry(path: string): Promise<boolean> {
    try { workspacePathParts(path); }
    catch { this.error = "invalidName"; return false; }
    return this.changeEntry(path, null, root => deleteWorkspaceEntry(root, path));
  }

  private publishReference(reference: WorkspaceReference): void {
    this.references = this.references.map(r => r.id === reference.id ? reference : r);
    this.last = reference;
    this.current = reference;
  }

  private async changeEntry(path: string, newPath: string | null, operation: (root: DirectoryHandle) => Promise<unknown>): Promise<boolean> {
    if (this.busy || !this.current) return false;
    if (this.documents.fileSave.busy) { this.error = "saving"; return false; }
    if (this.current.pendingChange) { this.error = "pendingChange"; return false; }
    this.busy = true;
    this.error = null;
    this.documents.workspaceMutation = true;
    let recorded: WorkspaceReference | undefined;
    try {
      const reference = this.current;
      const permission = reference.handle.requestPermission({ mode: "readwrite" });
      if (await permission !== "granted") { this.error = "permission"; return false; }
      await protectWorkspaceDrafts(this.documents);
      if (newPath !== null) assertWorkspaceDestination(this.documents, reference.id, path, newPath);
      recorded = { ...reference, pendingChange: { path, newPath } };
      try { await this.storage.saveWorkspace(recorded); }
      catch { recorded = undefined; throw new WorkspaceStorageError(); }
      let actionError: unknown;
      try { await operation(reference.handle); }
      catch (error) { actionError = error; }
      // ES: Sin copia alternativa, un error con origen presente conserva sus borradores y ambas entradas.
      // EN: Without copy fallback, an error with a present source preserves its drafts and both entries.
      if (!actionError || !await workspaceEntryAt(reference.handle, path)) {
        await resumeWorkspaceChange(this.documents, recorded);
      }
      const completed = { ...recorded };
      delete completed.pendingChange;
      try { await this.storage.saveWorkspace(completed); }
      catch { throw new WorkspaceStorageError(); }
      recorded = completed;
      if (actionError) throw actionError;
      return true;
    } catch (error) {
      if (error instanceof EntryCollisionError) this.error = "collision";
      else if (error instanceof WorkspaceStorageError) this.error = "storage";
      else if (error instanceof PendingWorkspaceChangeError) this.error = "pendingChange";
      else if (error instanceof UnsupportedCapabilityError || (error instanceof Error && error.name === "NotSupportedError")) this.error = "unsupported";
      else this.report(error, "write");
      return false;
    } finally {
      if (recorded) {
        this.publishReference(recorded);
        try { this.entries = await listWorkspaceDirectory(recorded.handle, ""); }
        catch { this.error ??= "read"; }
      }
      this.documents.workspaceMutation = false;
      this.busy = false;
    }
  }

  async refresh(): Promise<void> {
    if (this.busy || !this.current) return;
    this.busy = true;
    this.error = null;
    try {
      const entries = await listWorkspaceDirectory(this.current.handle, "");
      this.entries = entries;
      this.current = { ...this.current };
    } catch (error) {
      this.report(error);
    } finally {
      this.busy = false;
    }
  }

  private report(error: unknown, fallback: "read" | "write" = "read"): void {
    if (error instanceof Error && error.name === "AbortError") return;
    this.error ??= error instanceof Error && ["NotAllowedError", "SecurityError"].includes(error.name)
      ? "permission" : fallback;
  }
}

export const workspaceStore = new WorkspaceStore(vaultStore);
