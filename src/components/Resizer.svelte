<script lang="ts">
  /**
   * Componente Resizer para MD Studio.
   * Permite redimensionar paneles contiguos mediante arrastre suave
   * y restablecer al 50/50 con doble clic.
   */
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    splitRatio: number; // Porcentaje del panel izquierdo (ej: 50)
    min?: number; // Mínimo porcentaje permitido (ej: 20)
    max?: number; // Máximo porcentaje permitido (ej: 80)
    onResize?: (ratio: number) => void;
    onReset?: () => void;
  }

  let {
    splitRatio = 50,
    min = 20,
    max = 80,
    onResize,
    onReset,
  }: Props = $props();

  let isDragging = $state(false);
  let resizerElement = $state<HTMLDivElement | null>(null);

  /**
   * Inicia el proceso de arrastre con captura de eventos de puntero.
   */
  function handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0) return; // Solo responder al botón principal izquierdo

    event.preventDefault();
    isDragging = true;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }

  /**
   * Calcula y actualiza la proporción relativa mientras se arrastra.
   */
  function handlePointerMove(event: PointerEvent): void {
    if (!isDragging || !resizerElement || !resizerElement.parentElement) return;

    const parentRect = resizerElement.parentElement.getBoundingClientRect();
    if (parentRect.width <= 0) return;

    const pointerOffset = event.clientX - parentRect.left;
    let newRatio = (pointerOffset / parentRect.width) * 100;

    // Restringir dentro de los límites seguros
    newRatio = Math.max(min, Math.min(max, newRatio));

    if (onResize) {
      onResize(Math.round(newRatio * 10) / 10);
    }
  }

  /**
   * Finaliza el arrastre y restaura los estilos globales.
   */
  function handlePointerUp(): void {
    if (!isDragging) return;

    isDragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);
  }

  /**
   * Restablece la proporción al 50/50 mediante doble clic.
   */
  function handleDoubleClick(): void {
    if (onReset) {
      onReset();
    } else if (onResize) {
      onResize(50);
    }
  }

  /**
   * Soporte de accesibilidad por teclado.
   */
  function handleKeyDown(event: KeyboardEvent): void {
    let delta = 0;
    if (event.key === 'ArrowLeft') delta = -2;
    else if (event.key === 'ArrowRight') delta = 2;
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleDoubleClick();
      return;
    }

    if (delta !== 0) {
      event.preventDefault();
      const updated = Math.max(min, Math.min(max, splitRatio + delta));
      if (onResize) onResize(Math.round(updated));
    }
  }

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={resizerElement}
  class="resizer-gutter"
  class:active={isDragging}
  role="separator"
  aria-orientation="vertical"
  aria-valuenow={Math.round(splitRatio)}
  aria-valuemin={min}
  aria-valuemax={max}
  tabindex="0"
  onpointerdown={handlePointerDown}
  ondblclick={handleDoubleClick}
  onkeydown={handleKeyDown}
  title="Arrastra para redimensionar o haz doble clic para 50/50"
>
  <div class="resizer-handle">
    <div class="resizer-dots"></div>
  </div>
</div>

<style>
  .resizer-gutter {
    position: relative;
    width: 9px;
    margin: 0 -4px;
    z-index: 10;
    cursor: col-resize;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: transparent;
    transition: background-color 0.15s ease;
    outline: none;
    flex-shrink: 0;
  }

  /* Línea divisoria central */
  .resizer-gutter::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 4px;
    width: 1px;
    background-color: var(--reading-border, #e8e4da);
    transition: background-color 0.15s ease, width 0.15s ease;
  }

  .resizer-gutter:hover::before,
  .resizer-gutter.active::before,
  .resizer-gutter:focus-visible::before {
    background-color: var(--reading-accent, #c27d38);
    width: 2px;
    left: 3.5px;
  }

  /* Pastilla de agarre táctil */
  .resizer-handle {
    position: relative;
    width: 6px;
    height: 36px;
    border-radius: 9999px;
    background-color: var(--reading-border, #e8e4da);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.6;
    transition: opacity 0.15s ease, background-color 0.15s ease, transform 0.15s ease;
    pointer-events: none;
  }

  .resizer-gutter:hover .resizer-handle,
  .resizer-gutter.active .resizer-handle {
    opacity: 1;
    background-color: var(--reading-accent, #c27d38);
    transform: scaleY(1.15);
  }

  .resizer-dots {
    width: 2px;
    height: 12px;
    border-radius: 1px;
    background-color: rgba(255, 255, 255, 0.7);
  }
</style>
