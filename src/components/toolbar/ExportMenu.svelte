<script lang="ts">
  /**
   * Botón y menú desplegable de exportación (.md, PDF, HTML5 y configuración de URL en pie de PDF).
   */
  import { Code, Download, FileText, Link, Printer } from "lucide-svelte";
  import Button from "../ui/Button.svelte";
  import DropdownMenu from "../ui/DropdownMenu.svelte";
  import ToggleSwitchItem from "../ui/ToggleSwitchItem.svelte";

  interface Props {
    isOpen: boolean;
    includePdfUrl: boolean;
    onToggleOpen: (e: MouseEvent) => void;
    onExportMarkdown: () => void;
    onExportPdf: () => void;
    onExportHtml: () => void;
    onTogglePdfUrl: () => void;
  }

  let {
    isOpen,
    includePdfUrl,
    onToggleOpen,
    onExportMarkdown,
    onExportPdf,
    onExportHtml,
    onTogglePdfUrl,
  }: Props = $props();
</script>

<div class="export-menu-wrap">
  <Button
    variant="accent"
    size="md"
    active={isOpen}
    class="btn-export-responsive"
    onclick={onToggleOpen}
    title="Exportar documento"
    ariaHaspopup="true"
    ariaExpanded={isOpen}
  >
    <Download size={15} />
    <span class="btn-export-label">Exportar</span>
  </Button>

  {#if isOpen}
    <DropdownMenu>
      <Button variant="menu-item" role="menuitem" onclick={onExportMarkdown}>
        <FileText size={15} />
        <span>Exportar Markdown (.md)</span>
      </Button>

      <Button variant="menu-item" role="menuitem" onclick={onExportPdf}>
        <Printer size={15} />
        <span>Exportar PDF</span>
      </Button>

      <Button variant="menu-item" role="menuitem" onclick={onExportHtml}>
        <Code size={15} />
        <span>Exportar HTML5</span>
      </Button>

      <div class="menu-divider"></div>

      <ToggleSwitchItem
        label="URL en pie del PDF"
        checked={includePdfUrl}
        onToggle={onTogglePdfUrl}
        title="Incluir u ocultar la URL en el pie de página del PDF"
      >
        {#snippet icon()}
          <Link size={14} />
        {/snippet}
      </ToggleSwitchItem>
    </DropdownMenu>
  {/if}
</div>

<style>
  .export-menu-wrap {
    position: relative;
  }

  .menu-divider {
    height: 1px;
    background-color: var(--border-subtle, #2b303c);
    margin: 4px 0;
  }

  @media (max-width: 640px) {
    .btn-export-label {
      display: none;
    }

    .export-menu-wrap :global(.btn-export-responsive) {
      padding: 0 8px;
    }
  }
</style>
