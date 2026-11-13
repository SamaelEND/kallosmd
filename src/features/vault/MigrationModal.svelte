<script lang="ts">
  /**
   * ES: Diálogo accesible para migrar documentos locales anteriores a una carpeta de trabajo.
   * EN: Accessible modal dialog to migrate legacy local documents into a workspace directory.
   */
  import { FolderOpen, Download, CheckCircle, AlertTriangle, X } from "lucide-svelte";
  import { untrack } from "svelte";
  import { i18n } from "../../shared/i18n/i18n.svelte";
  import Button from "../../shared/ui/Button.svelte";
  import { downloadTextFile } from "../../shared/utils/downloadFile";
  import { pickWorkspaceDirectory, supportsWorkspaceDirectory } from "../../core/storage/fileSystemAdapter";
  import type { DirectoryHandle } from "../../core/storage/workspacePort";
  import { vaultStore } from "./vaultStore.svelte";
  import { workspaceStore } from "./workspaceStore.svelte";
  import { MigrationPlanState } from "./migrationPlan.svelte";
  import {
    detectMigrationCandidates,
    candidateForFolderDrop,
    executeMigration,
    retireLegacyDocuments,
    exportMigrationAlternative,
    type MigrationCandidate,
    type CollisionResolution,
    type MigrationExecutionResult,
    type RetireResult,
  } from "./migrationService";

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    droppedDocument?: { docId: string; directory: DirectoryHandle } | null;
  }

  let { isOpen, onClose, droppedDocument = null }: Props = $props();

  const t = $derived(i18n.current);
  const m = $derived(t.migration);
  const supported = supportsWorkspaceDirectory();

  let step = $state<"review" | "migrating" | "completed">("review");
  let candidates = $state<MigrationCandidate[]>([]);
  const planState = new MigrationPlanState();
  let customDirectory = $state.raw<DirectoryHandle | null>(null);
  let activeDirectory = $derived(customDirectory ?? droppedDocument?.directory ?? workspaceStore.current?.handle ?? null);
  let result = $state<MigrationExecutionResult | null>(null);
  let retireStatus = $state<RetireResult | null>(null);
  let retireRequested = $state(false);
  let errorMsg = $state("");
  let busy = $state(false);

  $effect(() => {
    if (!isOpen) {
      untrack(() => planState.invalidate());
      return;
    }

    const directory = activeDirectory;
    untrack(() => {
      step = "review";
      result = null;
      retireStatus = null;
      retireRequested = false;
      errorMsg = "";
      candidates = droppedDocument
        ? [candidateForFolderDrop(vaultStore, droppedDocument.docId)].filter((candidate): candidate is MigrationCandidate => candidate !== null)
        : detectMigrationCandidates(vaultStore);
    });

    // ES: Cada cambio de carpeta vuelve a inspeccionar y descarta el plan anterior de inmediato.
    // EN: Every directory change re-inspects and immediately discards the previous plan.
    void loadPlan(directory, untrack(() => candidates));
  });

  async function loadPlan(dir: DirectoryHandle | null, detected: MigrationCandidate[]): Promise<void> {
    await planState.inspectDirectory(dir, detected);
    if (dir === activeDirectory) {
      errorMsg = planState.failed ? "Error al inspeccionar la carpeta de destino." : "";
    }
  }

  async function handlePickDirectory(): Promise<void> {
    const picked = pickWorkspaceDirectory();
    if (!picked) return;
    try {
      // ES: El efecto observa el cambio de carpeta y vuelve a inspeccionar; nunca reutiliza el plan anterior.
      // EN: The effect observes the directory change and re-inspects; it never reuses the previous plan.
      customDirectory = await picked;
    } catch {
      // ES: Cancelación o error de selector
      // EN: Cancellation or picker error
    }
  }

  async function handleStartMigration(): Promise<void> {
    const directory = activeDirectory;
    if (!directory || busy || planState.inspecting || !planState.isUsableFor(directory)) return;
    busy = true;
    step = "migrating";
    errorMsg = "";
    try {
      const res = await executeMigration(planState.plan, directory, vaultStore);
      result = res;
      if (res.error === "permission") {
        errorMsg = m.permissionError;
      }
      step = "completed";
    } catch {
      errorMsg = "Error inesperado durante la migración.";
      step = "completed";
    } finally {
      busy = false;
    }
  }

  async function handleRetry(): Promise<void> {
    const directory = activeDirectory;
    if (!directory || busy || !result || !planState.isUsableFor(directory)) return;
    const failedIds = new Set(result.failed.map(f => f.id));
    const pendingPlan = planState.plan.filter(p => failedIds.has(p.candidate.id));
    if (!pendingPlan.length) return;
    busy = true;
    step = "migrating";
    errorMsg = "";
    try {
      // ES: Autorizar solo los parciales exactos creados por intentos anteriores de esta migración
      // EN: Authorize only the exact partial files written by earlier attempts of this migration
      const authorizedPartials: Record<string, string> = {};
      for (const failure of result.failed) {
        if (failure.partialContent !== undefined) authorizedPartials[failure.id] = failure.partialContent;
      }
      const retryRes = await executeMigration(pendingPlan, directory, vaultStore, { authorizedPartials });
      result = {
        ok: retryRes.ok,
        error: retryRes.error,
        succeeded: [...result.succeeded, ...retryRes.succeeded],
        failed: retryRes.failed,
        skipped: [...result.skipped, ...retryRes.skipped],
        pending: retryRes.pending,
      };
      step = "completed";
    } catch {
      errorMsg = "Error inesperado durante el reintento.";
      step = "completed";
    } finally {
      busy = false;
    }
  }

  async function handleRetire(confirmRetire: boolean): Promise<void> {
    if (!result || busy) return;
    if (!confirmRetire) {
      retireRequested = true;
      retireStatus = {
        retiredCount: 0,
        preservedCount: result.succeeded.length,
        failed: false,
        backupPresent: true,
      };
      return;
    }

    busy = true;
    try {
      const status = await retireLegacyDocuments(vaultStore, result.succeeded);
      retireStatus = status;
      retireRequested = true;
    } finally {
      busy = false;
    }
  }

  async function handleExportAlternative(): Promise<void> {
    busy = true;
    try {
      const exportRes = await exportMigrationAlternative(vaultStore);
      if (exportRes.ok) {
        downloadTextFile(exportRes.filename, exportRes.text, "application/json");
      }
    } finally {
      busy = false;
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && !busy) {
      onClose();
    }
  }

  function mountBackdropOnBody(node: HTMLElement) {
    // ES: La barra lateral crea una capa propia; el fondo debe cubrir toda la app.
    // EN: The sidebar creates its own stacking context; the backdrop must cover the whole app.
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div use:mountBackdropOnBody class="modal-backdrop" role="presentation" onclick={() => !busy && onClose()}>
    <div
      class="modal-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="migration-title"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <header class="modal-header">
        <h2 id="migration-title">{m.title}</h2>
        <Button
          size="icon-xs"
          variant="ghost"
          ariaLabel={m.cancel}
          disabled={busy}
          onclick={onClose}
        >
          <X size={14} />
        </Button>
      </header>

      <div class="modal-body">
        {#if !supported}
          <div class="unsupported-box">
            <p>{m.exportAlternativeHint}</p>
            <Button variant="secondary" size="sm" onclick={handleExportAlternative} disabled={busy}>
              <Download size={14} />
              <span>{m.exportAlternative}</span>
            </Button>
          </div>
        {:else if candidates.length === 0}
          <p class="empty-hint">{m.noCandidates}</p>
        {:else if step === "review"}
          <p class="description">{m.description}</p>
          <div class="info-badge">
            {i18n.interpolate(m.candidatesCount, { count: candidates.length })}
          </div>

          <div class="folder-selector">
            {#if activeDirectory}
              <p class="target-name">
                {i18n.interpolate(m.currentFolder, { name: activeDirectory.name })}
              </p>
            {/if}
            <Button variant="secondary" size="sm" onclick={handlePickDirectory} disabled={busy}>
              <FolderOpen size={14} />
              <span>{m.chooseFolder}</span>
            </Button>
          </div>

          {#if planState.plan.some(p => p.hasCollision)}
            <div class="collision-alert" role="alert">
              <AlertTriangle size={15} />
              <div>
                <strong>{m.collisionsTitle}</strong>
                <p>{m.collisionsMessage}</p>
              </div>
            </div>
          {/if}

          <div class="candidate-list">
            {#each planState.plan as item (item.candidate.id)}
              <div class="candidate-item">
                <div class="candidate-name">
                  <span class="file-title">{item.candidate.title}</span>
                  <span class="folder-tag">{item.targetFolder || "Raíz"}</span>
                </div>
                {#if item.hasCollision}
                  <label class="conflict-choice">
                    <span>{m.chooseResolution}</span>
                    <select
                      value={item.resolution}
                      onchange={(event) => { item.resolution = event.currentTarget.value as CollisionResolution; }}
                    >
                      <option value="ask">{m.chooseAction}</option>
                      {#if item.existingContent !== null}
                        <option value="overwrite">{m.replaceExisting}</option>
                      {/if}
                      <option value="rename">{i18n.interpolate(m.addCopy, { name: item.resolvedFileName })}</option>
                      <option value="skip">{m.skipDocument}</option>
                    </select>
                  </label>
                {/if}
              </div>
            {/each}
          </div>

          {#if errorMsg}
            <p class="error-text" role="alert">{errorMsg}</p>
          {/if}
        {:else if step === "migrating"}
          <div class="progress-box">
            <p>{m.inProgress}</p>
          </div>
        {:else if step === "completed" && result}
          <div class="result-box">
            <h3>{result.ok ? m.completedTitle : m.partialTitle}</h3>
            <p class="summary-text">
              {i18n.interpolate(m.summary, {
                succeeded: result.succeeded.length,
                failed: result.failed.length,
                skipped: result.skipped.length,
              })}
            </p>
            {#if result.succeeded.length > 0}
              <div class="success-list">
                {#each result.succeeded as saved}
                  <p>{i18n.interpolate(m.savedAs, { title: saved.title, path: saved.targetPath })}</p>
                {/each}
              </div>
            {/if}

            {#if result.failed.length > 0}
              <div class="failures-list">
                {#each result.failed as f}
                  <div class="failure-item">
                    <span>{f.title} ({f.targetPath}): {f.error}</span>
                  </div>
                {/each}
              </div>
              <div class="retry-box">
                <Button variant="secondary" size="sm" onclick={handleRetry} disabled={busy}>
                  {m.retry}
                </Button>
              </div>
            {/if}

            {#if result.succeeded.length > 0 && !retireRequested}
              <div class="retire-prompt">
                <p><strong>{m.retireConfirmTitle}</strong></p>
                <p>{i18n.interpolate(m.retireConfirmMessage, { count: result.succeeded.length })}</p>
                <div class="retire-actions">
                  <Button variant="danger" size="sm" onclick={() => void handleRetire(true)} disabled={busy}>
                    {m.retireBtn}
                  </Button>
                  <Button variant="secondary" size="sm" onclick={() => void handleRetire(false)} disabled={busy}>
                    {m.keepBackupBtn}
                  </Button>
                </div>
              </div>
            {:else if retireStatus}
              <div class="retire-feedback">
                {#if retireStatus.retiredCount > 0}
                  <p class="success-text">
                    <CheckCircle size={14} />
                    <span>{i18n.interpolate(m.retiredSuccess, { count: retireStatus.retiredCount })}</span>
                  </p>
                {:else}
                  <p>{m.backupPreserved}</p>
                {/if}
              </div>
            {/if}

            {#if errorMsg}
              <p class="error-text" role="alert">{errorMsg}</p>
            {/if}
          </div>
        {/if}
      </div>

      <footer class="modal-footer">
        {#if step === "review" && supported && candidates.length > 0}
          <Button variant="ghost" size="sm" onclick={onClose} disabled={busy}>
            {m.cancel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!activeDirectory || busy || planState.inspecting || !planState.isUsableFor(activeDirectory)}
            onclick={handleStartMigration}
          >
            {m.startMigration}
          </Button>
        {:else}
          <Button variant="secondary" size="sm" onclick={onClose} disabled={busy}>
            {step === "completed" ? m.close : m.cancel}
          </Button>
        {/if}
      </footer>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999; padding: 16px; animation: modal-fade 120ms ease;
  }
  .modal-dialog {
    background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-color);
    border-radius: 8px; max-width: 520px; width: 100%; max-height: 85vh;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5); animation: modal-pop 140ms ease;
  }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; border-bottom: 1px solid var(--border-color, #333);
  }
  .modal-header h2 { margin: 0; font-size: 15px; font-weight: 600; }
  .modal-body {
    padding: 16px; overflow-y: auto; font-size: 13px; line-height: 1.5;
    display: flex; flex-direction: column; gap: 12px;
  }
  .description { margin: 0; color: var(--text-secondary, #999); }
  .info-badge {
    display: inline-block; padding: 4px 8px; border-radius: 4px;
    background: var(--bg-elevated); font-size: 12px;
  }
  .folder-selector {
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px; padding: 10px; background: var(--bg-elevated); border-radius: 6px;
  }
  .target-name {
    margin: 0; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .collision-alert {
    display: flex; align-items: flex-start; gap: 8px; padding: 8px 12px;
    background: color-mix(in srgb, var(--warn-color) 12%, var(--bg-surface));
    border: 1px solid color-mix(in srgb, var(--warn-color) 40%, var(--border-color));
    border-radius: 6px; color: var(--warn-color); font-size: 12px;
  }
  .collision-alert p { margin: 2px 0 0; color: var(--text-secondary, #bbb); }
  .candidate-list {
    max-height: 160px; overflow-y: auto;
    border: 1px solid var(--border-color, #333); border-radius: 6px;
  }
  .candidate-item {
    display: flex; flex-direction: column; gap: 5px;
    padding: 6px 10px; border-bottom: 1px solid var(--border-subtle, #282828); font-size: 12px;
  }
  .candidate-name { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
  .conflict-choice { display: flex; flex-direction: column; gap: 4px; }
  .conflict-choice select { width: 100%; min-width: 0; padding: 5px; color: var(--text-primary); background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 4px; font: inherit; }
  .conflict-choice select:focus-visible { outline: 2px solid var(--accent-color); outline-offset: 1px; }
  .conflict-choice option { color: var(--text-primary); background: var(--bg-input); }
  .candidate-item:last-child { border-bottom: none; }
  .file-title {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px;
  }
  .folder-tag { font-size: 11px; color: var(--text-secondary); }
  .success-list { max-height: 140px; overflow: auto; overflow-wrap: anywhere; color: var(--text-secondary, #bbb); }
  .success-list p { margin: 2px 0; }
  .retire-prompt {
    padding: 12px; background: var(--bg-elevated);
    border-radius: 6px; border: 1px solid var(--border-color, #333);
  }
  .retire-actions { display: flex; gap: 8px; margin-top: 8px; }
  .error-text { color: var(--danger-color, #e5484d); font-size: 12px; margin: 0; }
  .success-text { display: flex; align-items: center; gap: 6px; color: var(--accent-color); margin: 0; }
  .modal-footer {
    display: flex; justify-content: flex-end; gap: 8px;
    padding: 12px 16px; border-top: 1px solid var(--border-color, #333);
  }
  @keyframes modal-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes modal-pop { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  @media (max-width: 480px) {
    .modal-dialog { max-height: 95vh; }
    .modal-footer :global(button) { flex: 1; }
  }
</style>
