<script lang="ts">
  /**
   * ES: Pie del Sidebar con respaldo local versionado y la acción de vaciar el espacio.
   * EN: Sidebar footer with the versioned local backup and the clear-workspace action.
   */
  import { Download, Trash2, Upload } from "lucide-svelte";
  import { i18n } from "../../../shared/i18n/i18n.svelte";
  import Button from "../../../shared/ui/Button.svelte";
  import { confirmStore } from "../../../shared/ui/confirmStore.svelte";
  import { downloadTextFile } from "../../../shared/utils/downloadFile";
  import { documentStore } from "../vaultStore.svelte";
  import {
    exportBackup,
    importBackup,
    inspectBackup,
    type BackupFailure,
  } from "../backupService";

  interface Props {
    onClearAll: () => void;
  }

  let { onClearAll }: Props = $props();

  const t = $derived(i18n.current);
  let inputElement = $state<HTMLInputElement | null>(null);
  let busy = $state(false);
  let message = $state("");
  let failed = $state(false);

  function report(text: string, isError: boolean): void {
    message = text;
    failed = isError;
  }

  function reportFailure(error: BackupFailure): void {
    report(t.backup[error], true);
  }

  async function handleExport(): Promise<void> {
    if (busy) return;
    busy = true;
    report("", false);
    try {
      const result = await exportBackup(documentStore);
      if (!result.ok) return reportFailure(result.error);
      downloadTextFile(result.filename, result.text, "application/json");
      report(t.backup.exported, false);
    } finally {
      busy = false;
    }
  }

  async function handleImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || busy) {
      input.value = "";
      return;
    }
    busy = true;
    report("", false);
    try {
      // ES: Se lee antes de vaciar el input; Chromium invalida el File si se vacía primero.
      // EN: Read before clearing the input; Chromium invalidates the File when cleared first.
      let content: string;
      try {
        content = await file.text();
      } catch {
        return reportFailure("read");
      } finally {
        input.value = "";
      }
      const inspected = await inspectBackup(documentStore, content);
      if (!inspected.ok) return reportFailure(inspected.error);

      let replace = false;
      if (inspected.conflicts > 0) {
        const confirmed = await confirmStore.ask({
          title: t.backup.collisionTitle,
          message: i18n.interpolate(t.backup.collisionMessage, { count: inspected.conflicts }),
          confirmLabel: t.backup.collisionConfirm,
          cancelLabel: t.dialogs.cancel,
          tone: "danger",
        });
        if (!confirmed) return report(t.backup.cancelled, false);
        replace = true;
      }

      const result = await importBackup(documentStore, inspected.backup, replace);
      if (!result.ok) return reportFailure(result.error);
      report(i18n.interpolate(t.backup.imported, {
        documents: result.imported.documents,
        folders: result.imported.folders,
        drafts: result.imported.drafts,
      }), false);
    } finally {
      busy = false;
    }
  }
</script>

<div class="sidebar-footer">
  <div class="footer-actions">
    <Button
      variant="secondary"
      size="icon-sm"
      disabled={busy}
      onclick={() => void handleExport()}
      title={t.backup.export}
      ariaLabel={t.backup.exportAria}
    >
      <Download size={13} />
    </Button>
    <Button
      variant="secondary"
      size="icon-sm"
      disabled={busy}
      onclick={() => inputElement?.click()}
      title={t.backup.import}
      ariaLabel={t.backup.importAria}
    >
      <Upload size={13} />
    </Button>
    <Button
      variant="danger"
      size="xs"
      onclick={onClearAll}
      title={t.sidebar.clearAllTitle}
    >
      <Trash2 size={13} />
      <span>{t.sidebar.clearAll}</span>
    </Button>
  </div>
  {#if message}
    <p class="backup-message" class:backup-failed={failed} role={failed ? "alert" : "status"}>
      {message}
    </p>
  {/if}
</div>

<input
  type="file"
  accept=".json,application/json"
  bind:this={inputElement}
  onchange={handleImportFile}
  style="display: none;"
  aria-hidden="true"
/>

<style>
  .sidebar-footer {
    padding: 8px 14px;
    border-top: 1px solid var(--border-subtle, #212429);
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 290px;
  }

  .footer-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .footer-actions :global(.variant-danger) {
    margin-left: auto;
  }

  .backup-message {
    margin: 0;
    font-size: var(--ui-font-xs, 0.6875rem);
    line-height: 1.4;
    color: var(--text-secondary, #9b9a94);
    overflow-wrap: anywhere;
  }

  .backup-failed {
    color: var(--danger-color, #e5484d);
  }
</style>
