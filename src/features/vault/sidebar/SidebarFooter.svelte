<script lang="ts">
  /**
   * Pie de página del Sidebar con acción para vaciar todo el espacio de trabajo.
   */
  import { Trash2 } from "lucide-svelte";
  import { i18n } from "../../../shared/i18n/i18n.svelte";
  import Button from "../../../shared/ui/Button.svelte";

  interface Props {
    onClearAll: () => void;
  }

  let { onClearAll }: Props = $props();

  const t = $derived(i18n.current);
</script>

<div class="sidebar-footer">
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

<style>
  .sidebar-footer {
    padding: 8px 14px;
    border-top: 1px solid var(--border-subtle, #212429);
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-width: 290px;
  }
</style>
