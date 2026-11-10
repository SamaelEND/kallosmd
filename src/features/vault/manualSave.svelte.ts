/**
 * ES: Guardado manual de una instantánea; el autoguardado permanece exclusivamente en IndexedDB.
 * EN: Manual saving of a snapshot; autosave remains exclusively in IndexedDB.
 */
import type { DocumentItem, DocumentVersion, SaveFileHandle } from "../../core/types";
import { toPlainDoc } from "../../core/storage/documentRecords";
import { FileConflictError, pickSaveFile, writeFileSnapshot } from "../../core/storage/fileSystemAdapter";
import { downloadTextFile } from "../../shared/utils/downloadFile";

export interface SaveEnvironment {
  pickFile(title: string): Promise<SaveFileHandle> | null;
  download(name: string, content: string): void;
}

const browserEnvironment: SaveEnvironment = {
  pickFile: pickSaveFile,
  download: (name, content) => downloadTextFile(name, content, "text/markdown"),
};

/** ES: Destino confirmado dentro de la carpeta de trabajo. EN: Confirmed destination inside the workspace. */
export interface WorkspaceSaveTarget {
  workspaceId: string;
  path: string;
  handle: SaveFileHandle;
}

/** ES: Puente con la sesión de carpeta sin acoplar el guardado a su implementación.
 * EN: Bridge to the folder session without coupling saving to its implementation. */
export interface WorkspaceSaveProvider {
  current(): { id: string; name: string } | null;
  prepare(parentPath: string, name: string): Promise<WorkspaceSaveTarget | null>;
  discard(target: WorkspaceSaveTarget): Promise<void> | void;
  saved?(target: WorkspaceSaveTarget): Promise<void> | void;
}

/** ES: Solicitud de nombre y ubicación para el primer guardado. EN: Name and location request for the first save. */
export interface FirstSaveRequest {
  documentId: string;
  suggestedName: string;
  workspaceName: string;
}

interface SaveContext {
  getDocument(id: string): DocumentItem | undefined;
  getVersion(id: string): DocumentVersion;
  protectDrafts(): Promise<boolean>;
  confirmWrite(snapshot: DocumentItem, handle: SaveFileHandle, target?: WorkspaceSaveTarget): Promise<boolean>;
}

export interface SaveConflict {
  documentId: string;
  name: string;
}

export class ManualSave {
  state = $state<"idle" | "saving" | "fileSaved" | "copySaved" | "downloaded" | "conflict" | "error">("idle");
  busy = $state(false);
  name = $state("");
  conflict = $state<SaveConflict | null>(null);
  firstSave = $state.raw<FirstSaveRequest | null>(null);
  private documentId = "";
  private context: SaveContext;
  private environment: SaveEnvironment;
  private workspace: WorkspaceSaveProvider | null = null;
  private firstSaveResolve: ((target: WorkspaceSaveTarget | null) => void) | null = null;

  constructor(context: SaveContext, environment: SaveEnvironment = browserEnvironment) {
    this.context = context;
    this.environment = environment;
  }

  setWorkspaceSave(provider: WorkspaceSaveProvider | null): void {
    this.workspace = provider;
  }

  edited(id: string): void {
    if (id === this.documentId && !this.busy && ["fileSaved", "copySaved", "downloaded"].includes(this.state)) {
      this.state = "idle";
    }
  }

  forget(id: string): void {
    if (this.conflict?.documentId === id) this.conflict = null;
    if (id === this.documentId && !this.busy) this.state = "idle";
  }

  /** ES: Mantiene el estado del guardado tras asociar una nueva identidad al documento.
   * EN: Keeps save state after associating a new identity with the document. */
  reidentify(oldId: string, newId: string): void {
    if (this.documentId === oldId) this.documentId = newId;
    if (this.conflict?.documentId === oldId) this.conflict = { ...this.conflict, documentId: newId };
  }

  /** ES: La UI confirma o cancela el destino del primer guardado. EN: UI confirms or cancels the first-save destination. */
  resolveFirstSave(target: WorkspaceSaveTarget | null): void {
    const resolve = this.firstSaveResolve;
    this.firstSaveResolve = null;
    this.firstSave = null;
    resolve?.(target);
  }

