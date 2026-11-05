/**
 * Interacciones del DOM en el panel de vista previa:
 * - Copiado de bloques de código al portapapeles
 * - Checkboxes interactivos sincronizados con el código fuente Markdown
 * - Navegación suave hacia anclas internas (#)
 */

/**
 * Configura los botones de copiar en los bloques de código renderizados.
 */
export function setupCopyButtons(scrollContainer: HTMLElement | null): void {
  if (!scrollContainer) return;

  const copyButtons =
    scrollContainer.querySelectorAll<HTMLButtonElement>(".code-copy-btn");
  copyButtons.forEach((btn) => {
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
 * Configura los checkboxes de listas de tareas para que actualicen el documento activo.
 */
export function setupTaskCheckboxes(
  scrollContainer: HTMLElement | null,
  onToggleTask: (index: number, checked: boolean) => void,
): void {
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
        onToggleTask(idx, cb.checked);
      });
    }
  });
}

/**
 * Gestiona el clic en enlaces dentro de la vista previa (scroll suave a anclas # o apertura externa segura).
 */
export function handlePreviewLinkClick(
  event: MouseEvent,
  scrollContainer: HTMLElement | null,
): void {
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
      void targetEl.offsetWidth;
      targetEl.classList.add("highlight-anchor-target");
    }
  } else if (href.startsWith("http://") || href.startsWith("https://")) {
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  }
}

