<script lang="ts">
  /**
   * ES: Ofrece recuperar el borrador mediante el diálogo existente, sin abrirlo al iniciar.
   * EN: Offers draft recovery through the existing dialog, without opening it at startup.
   */
  import { untrack } from "svelte";
  import { vaultStore } from "./vaultStore.svelte";
  import { confirmStore } from "../../shared/ui/confirmStore.svelte";
  import { i18n } from "../../shared/i18n/i18n.svelte";

  $effect(() => {
    const candidate = vaultStore.recoveryCandidate;
    if (!candidate) return;
    untrack(() => {
      const t = i18n.current.recovery;
      void confirmStore.ask({
        title: t.title,
        message: i18n.interpolate(t.message, { title: candidate.document.title }),
        confirmLabel: t.recover,
        cancelLabel: t.later,
        tone: "default",
      }).then(recover => vaultStore.resolveRecovery(candidate, recover));
    });
  });
</script>
