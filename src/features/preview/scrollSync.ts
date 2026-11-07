/**
 * Sincronización de desplazamiento vertical basada en bloques y líneas de origen (data-source-line)
 * entre el contenedor de la vista previa y el editor.
 */

/**
 * Calcula la posición de desplazamiento vertical exacta de un elemento dentro del contenedor de scroll.
 */
function getElementScrollTop(container: HTMLElement, el: HTMLElement): number {
  return (
    el.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop
  );
}

/**
 * Desplaza el contenedor de la vista previa hacia el elemento que corresponde a la línea del editor,
 * interpolando suavemente dentro del bloque.
 */
export function scrollContainerToSourceLine(
  scrollContainer: HTMLElement | null,
  targetLine: number,
  fraction = 0,
): void {
  if (!scrollContainer) return;
  const maxScroll =
    scrollContainer.scrollHeight - scrollContainer.clientHeight;
  if (maxScroll <= 0) return;

  if (targetLine <= 1 && fraction <= 0) {
    scrollContainer.scrollTop = 0;
    return;
  }

  const elements = Array.from(
    scrollContainer.querySelectorAll<HTMLElement>("[data-source-line]"),
  );
  if (elements.length === 0) return;

  const lastEl = elements[elements.length - 1];
  const lastLine = parseInt(lastEl.dataset.sourceLine || "0", 10);
  if (targetLine >= lastLine && fraction >= 1) {
    scrollContainer.scrollTop = maxScroll;
    return;
  }

  let prevEl: HTMLElement | null = null;
  let nextEl: HTMLElement | null = null;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const elLine = parseInt(el.dataset.sourceLine || "0", 10);
    if (elLine <= targetLine) {
      prevEl = el;
    } else {
      nextEl = el;
      break;
    }
  }

  if (!prevEl && nextEl) {
    const nextTop = getElementScrollTop(scrollContainer, nextEl);
    scrollContainer.scrollTop = Math.max(0, nextTop - 16);
    return;
  }

  if (prevEl && !nextEl) {
    const prevTop = getElementScrollTop(scrollContainer, prevEl);
    const targetTop = prevTop + fraction * (prevEl.offsetHeight || 20);
    scrollContainer.scrollTop = Math.min(targetTop, maxScroll);
    return;
  }

  if (prevEl && nextEl) {
    const prevLine = parseInt(prevEl.dataset.sourceLine || "0", 10);
    const nextLine = parseInt(nextEl.dataset.sourceLine || "0", 10);
    const prevTop = getElementScrollTop(scrollContainer, prevEl);
    const nextTop = getElementScrollTop(scrollContainer, nextEl);

    const lineSpan = Math.max(1, nextLine - prevLine);
    const progress = Math.max(
      0,
      Math.min(1, (targetLine - prevLine + fraction) / lineSpan),
    );
    const targetTop = prevTop + progress * (nextTop - prevTop);
    scrollContainer.scrollTop = Math.min(targetTop, maxScroll);
  }
}

/**
 * Obtiene el número de línea de origen y fracción vertical del elemento visible en la parte superior de la vista previa.
 */
export function getContainerVisibleSourceLine(
  scrollContainer: HTMLElement | null,
): { line: number; fraction: number } | null {
  if (!scrollContainer) return null;
  const top = scrollContainer.scrollTop;
  const maxScroll =
    scrollContainer.scrollHeight - scrollContainer.clientHeight;

  if (top <= 2) {
    return { line: 1, fraction: 0 };
  }

  const elements = Array.from(
    scrollContainer.querySelectorAll<HTMLElement>("[data-source-line]"),
  );
  if (elements.length === 0) return null;

  if (maxScroll > 0 && top >= maxScroll - 4) {
    const lastEl = elements[elements.length - 1];
    const lastLine = parseInt(lastEl.dataset.sourceLine || "1", 10);
    return { line: lastLine, fraction: 1 };
  }

  let prevEl: HTMLElement | null = null;
  let nextEl: HTMLElement | null = null;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const elTop = getElementScrollTop(scrollContainer, el);
    if (elTop <= top + 16) {
      prevEl = el;
    } else {
      nextEl = el;
      break;
    }
  }

  if (!prevEl && nextEl) {
    const firstLine = parseInt(nextEl.dataset.sourceLine || "1", 10);
    return { line: firstLine, fraction: 0 };
  }

  if (prevEl && !nextEl) {
    const line = parseInt(prevEl.dataset.sourceLine || "1", 10);
    const prevTop = getElementScrollTop(scrollContainer, prevEl);
    const height = Math.max(1, prevEl.offsetHeight);
    const fraction = Math.max(0, Math.min(1, (top - prevTop) / height));
    return { line, fraction };
  }

  if (prevEl && nextEl) {
    const prevLine = parseInt(prevEl.dataset.sourceLine || "1", 10);
    const nextLine = parseInt(nextEl.dataset.sourceLine || "1", 10);
    const prevTop = getElementScrollTop(scrollContainer, prevEl);
    const nextTop = getElementScrollTop(scrollContainer, nextEl);

    const distance = Math.max(1, nextTop - prevTop);
    const progress = Math.max(0, Math.min(1, (top - prevTop) / distance));
    const lineSpan = Math.max(1, nextLine - prevLine);
    const exactLine = prevLine + progress * lineSpan;
    const targetLine = Math.floor(exactLine);
    const fraction = exactLine - targetLine;
    return { line: targetLine, fraction };
  }

  return null;
}

