/**
 * ES: Interacciones del DOM en el panel de vista previa: copiado de código, checkboxes de tareas y navegación por anclas.
 * EN: DOM interactions in the preview panel: code copying, task checkboxes, and anchor navigation.
 */

/**
 * ES: Vincula los botones de copiar en los bloques de código renderizados con el portapapeles del sistema.
 * EN: Binds copy buttons in rendered code blocks to the system clipboard.
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
 * ES: Vincula los checkboxes de listas de tareas para sincronizar su estado con el documento Markdown activo.
 * EN: Binds task list checkboxes to synchronize their state with the active Markdown document.
 */
export function setupTaskCheckboxes(
  scrollContainer: HTMLElement | null,
  onToggleTask: (index: number, checked: boolean) => void,
): void {
  if (!scrollContainer) return;

  const checkboxes = scrollContainer.querySelectorAll<HTMLInputElement>(
    'li.task-list-item > input[type="checkbox"]',
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
 * ES: Gestiona el clic en enlaces dentro de la vista previa: desplazamiento suave a anclas locales (#) o apertura externa segura.
 * EN: Handles link clicks inside the preview: smooth scrolling to local anchors (#) or secure external opening.
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

  // ES: Desplazamiento suave para enlaces internos que apuntan a identificadores (#) dentro del contenedor de vista previa.
  // EN: Smooth scrolling for internal links targeting element identifiers (#) inside the preview container.
  if (href.startsWith("#")) {
    event.preventDefault();
    const targetId = decodeURIComponent(href.slice(1)).trim();
    if (!targetId || !scrollContainer) return;

    const targetEl = scrollContainer.querySelector<HTMLElement>(
      `#${CSS.escape(targetId)}`,
    );
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
    // ES: Asigna atributos para apertura segura en nueva pestaña sin compartir contexto de navegación.
    // EN: Assigns attributes for secure opening in a new tab without sharing browsing context.
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  }
}
