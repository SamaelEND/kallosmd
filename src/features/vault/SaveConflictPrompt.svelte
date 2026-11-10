<script lang="ts">
  /**
   * ES: Un conflicto nunca sobrescribe el original; el diálogo ofrece conservar o copiar.
   * EN: A conflict never overwrites the original; the dialog offers to keep the draft or copy it.
   */
  import { untrack } from "svelte";
  import { vaultStore } from "./vaultStore.svelte";
  import { confirmStore } from "../../shared/ui/confirmStore.svelte";
  import { i18n } from "../../shared/i18n/i18n.svelte";

  $effect(() => {
    const candidate = vaultStore.fileSave.conflict;
    if (!candidate) return;
    untrack(() => {
      const t = i18n.current.fileSave;
      void confirmStore.ask({
        title: t.conflictTitle,
        message: i18n.interpolate(t.conflictMessage, { title: candidate.name }),
        confirmLabel: t.saveCopy,
        cancelLabel: t.keepDraft,
        tone: "default",
      }).then(copy => vaultStore.fileSave.resolveConflict(candidate, copy));
    });
  });
</script>
