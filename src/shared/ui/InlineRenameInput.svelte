<script lang="ts">
  /**
   * Componente InlineRenameInput compartido.
   * Permite renombrar carpetas o documentos en línea con auto-enfoque,
   * selección inmediata del texto, confirmación con Enter/Check y cancelación con Escape.
   */
  import { Check } from "lucide-svelte";

  interface Props {
    value: string;
    onCommit: (newValue: string) => void;
    onCancel: () => void;
    ariaLabel?: string;
  }

  let {
    value = $bindable(""),
    onCommit,
    onCancel,
    ariaLabel = "Editar nombre",
  }: Props = $props();

  function focusOnMount(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      e.preventDefault();
      onCommit(value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }
</script>

<div
  class="inline-edit-wrapper"
  role="presentation"
  onclick={(e) => e.stopPropagation()}
  onkeydown={(e) => e.stopPropagation()}
>
  <input
    type="text"
    bind:value
    class="inline-edit-input"
    aria-label={ariaLabel}
    onblur={() => onCommit(value)}
    onkeydown={handleKeyDown}
    use:focusOnMount
  />
  <button
    type="button"
    class="inline-save-btn"
    onclick={() => onCommit(value)}
    title="Guardar nombre"
    aria-label="Guardar nombre"
  >
    <Check size={12} />
  </button>
</div>

<style>
  .inline-edit-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .inline-edit-input {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    padding: 2px 6px;
    background: var(--bg-input, #181b20);
    border: 1px solid #3b82f6;
    border-radius: 4px;
    color: var(--text-primary, #f1f5f9);
    outline: none;
    font-family: inherit;
  }

  .inline-save-btn {
    background: #3b82f6;
    border: none;
    color: #ffffff;
    border-radius: 4px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
  }

  .inline-save-btn:hover {
    background: #2563eb;
  }
</style>
