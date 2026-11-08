/**
 * ES: Store del diálogo de confirmación propio de la app (reemplaza window.confirm), basado en promesas.
 * EN: Store for the app's own confirmation dialog (replaces window.confirm), promise-based.
 */

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** ES: `danger` pinta la acción en rojo. EN: `danger` paints the action red. */
  tone?: "danger" | "default";
}

class ConfirmStore {
  current = $state<ConfirmOptions | null>(null);
  private resolver: ((value: boolean) => void) | null = null;

  /**
   * ES: Abre el diálogo y resuelve true (aceptar) o false (cancelar/Esc/fondo).
   * EN: Opens the dialog and resolves true (accept) or false (cancel/Esc/backdrop).
   */
  ask(options: ConfirmOptions): Promise<boolean> {
    // ES: Si ya había uno abierto, se cancela antes de abrir el nuevo.
    // EN: If one was already open, cancel it before opening the new one.
    this.resolver?.(false);
    this.current = options;
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  /**
   * ES: Cierra el diálogo con el resultado indicado.
   * EN: Closes the dialog with the given result.
   */
  settle(value: boolean): void {
    const resolve = this.resolver;
    this.resolver = null;
    this.current = null;
    resolve?.(value);
  }
}

export const confirmStore = new ConfirmStore();
