/**
 * Renderizador de diagramas Mermaid con caché por tema y controles interactivos de zoom.
 */

import mermaid from "mermaid";

/**
 * Inicializa y configura Mermaid con las variables de color del tema activo.
 * Se deshabilita `htmlLabels` (`foreignObject`) para garantizar que todos los diagramas
 * utilicen primitivas vectoriales `<text>`/`<tspan>` nativas de SVG, evitando
 * duplicación de texto, recortes de etiquetas y desfases al exportar a PDF.
 */
export function configureMermaid(dark: boolean): void {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    htmlLabels: false,
    fontFamily: '"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif',
    flowchart: {
      htmlLabels: false,
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
}

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

function computeBaseDiagramWidth(svgEl: SVGElement): number {
  const { width: viewBoxWidth } = getSvgViewBoxDimensions(svgEl);
  return Math.min(Math.max(viewBoxWidth * 1.1, 480), 940);
}

/**
 * Monta un diagrama SVG dentro de su contenedor con controles de zoom (+, −, ↺).
 */
export function mountMermaidDiagram(
  container: HTMLDivElement,
  rawSvg: string,
  index: number,
  isCachedNotice: boolean,
  diagramZoomLevels: Map<number, number>,
): void {
  const currentZoom = diagramZoomLevels.get(index) || 1.0;
  const viewport = container.querySelector<HTMLDivElement>(
    ".mermaid-svg-viewport",
  );

  // Si la estructura ya existe, actualizar únicamente el SVG para evitar parpadeos
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
 * Renderiza todos los bloques `.mermaid-container` dentro del contenedor de vista previa.
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

  configureMermaid(dark);

  for (let index = 0; index < containers.length; index++) {
    const container = containers[index];
    const rawCode = decodeURIComponent(
      container.getAttribute("data-mermaid-code") || "",
    ).trim();
    if (!rawCode) continue;

    const cacheKey = `${dark ? "dark" : "light"}_v2_${rawCode}`;
    const cachedSvg = mermaidCache.get(cacheKey);

    if (cachedSvg) {
      mountMermaidDiagram(
        container,
        cachedSvg,
        index,
        false,
        diagramZoomLevels,
      );
      continue;
    }

    try {
      await mermaid.parse(rawCode);
      const renderId = `mermaid_svg_${Date.now()}_${index}`;
      const { svg } = await mermaid.render(renderId, rawCode);
      mermaidCache.set(cacheKey, svg);
      mountMermaidDiagram(container, svg, index, false, diagramZoomLevels);
    } catch {
      if (cachedSvg) {
        mountMermaidDiagram(
          container,
          cachedSvg,
          index,
          true,
          diagramZoomLevels,
        );
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
