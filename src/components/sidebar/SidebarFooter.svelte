<script lang="ts">
  /**
   * Pie de página del Sidebar con acción para vaciar todo el espacio de trabajo.
   */
  import { Trash2 } from "lucide-svelte";
  import Button from "../ui/Button.svelte";

  interface Props {
    onClearAll: () => void;
  }

  let { onClearAll }: Props = $props();
</script>

<div class="sidebar-footer">
  <Button
    variant="danger"
    size="xs"
    onclick={onClearAll}
    title="Elimina todos los archivos y carpetas locales"
  >
    <Trash2 size={13} />
    <span>Vaciar todo</span>
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