  private requestWorkspaceTarget(snapshot: DocumentItem): Promise<WorkspaceSaveTarget | null> | null {
    const workspace = this.workspace?.current();
    if (!workspace) return null;
    return new Promise(resolve => {
      this.firstSaveResolve = resolve;
      this.firstSave = {
        documentId: snapshot.id,
        suggestedName: snapshot.title,
        workspaceName: workspace.name,
      };
    });
  }

  async save(id: string, copy = false): Promise<void> {
    const doc = this.context.getDocument(id);
    if (!doc || this.busy) return;
    const snapshot = toPlainDoc(doc);
    const version = this.context.getVersion(id);
    const original = version.fileHandle;
    const firstSave = !copy && !original && version.identity.kind === "local"
      ? this.requestWorkspaceTarget(snapshot) : null;
    this.busy = true;
    this.state = "saving";
    this.documentId = id;
    this.name = snapshot.title;
    this.conflict = null;
    const protecting = this.context.protectDrafts();
    let workspaceTarget: WorkspaceSaveTarget | null = null;
    let written = false;
    try {
      // ES: Invocar el selector/permisos antes de esperar IndexedDB conserva el gesto del usuario.
      // EN: Invoke the picker/permissions before awaiting IndexedDB to preserve user activation.
      if (firstSave) {
        workspaceTarget = await firstSave;
        if (!workspaceTarget) { this.state = "idle"; return; }
        this.name = workspaceTarget.handle.name;
        const granted = await (workspaceTarget.handle.requestPermission?.({ mode: "readwrite" }) ?? "granted");
        if (granted !== "granted") throw new DOMException("Write permission denied", "NotAllowedError");
        await writeFileSnapshot(workspaceTarget.handle, snapshot.content, null);
        written = true;
        if (!this.context.getDocument(id)) { this.state = "idle"; return; }
        const confirmed = await this.context.confirmWrite(snapshot, workspaceTarget.handle, workspaceTarget);
        if (!confirmed) {
          await this.workspace?.discard(workspaceTarget);
          this.state = "error";
          return;
        }
        this.state = "fileSaved";
        await this.workspace?.saved?.(workspaceTarget);
        return;
      }

      const request = original && !copy ? Promise.resolve(original) : this.environment.pickFile(snapshot.title);
      const permission = original && !copy ? original.requestPermission?.({ mode: "readwrite" }) : undefined;
      if (request === null) {
        this.environment.download(snapshot.title, snapshot.content);
        this.state = "downloaded";
        return;
      }
      const handle = await request;
      this.name = handle.name;
      if (!this.context.getDocument(id)) { this.state = "idle"; return; }
      const granted = await (permission ?? handle.requestPermission?.({ mode: "readwrite" }) ?? "granted");
      if (granted !== "granted") throw new DOMException("Write permission denied", "NotAllowedError");
      if (copy && original && await handle.isSameEntry(original)) throw new FileConflictError();
      await writeFileSnapshot(handle, snapshot.content, original && !copy ? version.confirmedContent : null);
      written = true;
      this.name = handle.name;
      if (!copy && this.context.getDocument(id)) {
        await this.context.confirmWrite(snapshot, handle);
      }
      this.state = copy ? "copySaved" : "fileSaved";
    } catch (error) {
      if (workspaceTarget && !written) await Promise.resolve(this.workspace?.discard(workspaceTarget)).catch(() => {});
      if (error instanceof FileConflictError) {
        this.state = "conflict";
      } else if (error instanceof Error && error.name === "AbortError") {
        this.state = "idle";
      } else {
        this.state = "error";
        console.error("ES: Error al guardar archivo / EN: File save failed:", error);
      }
    } finally {
      await protecting;
      this.busy = false;
      if (this.state === "conflict" && this.context.getDocument(id)) {
        this.conflict = { documentId: id, name: this.name };
      }
    }
  }

  resolveConflict(candidate: SaveConflict, copy: boolean): Promise<void> | undefined {
    if (this.conflict !== candidate) return;
    this.conflict = null;
    if (copy) return this.save(candidate.documentId, true);
  }
}
