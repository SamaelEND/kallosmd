/**
 * Renderizador en vivo de Mermaid para Live Preview (con debounce de 300 ms y detalle de línea de error)
 * y modal interactivo a pantalla completa con zoom, arrastre y exportación (Código, SVG y PNG).
 */

import { configureMermaid } from "../../preview/mermaidRenderer";

const liveSvgCache = new Map<string, string>();
let renderCounter = 0;

function isDarkActive(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatMermaidError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Error de sintaxis en el diagrama Mermaid";
  return raw.trim();
}

function getSvgDimensions(svgEl: SVGElement): { width: number; height: number } {
  const vb = svgEl.getAttribute("viewBox");
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/);
    if (parts.length === 4) {
      const w = parseFloat(parts[2]);
      const h = parseFloat(parts[3]);
      if (w > 0 && h > 0) return { width: w, height: h };
    }
  }
  return { width: 800, height: 500 };
}

/**
 * Renderiza asíncronamente un código Mermaid en un contenedor DOM.
 * Si `debounceMs > 0`, espera antes de re-evaluar mientras el usuario teclea.
 */
const pendingTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

export function renderLiveMermaidInto(
  host: HTMLElement,
  rawCode: string,
  debounceMs: number,
): void {
  const trimmed = rawCode.trim();
  const dark = isDarkActive();
  const cacheKey = `${dark ? "d" : "l"}:${trimmed}`;

  const existingTimer = pendingTimers.get(host);
  if (existingTimer) clearTimeout(existingTimer);

  const cached = liveSvgCache.get(cacheKey);
  if (cached && debounceMs === 0) {
    mountDiagramBox(host, trimmed, cached, null);
    return;
  }

  // Si ya hay un SVG previo en caché de esta misma clave, muéstralo de inmediato
  if (cached) {
    mountDiagramBox(host, trimmed, cached, null);
  }

  const runRender = async () => {
    if (!trimmed) {
      mountDiagramBox(host, "", null, "Escribe la definición del diagrama Mermaid...");
      return;
    }
    try {
      const mermaid = await configureMermaid(isDarkActive());
      await mermaid.parse(trimmed);
      const id = `cm_live_mmd_${Date.now()}_${++renderCounter}`;
      const { svg } = await mermaid.render(id, trimmed);
      liveSvgCache.set(cacheKey, svg);
      mountDiagramBox(host, trimmed, svg, null);
    } catch (err) {
      const errMsg = formatMermaidError(err);
      mountDiagramBox(host, trimmed, null, errMsg);
    }
  };

  if (debounceMs > 0) {
    const timer = setTimeout(runRender, debounceMs);
    pendingTimers.set(host, timer);
  } else {
    void runRender();
  }
}

function mountDiagramBox(
  host: HTMLElement,
  rawCode: string,
  svg: string | null,
  errorText: string | null,
): void {
  host.innerHTML = "";

  const toolbar = document.createElement("div");
  toolbar.className = "cm-live-mermaid-toolbar";

  const expandBtn = document.createElement("button");
  expandBtn.type = "button";
  expandBtn.className = "cm-live-expand-btn";
  expandBtn.textContent = "Expandir";
  expandBtn.title = "Abrir diagrama a pantalla completa con zoom y exportación";
  expandBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openMermaidFullscreenModal(rawCode, svg);
  });
  toolbar.appendChild(expandBtn);
  host.appendChild(toolbar);

  if (errorText) {
    const errBox = document.createElement("div");
    errBox.className = "cm-live-mermaid-error";
    errBox.innerHTML = `<div class="cm-live-mermaid-error-title">⚠️ Error de sintaxis en Mermaid</div><pre class="cm-live-mermaid-error-msg">${escapeHtml(errorText)}</pre>`;
    host.appendChild(errBox);
    return;
  }

  if (svg) {
    const viewport = document.createElement("div");
    viewport.className = "cm-live-mermaid-viewport";
    viewport.innerHTML = svg;
    const svgEl = viewport.querySelector("svg");
    if (svgEl) {
      svgEl.style.maxWidth = "100%";
      svgEl.style.height = "auto";
    }
    host.appendChild(viewport);
  }
}

/**
 * Abre el modal a pantalla completa con zoom, arrastre, copiar código, exportar SVG y exportar PNG.
 */
