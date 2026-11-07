/**
 * ES: Renderizador de diagramas Mermaid con carga bajo demanda, caché LRU y controles interactivos de zoom.
 * EN: Mermaid diagram renderer with on-demand loading, LRU cache, and interactive zoom controls.
 */

import type { Mermaid } from "mermaid";

// ES: Límite máximo de diagramas almacenados en la caché en memoria.
// EN: Maximum number of diagrams stored in the in-memory cache.
const MAX_CACHE_ENTRIES = 40;

let mermaidInstancePromise: Promise<Mermaid> | null = null;

/**
 * ES: Carga e importa dinámicamente el motor de Mermaid solo cuando el documento contiene diagramas.
 * EN: Dynamically loads and imports the Mermaid engine only when the document contains diagrams.
 */
async function getMermaidInstance(): Promise<Mermaid> {
  if (!mermaidInstancePromise) {
    mermaidInstancePromise = import("mermaid").then((mod) => mod.default);
  }
  return mermaidInstancePromise;
}

/**
 * ES: Inicializa y configura Mermaid con las variables de color del tema activo y primitivas SVG nativas.
 * EN: Initializes and configures Mermaid with active theme color variables and native SVG primitives.
 */
export async function configureMermaid(dark: boolean): Promise<Mermaid> {
  const mermaid = await getMermaidInstance();
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    htmlLabels: true,
    fontFamily: '"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif',
    flowchart: {
      htmlLabels: true,
      useMaxWidth: false,
      padding: 16,
    },
    sequence: {
      useMaxWidth: false,
      boxMargin: 10,
    },
    state: {
      dividerMargin: 10,
      sizeUnit: 5,
      padding: 12,
    },
    themeVariables: {
      darkMode: dark,
      fontSize: "13px",
      background: "transparent",
      mainBkg: dark ? "#16181d" : "#ffffff",
      nodeBorder: dark ? "#5fb3a3" : "#1f7a6d",
      nodeTextColor: dark ? "#f0f6fc" : "#1f2328",
      lineColor: dark ? "#7cc9bb" : "#1f7a6d",
      textColor: dark ? "#e6edf3" : "#1f2328",
      clusterBkg: dark
        ? "rgba(95, 179, 163, 0.06)"
        : "rgba(31, 122, 109, 0.05)",
      clusterBorder: dark ? "#4fa89b" : "#1f7a6d",
      titleColor: dark ? "#5fb3a3" : "#1f7a6d",
      edgeLabelBackground: dark ? "#20232a" : "#ffffff",
      actorBkg: dark ? "#20232a" : "#f6f8fa",
      actorBorder: dark ? "#5fb3a3" : "#1f7a6d",
      actorTextColor: dark ? "#f0f6fc" : "#1f2328",
      actorLineColor: dark ? "#5fb3a3" : "#1f7a6d",
      signalColor: dark ? "#7cc9bb" : "#1f7a6d",
      signalTextColor: dark ? "#e6edf3" : "#1f2328",
    },
  });
  return mermaid;
}

/**
 * ES: Almacena un SVG en la caché aplicando reemplazo del elemento menos usado recientemente (LRU).
 * EN: Stores an SVG in the cache applying least-recently-used (LRU) eviction.
 */
function setCacheEntry(
  cache: Map<string, string>,
  key: string,
  svg: string,
): void {
  if (cache.has(key)) {
    cache.delete(key);
  } else if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, svg);
}

/**
 * ES: Obtiene las dimensiones base a partir del atributo viewBox del elemento SVG.
 * EN: Retrieves base dimensions from the SVG element's viewBox attribute.
 */
function getSvgViewBoxDimensions(svgEl: SVGElement): {
  width: number;
  height: number;
} {
  const vb = svgEl.getAttribute("viewBox");
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/);
    if (parts.length === 4) {
      const w = parseFloat(parts[2]);
      const h = parseFloat(parts[3]);
      if (!isNaN(w) && w > 0 && !isNaN(h) && h > 0) {
        return { width: w, height: h };
      }
    }
  }
  return { width: 600, height: 400 };
}

/**
 * ES: Aplica el nivel de escala y ancho proporcional al elemento SVG del diagrama.
 * EN: Applies zoom scale and proportional width to the diagram's SVG element.
 */
function applyDiagramWidth(
  svgEl: SVGElement,
  zoom: number,
  baseWidth: number,
): void {
  const { width: vbW, height: vbH } = getSvgViewBoxDimensions(svgEl);
  svgEl.setAttribute("width", String(Math.round(vbW)));
  svgEl.setAttribute("height", String(Math.round(vbH)));

  const targetWidth = Math.round(baseWidth * zoom);
  svgEl.style.width = `${targetWidth}px`;
  svgEl.style.height = "auto";
  svgEl.style.maxWidth = zoom > 1.0 ? "none" : "100%";
}

/**
 * ES: Calcula el ancho base óptimo del diagrama acotado entre 480px y 940px.
 * EN: Computes the optimal base diagram width bounded between 480px and 940px.
 */
