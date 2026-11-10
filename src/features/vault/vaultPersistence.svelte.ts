/**
 * ES: Cola serial de borradores recuperables y mutaciones locales; conserva fallos para reintento.
 * EN: Serial queue for recoverable drafts and local mutations; retains failed drafts for retry.
 */
import type { StorageAdapter } from "../../core/storage/storagePort";
import type { DocumentItem, DocumentVersion, RecoveryDraft } from "../../core/types";
import { getDraftKey, toPlainDraft } from "../../core/storage/documentRecords";

type PersistenceState = "idle" | "pending" | "saving" | "saved" | "error";

export class VaultPersistence {
  state = $state<PersistenceState>("idle");
  isReady = $state(false);
  private pending = new Map<string, RecoveryDraft>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private task: Promise<boolean> = Promise.resolve(true);
  // ES: Guardar reintenta borradores; los fallos estructurales siguen visibles durante la sesión.
  // EN: Save retries drafts; structural failures stay visible throughout the session.
  private mutationFailed = false;
  private loading: ReturnType<VaultPersistence["read"]> | null = null;
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  load() {
    return this.loading ??= this.read();
  }

  private async read() {
    try {
      const [documents, folders, drafts] = await Promise.all([
        this.storage.getAllDocuments(), this.storage.getAllFolders(), this.storage.getAllDrafts(),
      ]);
      this.isReady = true;
      return { documents, folders, drafts: drafts.map(toPlainDraft) };
    } catch (error) {
      this.state = "error";
      this.isReady = false;
      throw error;
    }
  }

  get hasPendingWrites(): boolean {
    return this.pending.size > 0;
  }

  run(operation: () => Promise<void>, draftWrite = false): Promise<boolean> {
    this.task = this.task.then(async () => {
      try {
        await this.loading;
        if (!this.isReady) throw new Error("Storage is not ready");
        await operation();
        return true;
      } catch (error) {
        if (!draftWrite) this.mutationFailed = true;
        this.state = "error";
        console.error("ES: Error de persistencia / EN: Persistence failed:", error);
        return false;
      }
    });
    return this.task;
  }

  schedule(document: DocumentItem, version: DocumentVersion): void {
    const key = getDraftKey(version.identity);
    this.pending.set(key, toPlainDraft({ key, document, ...version }));
    this.state = this.mutationFailed ? "error" : "pending";
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 250);
  }

  flush(): Promise<boolean> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const snapshots = [...this.pending.values()];
    if (!snapshots.length) return this.task;
    return this.run(async () => {
      let wrote = false;
      for (const snapshot of snapshots) {
        if (this.pending.get(snapshot.key) !== snapshot) continue;
        this.state = "saving";
        await this.storage.saveDraft(snapshot);
        wrote = true;
        if (this.pending.get(snapshot.key) === snapshot) this.pending.delete(snapshot.key);
      }
      if (!wrote) return;
      this.state = this.mutationFailed ? "error" : this.pending.size ? "pending" : "saved";
    }, true);
  }

  /**
   * ES: Solo una escritura confirmada resuelve el borrador; las ediciones posteriores siguen protegidas.
   * EN: Only a confirmed write resolves the draft; later edits remain protected.
   */
  confirmWrite(version: DocumentVersion, getCurrent: () => DocumentItem | undefined): Promise<boolean> {
    return this.run(async () => {
      const document = getCurrent();
      if (!document) return;
      const key = getDraftKey(version.identity);
      const snapshot = toPlainDraft({ key, document, ...version });
      this.pending.set(key, snapshot);
      const matches = document.content === version.confirmedContent;
      if (matches) await this.storage.deleteDraft(key);
      else await this.storage.saveDraft(snapshot);
      if (this.pending.get(key) === snapshot) this.pending.delete(key);
      this.state = this.mutationFailed ? "error" : this.pending.size ? "pending" : matches ? "idle" : "saved";
      if (this.pending.size) void this.flush();
    }, true);
  }

  deleteDocument(id: string, version: DocumentVersion): void {
    const key = getDraftKey(version.identity);
    this.pending.delete(key);
    void this.run(async () => {
      await this.storage.deleteDraft(key);
      await this.storage.deleteDocument(id);
      if (!this.pending.size && !this.mutationFailed) this.state = "idle";
    });
  }

  clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending.clear();
    void this.run(async () => {
      await this.storage.clearAllDrafts();
      await this.storage.clearAllDocuments();
      await this.storage.clearAllFolders();
      if (!this.pending.size && !this.mutationFailed) this.state = "idle";
    });
  }
}