export function openMermaidFullscreenModal(
  rawCode: string,
  initialSvg: string | null,
): void {
  if (typeof document === "undefined") return;
  if (!document.getElementById("cm-mmd-modal-styles")) {
    const st = document.createElement("style");
    st.id = "cm-mmd-modal-styles";
    st.textContent = `
      .cm-mmd-modal-overlay{position:fixed;inset:0;z-index:9999;background:rgba(8,10,14,0.82);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:24px;}
      .cm-mmd-modal-card{width:100%;max-width:1280px;height:88vh;background:var(--bg-surface,#181a1f);border:1px solid var(--border-color,#2b303c);border-radius:12px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.65);}
      .cm-mmd-modal-header{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:var(--bg-elevated,#20232a);border-bottom:1px solid var(--border-color,#2b303c);gap:12px;flex-wrap:wrap;}
      .cm-mmd-modal-left,.cm-mmd-modal-actions,.cm-mmd-zoom-group{display:flex;align-items:center;gap:8px;}
      .cm-mmd-modal-badge{font-size:0.72rem;font-weight:700;letter-spacing:0.06em;color:var(--accent-color,#5fb3a3);padding:2px 8px;border-radius:4px;background:rgba(95,179,163,0.14);}
      .cm-mmd-zoom-label{font-size:0.78rem;min-width:44px;text-align:center;color:var(--text-secondary,#94a3b8);font-variant-numeric:tabular-nums;}
      .cm-mmd-btn,.cm-mmd-action-btn,.cm-mmd-close-btn{border:1px solid var(--border-color,#2b303c);background:var(--bg-surface,#181a1f);color:var(--text-primary,#f1f5f9);border-radius:6px;padding:5px 10px;font-size:0.78rem;cursor:pointer;font-family:inherit;}
      .cm-mmd-btn:hover,.cm-mmd-action-btn:hover,.cm-mmd-close-btn:hover{border-color:var(--accent-color,#5fb3a3);color:var(--accent-color,#5fb3a3);}
      .cm-mmd-modal-stage{flex:1;position:relative;overflow:hidden;cursor:grab;display:flex;align-items:center;justify-content:center;background:var(--reading-diagram-bg,#14161a);user-select:none;}
      .cm-mmd-modal-stage.is-dragging{cursor:grabbing;}
      .cm-mmd-modal-canvas{transform-origin:center center;transition:transform 0.04s linear;}
    `;
    document.head.appendChild(st);
  }
  document.getElementById("cm-live-mermaid-modal")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "cm-live-mermaid-modal";
  overlay.className = "cm-mmd-modal-overlay";

  overlay.innerHTML = `
    <div class="cm-mmd-modal-card" role="dialog" aria-modal="true" aria-label="Vista ampliada de diagrama Mermaid">
      <header class="cm-mmd-modal-header">
        <div class="cm-mmd-modal-left">
          <span class="cm-mmd-modal-badge">MERMAID</span>
          <div class="cm-mmd-zoom-group">
            <button type="button" class="cm-mmd-btn" data-action="zoom-out" title="Alejar">−</button>
            <span class="cm-mmd-zoom-label" data-role="zoom-label">100%</span>
            <button type="button" class="cm-mmd-btn" data-action="zoom-in" title="Acercar">+</button>
            <button type="button" class="cm-mmd-btn" data-action="zoom-reset" title="Restablecer vista">↺</button>
          </div>
        </div>
        <div class="cm-mmd-modal-actions">
          <button type="button" class="cm-mmd-action-btn" data-action="copy-code">Copiar código</button>
          <button type="button" class="cm-mmd-action-btn" data-action="export-svg">Exportar SVG</button>
          <button type="button" class="cm-mmd-action-btn" data-action="export-png">Exportar PNG</button>
          <button type="button" class="cm-mmd-close-btn" data-action="close" title="Cerrar (Esc)">✕</button>
        </div>
      </header>
      <div class="cm-mmd-modal-stage" data-role="stage">
        <div class="cm-mmd-modal-canvas" data-role="canvas">${initialSvg || ""}</div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const stage = overlay.querySelector<HTMLElement>('[data-role="stage"]')!;
  const canvas = overlay.querySelector<HTMLElement>('[data-role="canvas"]')!;
  const zoomLabel = overlay.querySelector<HTMLElement>('[data-role="zoom-label"]')!;

  let scale = 1;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  const applyTransform = () => {
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    zoomLabel.textContent = `${Math.round(scale * 100)}%`;
  };

  stage.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    stage.classList.add("is-dragging");
  });

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    applyTransform();
  };

  const onMouseUp = () => {
    isDragging = false;
    stage.classList.remove("is-dragging");
  };

  stage.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      scale = Math.min(4, Math.max(0.3, scale + delta));
      applyTransform();
    },
    { passive: false },
  );

  const closeModal = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("keydown", onKeyDown);
    overlay.remove();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeModal();
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("keydown", onKeyDown);

  overlay.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target === overlay) {
      closeModal();
      return;
    }
    const btn = target.closest<HTMLButtonElement>("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === "close") closeModal();
    else if (action === "zoom-in") {
      scale = Math.min(4, scale + 0.25);
      applyTransform();
    } else if (action === "zoom-out") {
      scale = Math.max(0.3, scale - 0.25);
      applyTransform();
    } else if (action === "zoom-reset") {
      scale = 1;
      panX = 0;
      panY = 0;
      applyTransform();
    } else if (action === "copy-code") {
      navigator.clipboard?.writeText(rawCode);
      const prev = btn.textContent;
      btn.textContent = "¡Copiado!";
      setTimeout(() => (btn.textContent = prev), 1400);
    } else if (action === "export-svg") {
      const svgEl = canvas.querySelector("svg");
      if (!svgEl) return;
      const blob = new Blob([svgEl.outerHTML], { type: "image/svg+xml;charset=utf-8" });
      triggerDownload(URL.createObjectURL(blob), `diagrama-mermaid-${Date.now()}.svg`, true);
    } else if (action === "export-png") {
      const svgEl = canvas.querySelector("svg");
      if (!svgEl) return;
      exportSvgElementAsPng(svgEl);
    }
  });
}

function triggerDownload(url: string, filename: string, revokeAfter: boolean): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revokeAfter) setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportSvgElementAsPng(svgEl: SVGElement): void {
  const { width, height } = getSvgDimensions(svgEl);
  const clone = svgEl.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  const serialized = new XMLSerializer().serializeToString(clone);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;

  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const c = document.createElement("canvas");
    c.width = width * scale;
    c.height = height * scale;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = isDarkActive() ? "#16181d" : "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    triggerDownload(c.toDataURL("image/png"), `diagrama-mermaid-${Date.now()}.png`, false);
  };
  img.src = dataUrl;
}
