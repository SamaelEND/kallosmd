<script lang="ts">
  /**
   * Barra secundaria de atajos rápidos de formato Markdown.
   * Permite insertar negrita, cursiva, encabezados, enlaces, tareas, tablas, fórmulas KaTeX y diagramas Mermaid.
   */
  import {
    Bold,
    CheckSquare,
    Heading,
    Italic,
    Link,
    Sigma,
    Table,
    Workflow,
  } from "lucide-svelte";
  import Button from "../ui/Button.svelte";

  interface Props {
    onInsertSnippet?: (
      prefix: string,
      suffix?: string,
      placeholder?: string,
    ) => void;
  }

  let { onInsertSnippet }: Props = $props();

  function insert(prefix: string, suffix = "", placeholder = ""): void {
    onInsertSnippet?.(prefix, suffix, placeholder);
  }

  function insertTable(): void {
    insert(
      "\n| Encabezado 1 | Encabezado 2 |\n| :--- | :--- |\n| Celda 1 | Celda 2 |\n\n",
    );
  }

  function insertMermaid(): void {
    insert(
      "\n```mermaid\nflowchart TD\n    A[Inicio] --> B(Proceso)\n    B --> C[Fin]\n```\n\n",
    );
  }

  function insertMath(): void {
    insert(
      "\n$$\n\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}\n$$\n\n",
    );
  }
</script>

<div class="toolbar-format-row" role="toolbar" aria-label="Atajos de formato">
  <Button
    variant="format"
    onclick={() => insert("**", "**", "negrita")}
    title="Negrita (**)"
  >
    <Bold size={14} />
  </Button>

  <Button
    variant="format"
    onclick={() => insert("*", "*", "cursiva")}
    title="Cursiva (*)"
  >
    <Italic size={14} />
  </Button>

  <Button
    variant="format"
    onclick={() => insert("## ", "\n", "Encabezado")}
    title="Encabezado (##)"
  >
    <Heading size={14} />
  </Button>

  <Button
    variant="format"
    onclick={() => insert("[", "](https://)", "enlace")}
    title="Enlace [texto](url)"
  >
    <Link size={14} />
  </Button>

  <Button
    variant="format"
    onclick={() => insert("- [ ] ", "", "Tarea")}
    title="Tarea (- [ ])"
  >
    <CheckSquare size={14} />
  </Button>

  <Button variant="format" onclick={insertTable} title="Insertar tabla">
    <Table size={14} />
  </Button>

  <Button variant="format" onclick={insertMath} title="Fórmula KaTeX ($$)">
    <Sigma size={14} />
  </Button>

  <Button variant="format" onclick={insertMermaid} title="Diagrama Mermaid">
    <Workflow size={14} />
  </Button>
</div>

<style>
  .toolbar-format-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 0.75rem 6px 0.75rem;
    border-top: 1px solid var(--border-subtle, #23272f);
    overflow-x: auto;
    scrollbar-width: none;
    animation: fadeInFormat 0.15s ease-out;
  }

  .toolbar-format-row::-webkit-scrollbar {
    display: none;
  }

  @keyframes fadeInFormat {
    from {
      opacity: 0;
      transform: translateY(-2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
