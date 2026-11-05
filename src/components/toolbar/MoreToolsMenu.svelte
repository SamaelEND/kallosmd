<script lang="ts">
  /**
   * Menú desplegable de 3 puntos horizontales ('...') para Tablet y Móvil.
   * Agrupa las herramientas secundarias (SYNC, Números de línea, Paleta de código y GitHub en móvil).
   */
  import { MoreHorizontal } from "lucide-svelte";
  import type { CodeThemeId } from "../../types";
  import Button from "../ui/Button.svelte";
  import DropdownMenu from "../ui/DropdownMenu.svelte";
  import ToggleSwitchItem from "../ui/ToggleSwitchItem.svelte";
  import GithubIcon from "../ui/GithubIcon.svelte";
  import CodeThemePicker from "./CodeThemePicker.svelte";

  interface Props {
    isOpen: boolean;
    syncScroll: boolean;
    lineNumbers: boolean;
    codeTheme: CodeThemeId;
    isDark: boolean;
    githubUrl: string;
    onToggleOpen: (e: MouseEvent) => void;
    onToggleSyncScroll: () => void;
    onToggleLineNumbers: () => void;
    onSelectCodeTheme: (id: CodeThemeId) => void;
    onClose: () => void;
  }

  let {
    isOpen,
    syncScroll,
    lineNumbers,
    codeTheme,
    isDark,
    githubUrl,
    onToggleOpen,
    onToggleSyncScroll,
    onToggleLineNumbers,
    onSelectCodeTheme,
    onClose,
  }: Props = $props();
</script>

<div class="more-menu-wrap">
  <Button
    variant="ghost"
    size="icon"
    active={isOpen}
    class="more-tools-btn"
    onclick={onToggleOpen}
    title="Más herramientas"
    ariaHaspopup="true"
    ariaExpanded={isOpen}
  >
    <MoreHorizontal size={18} />
  </Button>

  {#if isOpen}
    <DropdownMenu>
      <span class="menu-title">Opciones adicionales</span>

      <ToggleSwitchItem
        label="Scroll sincronizado (SYNC)"
        checked={syncScroll}
        onToggle={onToggleSyncScroll}
      />

      <ToggleSwitchItem
        label="Números de línea"
        checked={lineNumbers}
        onToggle={onToggleLineNumbers}
      />

      <div class="menu-divider"></div>

      <CodeThemePicker
        selectedTheme={codeTheme}
        {isDark}
        showDescription={false}
        title="Paleta de código"
        onSelect={onSelectCodeTheme}
      />

      <div class="menu-divider mobile-github-divider"></div>

      <Button
        variant="menu-item"
        href={githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="github-menu-option"
        onclick={onClose}
      >
        <GithubIcon size={15} />
        <span>Ir al repositorio (GitHub)</span>
      </Button>
    </DropdownMenu>
  {/if}
</div>

<style>
  .more-menu-wrap {
    position: relative;
  }

  .menu-title {
    padding: 4px 10px 6px;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint, #64748b);
    font-weight: 700;
  }

  .menu-divider {
    height: 1px;
    background-color: var(--border-subtle, #2b303c);
    margin: 4px 0;
  }

  .more-menu-wrap :global(.github-menu-option) {
    display: none;
  }

  .mobile-github-divider {
    display: none;
  }

  @media (max-width: 640px) {
    .more-menu-wrap :global(.github-menu-option) {
      display: flex !important;
    }

    .mobile-github-divider {
      display: block !important;
    }
  }

  @media (min-width: 1025px) {
    .more-menu-wrap :global(.more-tools-btn) {
      display: none !important;
    }
  }
</style>
