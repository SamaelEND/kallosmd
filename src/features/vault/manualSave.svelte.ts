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

interface SaveContext {
  getDocument(id: string): DocumentItem | undefined;
  getVersion(id: string): DocumentVersion;
  protectDrafts(): Promise<boolean>;
  confirmWrite(snapshot: DocumentItem, handle: SaveFileHandle): Promise<boolean>;
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
  private documentId = "";
  private context: SaveContext;
  private environment: SaveEnvironment;

  constructor(context: SaveContext, environment: SaveEnvironment = browserEnvironment) {
    this.context = context;
    this.environment = environment;
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

  async save(id: string, copy = false): Promise<void> {
    const doc = this.context.getDocument(id);
    if (!doc || this.busy) return;
    const snapshot = toPlainDoc(doc);
    const version = this.context.getVersion(id);
    const original = version.fileHandle;
    this.busy = true;
    this.state = "saving";
    this.documentId = id;
    this.name = snapshot.title;
    this.conflict = null;
    const protecting = this.context.protectDrafts();
    try {
      // ES: Invocar el selector/permisos antes de esperar IndexedDB conserva el gesto del usuario.
      // EN: Invoke the picker/permissions before awaiting IndexedDB to preserve user activation.
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
      this.name = handle.name;
      if (!copy && this.context.getDocument(id)) {
        await this.context.confirmWrite(snapshot, handle);
      }
      this.state = copy ? "copySaved" : "fileSaved";
    } catch (error) {
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
