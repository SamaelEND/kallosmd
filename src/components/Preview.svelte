<script lang="ts">
  /**
   * Componente Preview de MD Studio.
   * Renderizado reactivo de Markdown, KaTeX, Mermaid con zoom y caché,
   * bloques de código con botón de copiar y checkboxes interactivos.
   */
  import DOMPurify from "dompurify";
  import hljs from "highlight.js";
  import katex from "katex";
  import { Marked } from "marked";
  import mermaid from "mermaid";
  import { onMount, tick } from "svelte";
  import { documentStore } from "../stores/documents.svelte";
  import type { CodeThemeId, FontSize } from "../types";
  import { getPalette, paletteToCssText } from "../lib/codeThemes";
  import { cleanPreviewHtml } from "../lib/htmlExport";

  interface Props {
    documentId?: string;
    content: string;
    isDark?: boolean;
    fontSize?: FontSize;
    codeTheme?: CodeThemeId;
    onContainerScroll?: (e: Event) => void;
  }

  let {
    documentId = "",
    content = "",
    isDark = false,
    fontSize = "medium",
    codeTheme = "vscode",
    onContainerScroll,
  }: Props = $props();

  // Variables CSS de la paleta de código activa
  const codeVars = $derived(paletteToCssText(getPalette(codeTheme, isDark)));

  let scrollContainer = $state<HTMLDivElement | null>(null);
  let renderedHtml = $state<string>("");
  let previousScrollTop = $state<number>(0);
  let isLocalTaskToggle = $state<boolean>(false);
  let lastDocumentId = $state<string>("");

  // Caché de diagramas por tema y niveles de zoom por índice
  const mermaidCache = new Map<string, string>();
  const diagramZoomLevels = new Map<number, number>();

  const markedInstance = new Marked();

  markedInstance.use({
    gfm: true,
    breaks: true,
    renderer: {
      heading({ depth, text }) {
        const plainText = text
          .replace(/<[^>]+>/g, "")
          .replace(/[*_`~[\]]/g, "");
        const slug = plainText
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s\-_]/gu, "")
          .trim()
          .replace(/\s+/g, "-");
        return `<h${depth} id="${slug || "seccion"}">${text}</h${depth}>\n`;
      },
      code({ text, lang }) {
        if (lang === "mermaid") {
          return `<div class="mermaid-container" data-mermaid-code="${encodeURIComponent(text)}"></div>\n`;
        }

        const rawLang = lang ? lang.trim().toLowerCase().split(/\s+/)[0] : "";
        const displayLang = rawLang || "code";

        let highlightedCode = "";
        try {
          if (rawLang && hljs.getLanguage(rawLang)) {
            highlightedCode = hljs.highlight(text, {
              language: rawLang,
              ignoreIllegals: true,
            }).value;
          } else {
            highlightedCode = hljs.highlightAuto(text).value;
          }
        } catch {
          highlightedCode = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        }

        return `
          <div class="code-block-wrapper">
            <div class="code-header-bar">
              <span class="code-lang-label">${displayLang}</span>
              <button class="code-copy-btn" type="button" title="Copiar código al portapapeles">
                <span class="copy-text">Copiar</span>
              </button>
            </div>
            <pre><code class="hljs language-${displayLang}">${highlightedCode}</code></pre>
          </div>
        `;
      },
    },
  });

  /**
   * Preprocesa expresiones KaTeX antes de Marked para evitar deformaciones sintácticas.
   */
  function processMathAndMarkdown(rawText: string): string {
    const mathPlaceholders: { id: string; html: string }[] = [];
    let processed = rawText;

    // 1. Proteger fórmulas en bloque ($$ ... $$)
    processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      const id = `%%KATEX_BLOCK_${mathPlaceholders.length}%%`;
      try {
        const rendered = katex.renderToString(math.trim(), {
          displayMode: true,
          throwOnError: false,
        });
        mathPlaceholders.push({
          id,
          html: `<div class="katex-display-wrapper">${rendered}</div>`,
        });
      } catch (e) {
        mathPlaceholders.push({
          id,
          html: `<div class="katex-error">$$${math}$$</div>`,
        });
      }
      return id;
    });

    // 2. Proteger fórmulas en línea ($ ... $) evitando precios como $10.00
    processed = processed.replace(
      /(^|[^\\])\$([^\$\s\n\r](?:[^\$\n\r]*?[^\$\s\n\r])?)\$/g,
      (match, prefix, math) => {
        if (/^\s*\d+([.,]\d{1,2})?\s*$/.test(math)) {
          return match;
        }

        const id = `%%KATEX_INLINE_${mathPlaceholders.length}%%`;
        try {
          const rendered = katex.renderToString(math.trim(), {
            displayMode: false,
            throwOnError: false,
          });
          mathPlaceholders.push({ id, html: rendered });
        } catch (e) {
          mathPlaceholders.push({
            id,
            html: `<span class="katex-error">$${math}$</span>`,
          });
        }
        return prefix + id;
      },
    );

    // 3. Parsear Markdown
    let html = markedInstance.parse(processed) as string;

    // 4. Restaurar fórmulas matemáticas procesadas
    for (const item of mathPlaceholders) {
      html = html.replace(item.id, item.html);
    }

    // 5. Sanitizar con DOMPurify
    return DOMPurify.sanitize(html, {
      ADD_TAGS: [
        "input",
        "math",
        "annotation",
        "semantics",
        "mrow",
        "mi",
        "mo",
        "mn",
        "msup",
        "msub",
        "mfrac",
        "msqrt",
        "mtable",
        "mtr",
        "mtd",
      ],
      ADD_ATTR: [
        "class",
        "data-mermaid-code",
        "data-task-index",
        "type",
        "checked",
        "id",
        "target",
        "rel",
        "aria-hidden",
      ],
    });
  }

  // Resetear scroll al cambiar de documento
  $effect(() => {
    if (documentId && documentId !== lastDocumentId) {
      lastDocumentId = documentId;
      previousScrollTop = 0;
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
      }
    }
  });

  // Actualizar HTML reactivamente
  $effect(() => {
    const rawContent = content;

    // Si la actualización proviene del propio clic en un checkbox del preview,
    // evitamos destruir y regenerar el DOM completo (el input nativo ya tiene su nuevo estado visual)
    if (isLocalTaskToggle) {
      isLocalTaskToggle = false;
      return;
    }

    renderedHtml = processMathAndMarkdown(rawContent);
  });

  // Post-procesado tras actualizar HTML: Botones de copia, checkboxes interactivos y Mermaid
  $effect(() => {
    const _ = renderedHtml;
    const dark = isDark;
    const targetScroll = previousScrollTop;

    tick().then(() => {
      setupCopyButtons();
      setupCheckboxes();
      renderMermaidBlocks(dark).finally(() => {
        if (scrollContainer && targetScroll > 0) {
          scrollContainer.scrollTop = targetScroll;
        }
      });
      if (scrollContainer && targetScroll > 0) {
        scrollContainer.scrollTop = targetScroll;
      }
    });
  });

  /**
   * Configura botones de copiado en bloques de código.
   */
  function setupCopyButtons(): void {
    if (!scrollContainer) return;

    const copyButtons =
      scrollContainer.querySelectorAll<HTMLButtonElement>(".code-copy-btn");
    copyButtons.forEach((btn) => {
      // Evitar re-enlazar listeners
      if (btn.dataset.bound === "true") return;
      btn.dataset.bound = "true";

      btn.addEventListener("click", async () => {
        const pre = btn.closest(".code-block-wrapper")?.querySelector("pre");
        const codeText = pre?.textContent || "";
        if (!codeText) return;

        try {
          await navigator.clipboard.writeText(codeText);
          const label = btn.querySelector(".copy-text");
          if (label) label.textContent = "✓ Copiado";
          btn.classList.add("copied");

          setTimeout(() => {
            if (label) label.textContent = "Copiar";
            btn.classList.remove("copied");
          }, 2000);
        } catch (e) {
          console.error("Error al copiar código:", e);
        }
      });
    });
  }

  /**
   * Configura checkboxes interactivos que actualizan el Markdown fuente.
   */
  function setupCheckboxes(): void {
    if (!scrollContainer) return;

    const checkboxes = scrollContainer.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    checkboxes.forEach((cb, idx) => {
      cb.removeAttribute("disabled");
      cb.dataset.taskIndex = String(idx);
      cb.classList.add("task-checkbox");

      if (cb.dataset.bound !== "true") {
        cb.dataset.bound = "true";
        cb.addEventListener("change", () => {
          isLocalTaskToggle = true;
          if (scrollContainer) {
            previousScrollTop = scrollContainer.scrollTop;
          }
          documentStore.toggleTaskCheckbox(idx, cb.checked);
        });
      }
    });
  }

  /**
   * Inicializa y configura Mermaid con métrica exacta (13px) y variables de color del original.
   */
  function configureMermaid(dark: boolean): void {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      fontFamily:
        '"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif',
      flowchart: {
        htmlLabels: true,
        useMaxWidth: false,
        padding: 14,
      },
      sequence: {
        useMaxWidth: false,
        boxMargin: 10,
      },
      themeVariables: {
        darkMode: dark,
        fontSize: "13px",
        background: "transparent",
        mainBkg: dark ? "#1a1b1d" : "#ffffff",
        nodeBorder: dark ? "#5fb3a3" : "#1f7a6d",
        nodeTextColor: dark ? "#f0f6fc" : "#1f2328",
        lineColor: dark ? "#7cc9bb" : "#1f7a6d",
        textColor: dark ? "#e6edf3" : "#1f2328",
        clusterBkg: dark
          ? "rgba(95, 179, 163, 0.06)"
          : "rgba(31, 122, 109, 0.05)",
        clusterBorder: dark ? "#4fa89b" : "#1f7a6d",
        titleColor: dark ? "#5fb3a3" : "#1f7a6d",
        edgeLabelBackground: dark ? "#26282b" : "#ffffff",
        actorBkg: dark ? "#26282b" : "#f6f8fa",
        actorBorder: dark ? "#5fb3a3" : "#1f7a6d",
        actorTextColor: dark ? "#f0f6fc" : "#1f2328",
        actorLineColor: dark ? "#5fb3a3" : "#1f7a6d",
        signalColor: dark ? "#7cc9bb" : "#1f7a6d",
        signalTextColor: dark ? "#e6edf3" : "#1f2328",
      },
    });
  }

  /**
   * Renderiza los bloques Mermaid con soporte de zoom individual y caché anti-errores.
   */
  async function renderMermaidBlocks(dark: boolean): Promise<void> {
    if (!scrollContainer) return;

    const containers =
      scrollContainer.querySelectorAll<HTMLDivElement>(".mermaid-container");
    if (containers.length === 0) return;

    configureMermaid(dark);

    for (let index = 0; index < containers.length; index++) {
      const container = containers[index];
      const rawCode = decodeURIComponent(
        container.getAttribute("data-mermaid-code") || "",
      ).trim();
      if (!rawCode) continue;

      const cacheKey = `${dark ? "dark" : "light"}_${rawCode}`;
      const cachedSvg = mermaidCache.get(cacheKey);

      // Si ya está en caché para este tema, aplicar de inmediato sin parpadeo
      if (cachedSvg) {
        mountDiagram(container, cachedSvg, index, false);
        continue;
      }

      try {
        await mermaid.parse(rawCode);
        const renderId = `mermaid_svg_${Date.now()}_${index}`;
        const { svg } = await mermaid.render(renderId, rawCode);
        mermaidCache.set(cacheKey, svg);
        mountDiagram(container, svg, index, false);
      } catch (_err) {
        // En caso de sintaxis incompleta al escribir, mostrar versión previa en caché si existe
        if (cachedSvg) {
          mountDiagram(container, cachedSvg, index, true);
        } else {
          container.innerHTML = `
            <div class="mermaid-error">
              <span class="mermaid-error-title">⚠️ Sintaxis de diagrama incompleta</span>
              <pre><code>${rawCode}</code></pre>
            </div>
          `;
        }
      }
    }
  }

  /**
   * Monta el diagrama con sus controles de zoom interactivo (+, -, ↺) de manera atómica sin parpadeos.
   */
  function mountDiagram(
    container: HTMLDivElement,
    rawSvg: string,
    index: number,
    isCachedNotice: boolean,
  ): void {
    const currentZoom = diagramZoomLevels.get(index) || 1.0;
    const viewport = container.querySelector<HTMLDivElement>(
      ".mermaid-svg-viewport",
    );

    // Si la estructura ya existe, actualizar únicamente el SVG para evitar parpadeos visuales
    if (viewport && container.querySelector(".mermaid-header-bar")) {
      viewport.innerHTML = rawSvg;
      const svgEl = viewport.querySelector<SVGElement>("svg");
      if (svgEl) {
        svgEl.removeAttribute("height");
        let viewBoxWidth = 600;
        const vb = svgEl.getAttribute("viewBox");
        if (vb) {
          const parts = vb.trim().split(/\s+/);
          if (parts.length === 4) {
            const parsed = parseFloat(parts[2]);
            if (!isNaN(parsed) && parsed > 0) viewBoxWidth = parsed;
          }
        }
        const baseWidth = Math.min(Math.max(viewBoxWidth * 1.15, 540), 980);
        applyDiagramWidth(svgEl, currentZoom, baseWidth);
      }
      return;
    }

    container.innerHTML = `
      <div class="mermaid-header-bar">
        <span class="mermaid-type-label">Diagrama</span>
        <div class="mermaid-zoom-controls">
          <button class="mermaid-btn btn-zoom-out" type="button" title="Reducir (−)">−</button>
          <button class="mermaid-btn btn-zoom-reset" type="button" title="Restablecer (1.0)">↺</button>
          <button class="mermaid-btn btn-zoom-in" type="button" title="Aumentar (+)">+</button>
        </div>
      </div>
      <div class="mermaid-svg-viewport">
        ${rawSvg}
      </div>
      ${isCachedNotice ? '<span class="mermaid-syntax-notice">⏳ Editando sintaxis (mostrando versión previa)...</span>' : ""}
    `;

    const svgEl = container.querySelector<SVGElement>("svg");
    if (svgEl) {
      svgEl.removeAttribute("height");

      let viewBoxWidth = 600;
      const vb = svgEl.getAttribute("viewBox");
      if (vb) {
        const parts = vb.trim().split(/\s+/);
        if (parts.length === 4) {
          const parsed = parseFloat(parts[2]);
          if (!isNaN(parsed) && parsed > 0) viewBoxWidth = parsed;
        }
      }

      const baseWidth = Math.min(Math.max(viewBoxWidth * 1.15, 540), 980);
      applyDiagramWidth(svgEl, currentZoom, baseWidth);

      const btnIn = container.querySelector<HTMLButtonElement>(".btn-zoom-in");
      const btnOut =
        container.querySelector<HTMLButtonElement>(".btn-zoom-out");
      const btnReset =
        container.querySelector<HTMLButtonElement>(".btn-zoom-reset");

      btnIn?.addEventListener("click", () => {
        let zoom = diagramZoomLevels.get(index) || 1.0;
        zoom = Math.min(zoom + 0.2, 2.4);
        diagramZoomLevels.set(index, zoom);
        applyDiagramWidth(svgEl, zoom, baseWidth);
      });

      btnOut?.addEventListener("click", () => {
        let zoom = diagramZoomLevels.get(index) || 1.0;
        zoom = Math.max(zoom - 0.2, 0.6);
        diagramZoomLevels.set(index, zoom);
        applyDiagramWidth(svgEl, zoom, baseWidth);
      });

      btnReset?.addEventListener("click", () => {
        diagramZoomLevels.set(index, 1.0);
        applyDiagramWidth(svgEl, 1.0, baseWidth);
      });
    }
  }

  function applyDiagramWidth(
    svgEl: SVGElement,
    zoom: number,
    baseWidth: number,
  ): void {
    const targetWidth = Math.round(baseWidth * zoom);
    svgEl.style.width = `${targetWidth}px`;
    svgEl.style.maxWidth = zoom > 1.0 ? "none" : "100%";
  }

  /**
   * Manejo suave de enlaces internos (#anclas).
   */
  function handleContainerClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const link = target.closest("a");
    if (!link) return;

    const href = link.getAttribute("href");
    if (!href) return;

    if (href.startsWith("#")) {
      event.preventDefault();
      const targetId = decodeURIComponent(href.slice(1)).trim();
      if (!targetId || !scrollContainer) return;

      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        const cRect = scrollContainer.getBoundingClientRect();
        const tRect = targetEl.getBoundingClientRect();
        const offsetTop = tRect.top - cRect.top + scrollContainer.scrollTop;

        scrollContainer.scrollTo({
          top: Math.max(0, offsetTop - 18),
          behavior: "smooth",
        });

        targetEl.classList.remove("highlight-anchor-target");
        void targetEl.offsetWidth; // Forzar reflow
        targetEl.classList.add("highlight-anchor-target");
      }
    } else if (href.startsWith("http://") || href.startsWith("https://")) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    }
  }

  function handleScroll(e: Event): void {
    if (scrollContainer) {
      previousScrollTop = scrollContainer.scrollTop;
    }
    if (onContainerScroll) {
      onContainerScroll(e);
    }
  }

  export function getScrollElement(): HTMLDivElement | null {
    return scrollContainer;
  }

  /**
   * Prepara los diagramas para exportación limpia a PDF con colores claros estándar.
   */
  export async function prepareForPrint(): Promise<void> {
    if (isDark) {
      await renderMermaidBlocks(false);
    }
  }

  /**
   * Devuelve el HTML renderizado (con diagramas en tema claro) listo para exportar.
   */
  export async function getExportHtml(): Promise<string> {
    await prepareForPrint();
    await tick();
    const article = scrollContainer?.querySelector<HTMLElement>(
      ".reading-table-content",
    );
    const html = article ? cleanPreviewHtml(article) : "";
    await restoreAfterPrint();
    return html;
  }

  /**
   * Restaura los diagramas al tema actual tras cerrar el diálogo de impresión.
   */
  export async function restoreAfterPrint(): Promise<void> {
    if (isDark) {
      await renderMermaidBlocks(true);
    }
  }

  onMount(() => {
    renderMermaidBlocks(isDark);

    const handleBeforePrint = () => {
      prepareForPrint();
    };

    const handleAfterPrint = () => {
      restoreAfterPrint();
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="preview-scroll-container font-size-{fontSize}"
  bind:this={scrollContainer}
  onscroll={handleScroll}
  onclick={handleContainerClick}
>
  <article class="reading-table-content" style={codeVars}>
    {@html renderedHtml}
  </article>
</div>

<style>
  .preview-scroll-container {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    background-color: var(--reading-bg, #1e1f22);
    color: var(--reading-text, #e8e6e1);
  }

  .reading-table-content {
    max-width: 820px;
    margin: 0 auto;
    padding: 1.5rem 2.5rem 8rem;
    font-family: inherit;
    word-break: break-word;
  }

  /* Encabezados */
  :global(.reading-table-content h1),
  :global(.reading-table-content h2),
  :global(.reading-table-content h3),
  :global(.reading-table-content h4),
  :global(.reading-table-content h5),
  :global(.reading-table-content h6) {
    color: var(--reading-heading, #f5f4ef);
    font-weight: 650;
    line-height: 1.35;
    margin-top: 2.2rem;
    margin-bottom: 0.85rem;
    scroll-margin-top: 2rem;
  }

  :global(.reading-table-content h1) {
    font-size: 2.15rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--reading-border, #2b2d31);
    margin-top: 0.5rem;
  }

  :global(.reading-table-content h2) {
    font-size: 1.6rem;
    padding-bottom: 0.35rem;
    border-bottom: 1px solid var(--reading-border-subtle, #232427);
  }

  :global(.reading-table-content h3) {
    font-size: 1.25rem;
  }

  :global(.reading-table-content p) {
    margin-top: 0;
    margin-bottom: 1.25rem;
  }

  :global(.highlight-anchor-target) {
    background-color: var(--accent-soft, rgba(95, 179, 163, 0.15));
    border-radius: 4px;
    padding: 2px 6px;
  }

  /* Citas / Blockquotes */
  :global(.reading-table-content blockquote) {
    margin: 1.5rem 0;
    padding: 0.85rem 1.35rem;
    border-left: 3.5px solid var(--reading-accent, #5fb3a3);
    background-color: var(--reading-quote-bg, rgba(95, 179, 163, 0.07));
    border-radius: 0 6px 6px 0;
    color: var(--reading-quote-text, #c9c7bf);
    font-style: italic;
  }

  :global(.reading-table-content blockquote p:last-child) {
    margin-bottom: 0;
  }

  /* Listas y tareas interactivas */
  :global(.reading-table-content ul),
  :global(.reading-table-content ol) {
    padding-left: 1.75rem;
    margin-bottom: 1.25rem;
  }

  :global(.reading-table-content li) {
    margin-bottom: 0.4rem;
  }

  :global(.reading-table-content .task-checkbox) {
    margin-right: 0.6rem;
    cursor: pointer;
    vertical-align: middle;
    width: 16px;
    height: 16px;
    accent-color: var(--reading-accent, #5fb3a3);
  }

  /* Bloques de código con barra superior y botón de copiar */
  :global(.reading-table-content .code-block-wrapper) {
    margin: 1.75rem 0;
    border: 1px solid var(--code-border, var(--reading-border, #2b2d31));
    border-radius: 8px;
    overflow: hidden;
    background-color: var(--code-bg, var(--reading-pre-bg, #141517));
  }

  :global(.reading-table-content .code-header-bar) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background-color: color-mix(in srgb, var(--code-bg, #1a1b1d) 94%, var(--code-fg, #888));
    border-bottom: 1px solid var(--code-border, var(--reading-border, #2b2d31));
    font-size: 0.75rem;
  }

  :global(.reading-table-content .code-lang-label) {
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--reading-muted, #9b9a94);
  }

  :global(.reading-table-content .code-copy-btn) {
    border: none;
    background: transparent;
    color: var(--reading-muted, #9b9a94);
    cursor: pointer;
    font-size: 0.75rem;
    padding: 3px 8px;
    border-radius: 4px;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;
  }

  :global(.reading-table-content .code-copy-btn:hover) {
    background-color: var(--reading-hover, #2e3034);
    color: var(--reading-text, #e8e6e1);
  }

  :global(.reading-table-content .code-copy-btn.copied) {
    color: #4ade80 !important;
  }

  :global(.reading-table-content pre) {
    margin: 0;
    padding: 1.15rem 1.35rem;
    background-color: transparent;
    overflow-x: auto;
  }

  :global(.reading-table-content code) {
    font-family: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
    font-size: 0.9em;
  }

  :global(.reading-table-content pre code.hljs) {
    display: block;
    overflow-x: auto;
    font-family: "JetBrains Mono", ui-monospace, Menlo, Monaco, Consolas,
      monospace;
    font-size: 0.9em;
    line-height: 1.68;
    background: transparent;
    padding: 0;
  }

  /* Los colores de tokens vienen de la paleta activa (--tok-*, --code-*) */
  :global(.reading-table-content .hljs) {
    color: var(--tok-base);
  }

  :global(.reading-table-content .hljs-keyword),
  :global(.reading-table-content .hljs-selector-tag),
  :global(.reading-table-content .hljs-literal),
  :global(.reading-table-content .hljs-doctag) {
    color: var(--tok-keyword);
  }

  :global(.reading-table-content .hljs-built_in),
  :global(.reading-table-content .hljs-type),
  :global(.reading-table-content .hljs-class .hljs-title),
  :global(.reading-table-content .hljs-title.class_),
  :global(.reading-table-content .hljs-meta),
  :global(.reading-table-content .hljs-meta .hljs-keyword) {
    color: var(--tok-type);
  }

  :global(.reading-table-content .hljs-title),
  :global(.reading-table-content .hljs-title.function_),
  :global(.reading-table-content .hljs-function),
  :global(.reading-table-content .hljs-section) {
    color: var(--tok-function);
  }

  :global(.reading-table-content .hljs-variable),
  :global(.reading-table-content .hljs-template-variable),
  :global(.reading-table-content .hljs-params),
  :global(.reading-table-content .hljs-property),
  :global(.reading-table-content .hljs-symbol),
  :global(.reading-table-content .hljs-selector-id),
  :global(.reading-table-content .hljs-selector-class),
  :global(.reading-table-content .hljs-selector-attr) {
    color: var(--tok-variable);
  }

  :global(.reading-table-content .hljs-attr),
  :global(.reading-table-content .hljs-attribute),
  :global(.reading-table-content .hljs-name) {
    color: var(--tok-attr);
  }

  :global(.reading-table-content .hljs-tag) {
    color: var(--tok-tag);
  }

  :global(.reading-table-content .hljs-string),
  :global(.reading-table-content .hljs-meta .hljs-string) {
    color: var(--tok-string);
  }

  :global(.reading-table-content .hljs-number),
  :global(.reading-table-content .hljs-bullet) {
    color: var(--tok-number);
  }

  :global(.reading-table-content .hljs-regexp),
  :global(.reading-table-content .hljs-link) {
    color: var(--tok-regexp);
  }

  :global(.reading-table-content .hljs-comment),
  :global(.reading-table-content .hljs-quote) {
    color: var(--tok-comment);
    font-style: italic;
  }

  :global(.reading-table-content .hljs-addition) {
    color: var(--tok-add);
  }

  :global(.reading-table-content .hljs-deletion) {
    color: var(--tok-del);
  }

  :global(.reading-table-content .hljs-emphasis) {
    font-style: italic;
  }

  :global(.reading-table-content .hljs-strong) {
    font-weight: 700;
  }

  :global(.reading-table-content :not(pre) > code) {
    padding: 0.2em 0.45em;
    border-radius: 4px;
    background-color: var(--reading-code-bg, #121315);
    color: var(--reading-code-text, #7cc9bb);
    border: 1px solid var(--reading-border-subtle, #232427);
  }

  /* Tablas con desplazamiento horizontal táctil */
  :global(.reading-table-content table) {
    width: 100%;
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    border-collapse: collapse;
    margin: 1.75rem 0;
    font-size: 0.95rem;
  }

  :global(.reading-table-content th),
  :global(.reading-table-content td) {
    padding: 0.75rem 1rem;
    border: 1px solid var(--reading-border, #2b2d31);
    text-align: left;
  }

  :global(.reading-table-content th) {
    background-color: var(--bg-surface, #1a1b1d);
    font-weight: 600;
  }

  :global(.reading-table-content tr:nth-child(even)) {
    background-color: var(--reading-table-stripe, #1b1c1f);
  }

  /* Enlaces */
  :global(.reading-table-content a) {
    color: var(--reading-accent, #5fb3a3);
    text-decoration: underline;
    text-underline-offset: 3px;
    transition: color 0.15s ease;
  }

  :global(.reading-table-content a:hover) {
    color: var(--reading-accent-hover, #7cc9bb);
  }

  /* KaTeX Fórmulas Matemáticas */
  :global(.reading-table-content .katex-display-wrapper) {
    margin: 1.75rem 0;
    padding: 1.25rem 1.5rem;
    background-color: var(--reading-math-bg, #18191c);
    border: 1px solid var(--reading-border, #2b2d31);
    border-radius: 8px;
    overflow-x: auto;
    text-align: center;
  }

  :global(.reading-table-content .katex) {
    font-size: 1.1em;
  }

  :global(.reading-table-content .katex-error) {
    color: var(--danger-color, #e5736a);
    font-family: monospace;
    font-size: 0.85em;
  }

  /* Contenedores Mermaid con zoom interactivo */
  :global(.reading-table-content .mermaid-container) {
    margin: 2rem 0;
    border: 1px solid var(--reading-border, #2b2d31);
    border-radius: 8px;
    background-color: var(--reading-diagram-bg, #1a1b1d);
    overflow: hidden;
  }

  :global(.reading-table-content .mermaid-header-bar) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background-color: var(--bg-surface, #1a1b1d);
    border-bottom: 1px solid var(--reading-border, #2b2d31);
  }

  :global(.reading-table-content .mermaid-type-label) {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--reading-muted, #9b9a94);
    letter-spacing: 0.05em;
  }

  :global(.reading-table-content .mermaid-zoom-controls) {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  :global(.reading-table-content .mermaid-btn) {
    border: 1px solid var(--reading-border, #2b2d31);
    background-color: var(--bg-elevated, #26282b);
    color: var(--reading-text, #e8e6e1);
    width: 26px;
    height: 24px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.15s ease;
  }

  :global(.reading-table-content .mermaid-btn:hover) {
    background-color: var(--reading-hover, #2e3034);
    color: var(--reading-accent, #5fb3a3);
  }

  :global(.reading-table-content .mermaid-svg-viewport) {
    padding: 1.5rem;
    display: flex;
    justify-content: center;
    overflow-x: auto;
  }

  :global(.reading-table-content .mermaid-syntax-notice) {
    display: block;
    padding: 4px 12px;
    background-color: var(--warn-color, #d9a441);
    color: #000000;
    font-size: 0.75rem;
    font-weight: 600;
    text-align: center;
  }

  :global(.reading-table-content .mermaid-error) {
    padding: 1rem;
    background-color: rgba(229, 115, 106, 0.1);
    border-radius: 6px;
    color: var(--danger-color, #e5736a);
    font-size: 0.85rem;
  }

  :global(.reading-table-content hr) {
    border: none;
    border-top: 1px solid var(--reading-border, #2b2d31);
    margin: 2.5rem 0;
  }

  @media (max-width: 768px) {
    .reading-table-content {
      padding: 1.5rem 1rem 6rem;
    }

    :global(.reading-table-content h1) {
      font-size: 1.75rem;
    }

    :global(.reading-table-content h2) {
      font-size: 1.35rem;
    }

    :global(.reading-table-content h3) {
      font-size: 1.15rem;
    }

    :global(.reading-table-content .mermaid-svg-viewport) {
      padding: 0.75rem 0.5rem;
    }

    :global(.reading-table-content .code-header-bar) {
      padding: 6px 10px;
    }

    :global(.reading-table-content pre) {
      padding: 0.75rem 1rem;
      font-size: 0.85rem;
    }
  }
</style>
