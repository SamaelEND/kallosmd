<script lang="ts">
  /**
   * Barra de acciones rápidas del Sidebar:
   * - Crear nuevo documento en la raíz
   * - Crear nueva carpeta
   * - Importar archivo .md/.txt desde el dispositivo
   */
  import { FolderPlus, Plus, Upload } from "lucide-svelte";
  import { i18n } from "../../stores/i18n.svelte";
  import Button from "../ui/Button.svelte";
  import { readTextFile } from "../../lib/utils/formatters";

  interface Props {
    onCreateDoc: () => void;
    onCreateFolder: () => void;
    onImportFile: (filename: string, content: string) => void;
  }

  let { onCreateDoc, onCreateFolder, onImportFile }: Props = $props();

  const t = $derived(i18n.current);

  let fileInputElement = $state<HTMLInputElement | null>(null);

  async function handleFileInputChange(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const content = await readTextFile(file);
    onImportFile(file.name, content);
    input.value = "";
  }
</script>

<div class="quick-actions-bar">
  <Button
    variant="primary"
    size="lg"
    class="btn-new-doc-flex"
    onclick={onCreateDoc}
    title={t.sidebar.newDocTitle}
  >
    <Plus size={16} />
    <span>{t.sidebar.newDoc}</span>
  </Button>

  <Button
    variant="secondary"
    size="icon-lg"
    onclick={onCreateFolder}
    title={t.sidebar.newFolder}
    ariaLabel={t.sidebar.newFolderAria}
  >
    <FolderPlus size={16} />
  </Button>

  <Button
    variant="secondary"
    size="icon-lg"
    onclick={() => fileInputElement?.click()}
    title={t.sidebar.openFile}
    ariaLabel={t.sidebar.openFileAria}
  >
    <Upload size={16} />
  </Button>
</div>

<input
  type="file"
  accept=".md,.markdown,.txt"
  bind:this={fileInputElement}
  onchange={handleFileInputChange}
  style="display: none;"
  aria-hidden="true"
/>

<style>
  .quick-actions-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px 10px 14px;
  }

  .quick-actions-bar :global(.btn-new-doc-flex) {
    flex: 1;
  }
</style>
