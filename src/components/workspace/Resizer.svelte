<script lang="ts">
  /**
   * Componente Resizer para MD Studio.
   * Permite redimensionar paneles contiguos mediante arrastre suave
   * y restablecer al 50/50 con doble clic.
   */
  import { onDestroy } from "svelte";

  interface Props {
    splitRatio: number;
    min?: number;
    max?: number;
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

  function handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;

    event.preventDefault();
    isDragging = true;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!isDragging || !resizerElement || !resizerElement.parentElement) return;

    const parentRect = resizerElement.parentElement.getBoundingClientRect();
    if (parentRect.width <= 0) return;

    const pointerOffset = event.clientX - parentRect.left;
    let newRatio = (pointerOffset / parentRect.width) * 100;

    newRatio = Math.max(min, Math.min(max, newRatio));

    onResize?.(Math.round(newRatio * 10) / 10);
  }

  function handlePointerUp(): void {
    if (!isDragging) return;

    isDragging = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerUp);
  }

  function handleDoubleClick(): void {
    if (onReset) {
      onReset();
    } else {
      onResize?.(50);
    }
  }

  function handleKeyDown(event: KeyboardEvent): void {
    let delta = 0;
    if (event.key === "ArrowLeft") delta = -2;
    else if (event.key === "ArrowRight") delta = 2;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleDoubleClick();
      return;
    }

    if (delta !== 0) {
      event.preventDefault();
      const updated = Math.max(min, Math.min(max, splitRatio + delta));
      onResize?.(Math.round(updated));
    }
  }

  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={resizerElement}
  class="resizer-gutter no-print"
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

  .resizer-gutter::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 4px;
    width: 1px;
    background-color: var(--reading-border, #e8e4da);
    transition:
      background-color 0.15s ease,
      width 0.15s ease;
  }

  .resizer-gutter:hover::before,
  .resizer-gutter.active::before,
  .resizer-gutter:focus-visible::before {
    background-color: var(--reading-accent, #c27d38);
    width: 2px;
    left: 3.5px;
  }

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
    transition:
      opacity 0.15s ease,
      background-color 0.15s ease,
      transform 0.15s ease;
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