function computeBaseDiagramWidth(svgEl: SVGElement): number {
  const { width: viewBoxWidth } = getSvgViewBoxDimensions(svgEl);
  return Math.min(Math.max(viewBoxWidth * 1.1, 480), 940);
}

/**
 * ES: Escapa caracteres especiales de texto HTML para prevenir interpretaciones en el DOM.
 * EN: Escapes special HTML text characters to prevent unintended DOM interpretations.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * ES: Monta un diagrama SVG dentro de su contenedor con controles interactivos de zoom (+, −, ↺).
 * EN: Mounts an SVG diagram inside its container with interactive zoom controls (+, −, ↺).
 */
export function mountMermaidDiagram(
  container: HTMLDivElement,
  rawSvg: string,
  index: number,
  isCachedNotice: boolean,
  diagramZoomLevels: Map<number, number>,
  cacheKey?: string,
): void {
  const currentZoom = diagramZoomLevels.get(index) || 1.0;
  const viewport = container.querySelector<HTMLDivElement>(
    ".mermaid-svg-viewport",
  );

  // ES: Si el diagrama con la misma clave ya está montado en el contenedor, conserva el DOM actual.
  // EN: If the diagram with the same key is already mounted in the container, preserves the current DOM.
  if (
    viewport &&
    container.querySelector(".mermaid-header-bar") &&
    cacheKey &&
    container.dataset.renderedKey === cacheKey
  ) {
    const svgEl = viewport.querySelector<SVGElement>("svg");
    if (svgEl) {
      const baseWidth = computeBaseDiagramWidth(svgEl);
      applyDiagramWidth(svgEl, currentZoom, baseWidth);
    }
    return;
  }

  if (cacheKey) {
    container.dataset.renderedKey = cacheKey;
  }

  // ES: Si la cabecera ya existe pero cambió el diagrama o el tema, actualiza solo el lienzo SVG.
  // EN: If the header already exists but the diagram or theme changed, updates only the SVG viewport.
  if (viewport && container.querySelector(".mermaid-header-bar")) {
    viewport.innerHTML = rawSvg;
    const svgEl = viewport.querySelector<SVGElement>("svg");
    if (svgEl) {
      const baseWidth = computeBaseDiagramWidth(svgEl);
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
  if (!svgEl) return;

  const baseWidth = computeBaseDiagramWidth(svgEl);
  applyDiagramWidth(svgEl, currentZoom, baseWidth);

  const btnIn = container.querySelector<HTMLButtonElement>(".btn-zoom-in");
  const btnOut = container.querySelector<HTMLButtonElement>(".btn-zoom-out");
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

/**
 * ES: Renderiza todos los bloques `.mermaid-container` presentes en el contenedor de vista previa.
 * EN: Renders all `.mermaid-container` blocks present in the preview container.
 */
export async function renderMermaidContainers(
  scrollContainer: HTMLElement | null,
  dark: boolean,
  mermaidCache: Map<string, string>,
  diagramZoomLevels: Map<number, number>,
): Promise<void> {
  if (!scrollContainer) return;

  const containers =
    scrollContainer.querySelectorAll<HTMLDivElement>(".mermaid-container");
  if (containers.length === 0) return;

  const mermaid = await configureMermaid(dark);

  for (let index = 0; index < containers.length; index++) {
    const container = containers[index];
    const rawCode = decodeURIComponent(
      container.getAttribute("data-mermaid-code") || "",
    ).trim();
    if (!rawCode) continue;

    const cacheKey = `${dark ? "dark" : "light"}_v2_${rawCode}`;
    const cachedSvg = mermaidCache.get(cacheKey);

    if (cachedSvg) {
      setCacheEntry(mermaidCache, cacheKey, cachedSvg);
      mountMermaidDiagram(
        container,
        cachedSvg,
        index,
        false,
        diagramZoomLevels,
        cacheKey,
      );
      continue;
    }

    try {
      await mermaid.parse(rawCode);
      const renderId = `mermaid_svg_${Date.now()}_${index}`;
      const { svg } = await mermaid.render(renderId, rawCode);
      setCacheEntry(mermaidCache, cacheKey, svg);
      mountMermaidDiagram(
        container,
        svg,
        index,
        false,
        diagramZoomLevels,
        cacheKey,
      );
    } catch {
      if (cachedSvg) {
        mountMermaidDiagram(
          container,
          cachedSvg,
          index,
          true,
          diagramZoomLevels,
          cacheKey,
        );
      } else {
        // ES: Renderiza el aviso de sintaxis incompleta con el código fuente escapado.
        // EN: Renders the incomplete syntax notice with the escaped source code.
        container.removeAttribute("data-rendered-key");
        container.innerHTML = `
          <div class="mermaid-error">
            <span class="mermaid-error-title">⚠️ Sintaxis de diagrama incompleta</span>
            <pre><code>${escapeHtml(rawCode)}</code></pre>
          </div>
        `;
      }
    }
  }
}
