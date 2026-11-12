/**
 * ES: Store reactivo para la gestión del Service Worker, estado offline y ciclo de vida de la PWA.
 * EN: Reactive store managing Service Worker registration, offline readiness, and PWA lifecycle.
 */

import { i18n } from '../../shared/i18n/i18n.svelte';
import { documentStore } from '../vault/vaultStore.svelte';
import type {
  PwaStatus,
  PwaStateSnapshot,
  SwCacheStatusResult,
  SwInboundMessage,
  SwUpdateSafetyResult,
} from './types';

export class PwaStore {
  status = $state<PwaStatus>('idle');
  updateAvailable = $state<boolean>(false);

  // ES: Indicador reactivo derivado que confirma si la app está 100% lista para operar sin internet.
  // EN: Derived reactive indicator confirming whether the app is 100% ready for offline use.
  offlineReady = $derived<boolean>(this.status === 'ready');

  private registration: ServiceWorkerRegistration | null = null;
  private waitingWorker: ServiceWorker | null = null;
  private isRefreshing = false;
  private initialized = false;
  private updateInitiatedByTab = false;

  get snapshot(): PwaStateSnapshot {
    return {
      status: this.status,
      updateAvailable: this.updateAvailable,
      offlineReady: this.offlineReady,
    };
  }

  /**
   * ES: Inicializa el registro del Service Worker respetando el modo de ejecución (evita falsos positivos en DEV).
   * EN: Initializes Service Worker registration respecting runtime mode (avoids false positives in DEV).
   */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (typeof window === 'undefined') {
      this.status = 'unsupported';
      return;
    }

    // ES: En desarrollo local (Vite HMR), desactivar PWA para evitar falsos positivos y problemas de caché.
    // EN: In local development (Vite HMR), disable PWA to prevent false positives and cache interference.
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      this.status = 'unsupported';
      return;
    }

    if (!('serviceWorker' in navigator) || !('caches' in window)) {
      this.status = 'unsupported';
      return;
    }

    // ES: No marcar "ready" a ciegas: verificar exhaustivamente la caché
    // EN: Do not mark "ready" blindly: verify cache integrity exhaustively
    this.status = 'installing';
    void this.checkReadiness();

    const registerSw = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        this.handleRegistration(reg);
      } catch (err) {
        console.error('ES: Error al registrar Service Worker / EN: Failed to register Service Worker:', err);
        this.status = 'error';
      }
    };

    if (typeof document !== 'undefined' && document.readyState === 'complete') {
      void registerSw();
    } else {
      window.addEventListener('load', () => void registerSw(), { once: true });
    }

    // ES: Listener de cambio de controlador (actualización de versión)
    // EN: Controller change listener (version update)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (this.isRefreshing) return;

      if (this.updateInitiatedByTab) {
        // ES: Esta pestaña solicitó explícitamente la actualización: recargar de inmediato.
        // EN: This tab explicitly requested the update: reload immediately.
        this.isRefreshing = true;
        window.location.reload();
        return;
      }

      // ES: Si otra pestaña activó la actualización, NUNCA recargar esta sesión si hay cambios sin guardar.
      // EN: If another tab triggered the update, NEVER reload this session if unsaved changes exist.
      this.updateAvailable = true;
      this.requestObsoleteCacheCleanup();
      if (documentStore.hasUnsavedChanges) {
        console.warn(
          'ES: Versión actualizada en otra pestaña; conservando sesión actual con cambios pendientes. / EN: Version updated in another tab; keeping current session with unsaved changes.',
        );
      }
    });
  }

  /**
   * ES: Procesa los estados de instalación y actualización de un registro de Service Worker.
   * EN: Handles installation and update lifecycle states for a Service Worker registration.
   */
  handleRegistration(reg: ServiceWorkerRegistration): void {
    this.registration = reg;

    // ES: Si hay una versión esperando, activar el aviso de actualización disponible.
    // EN: If a version is waiting, activate the update available notification.
    if (reg.waiting) {
      this.waitingWorker = reg.waiting;
      this.updateAvailable = true;
    }

    // ES: Monitorear el worker que se está instalando actualmente.
    // EN: Monitor worker currently undergoing installation.
    if (reg.installing) {
      this.trackInstallingWorker(reg.installing);
    }

    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      this.trackInstallingWorker(newWorker);
    });

    // ES: Confirmar preparación verificando la caché real cuando el Service Worker pase a activo.
    // EN: Confirm readiness by verifying actual cache when the Service Worker becomes active.
    if (navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready
        .then(async () => {
          await this.checkReadiness();
          this.requestObsoleteCacheCleanup();
        })
        .catch(() => {
          this.status = 'error';
        });
    }
  }

  /**
   * ES: Envía un mensaje al Service Worker y espera una única respuesta por MessageChannel.
   * EN: Sends a message to the Service Worker and waits for a single MessageChannel response.
   */
  private async requestWorkerMessage<T>(worker: ServiceWorker, message: SwInboundMessage, timeoutMs = 1000): Promise<T | null> {
    if (typeof MessageChannel === 'undefined') return null;

    return new Promise((resolve) => {
      const channel = new MessageChannel();
      let done = false;

      const finish = (result: T | null) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          channel.port1.close();
          channel.port2.close();
        } catch (_) {}
        resolve(result);
      };

      const timer = setTimeout(() => {
        finish(null);
      }, timeoutMs);
      if (typeof (timer as unknown as { unref?: () => void }).unref === 'function') {
        (timer as unknown as { unref: () => void }).unref();
      }

      channel.port1.onmessage = (event) => {
        finish((event.data as T) ?? null);
      };

      try {
        worker.postMessage(message, [channel.port2]);
      } catch (_) {
        finish(null);
      }
    });
  }

  /**
   * ES: Consulta el estado interno de la caché directamente al Service Worker activo.
   * EN: Queries internal cache status directly from the active Service Worker.
   */
  private async queryWorkerCacheStatus(worker: ServiceWorker): Promise<SwCacheStatusResult | null> {
    // ES: La auditoría recorre cientos de entradas y puede tardar más de un segundo al reabrir sin red.
    // EN: The audit checks hundreds of entries and can take over a second on a cold offline start.
    const result = await this.requestWorkerMessage<SwCacheStatusResult>(worker, { type: 'CHECK_CACHE_STATUS' }, 15000);
    return result && result.type === 'CACHE_STATUS_RESULT' ? result : null;
  }

  /**
   * ES: Pregunta al worker cuántas ventanas adicionales siguen abiertas antes de activar una versión nueva.
   * EN: Asks the worker how many additional windows remain open before activating a new version.
   */
  private async countOtherWindowClients(worker: ServiceWorker): Promise<number | null> {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return null;

    const result = await this.requestWorkerMessage<SwUpdateSafetyResult>(worker, { type: 'CHECK_UPDATE_SAFETY' });
    return result && result.type === 'UPDATE_SAFETY_RESULT' && typeof result.otherClients === 'number'
      ? result.otherClients
      : null;
  }

  /**
   * ES: Pide al worker activo que purgue cachés de versiones anteriores cuando ya no haya otras ventanas.
   * EN: Asks the active worker to purge previous-version caches once no other windows remain.
   */
  private requestObsoleteCacheCleanup(): void {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;

    const worker = navigator.serviceWorker.controller || this.registration?.active;
    if (!worker || typeof worker.postMessage !== 'function') return;

    try {
      worker.postMessage({ type: 'CLEAN_OLD_CACHES' });
    } catch (_) {
      // ES: La purga es oportunista; un fallo de mensajería no debe afectar al estado de la app.
      // EN: Cleanup is opportunistic; a messaging failure must not affect app state.
    }
  }

  /**
   * ES: Verifica que exista un worker activo y que audite exhaustivamente la versión activa y sus recursos.
   * EN: Verifies that an active worker exists and exhaustively audits the active version and its resources.
   */
  async verifyCacheIntegrity(): Promise<boolean> {
    if (typeof window === 'undefined' || !('caches' in window)) return false;

    try {
      // ES: Sin worker activo no hay garantía de que una reapertura offline sea interceptada.
      // EN: Without an active worker there is no guarantee that an offline reopening will be intercepted.
      const controller = typeof navigator !== 'undefined' ? navigator.serviceWorker?.controller : null;
      const activeWorker = controller || this.registration?.active;
      if (!activeWorker) return false;

      // ES: El worker activo audita su propia versión y cada recurso requerido.
      // EN: The active worker audits its own version and every required resource.
      const workerReported = await this.queryWorkerCacheStatus(activeWorker);

      // ES: Si existe un worker activo pero no responde, no se puede demostrar la versión activa.
      // EN: If an active worker exists but does not answer, the active version cannot be proven.
      if (workerReported === null) return false;

      return (
        workerReported.ready === true &&
        typeof workerReported.version === 'string' &&
        workerReported.version.length > 0 &&
        workerReported.total > 0 &&
        workerReported.missing.length === 0 &&
        workerReported.count >= workerReported.total
      );
    } catch (_) {
      return false;
    }
  }

  /**
   * ES: Consulta el estado y actualiza el indicador sólo si la integridad fue demostrada.
   * EN: Checks status and updates the indicator only if integrity is demonstrated.
   */
  async checkReadiness(): Promise<void> {
    const isCached = await this.verifyCacheIntegrity();
    if (isCached) {
      this.status = 'ready';
    } else {
      // ES: Si no está lista y no hay error explícito, mantener en installing o error según worker
      // EN: If not ready and no explicit error, keep in installing or error according to worker
      if (this.status !== 'error') {
        const hasWorker = !!(navigator.serviceWorker?.controller || this.registration?.active);
        this.status = hasWorker ? 'error' : 'installing';
      }
    }
  }

  private trackInstallingWorker(worker: ServiceWorker): void {
    worker.addEventListener('statechange', async () => {
      if (worker.state === 'installed') {
        if (navigator.serviceWorker.controller) {
          // ES: Nueva versión descargada lista en espera sin forzar recarga.
          // EN: New version downloaded waiting cleanly without forcing reload.
          this.waitingWorker = worker;
          this.updateAvailable = true;
        } else {
          // ES: Primera instalación completada; verificar integridad de caché antes de marcar lista.
          // EN: Initial installation completed; verify cache integrity before marking ready.
          await this.checkReadiness();
        }
      } else if (worker.state === 'redundant') {
        // ES: Instalación fallida o interrumpida.
        // EN: Installation failed or aborted.
        if (!navigator.serviceWorker.controller) {
          this.status = 'error';
        }
      }
    });
  }

  /**
   * ES: Aplica explícitamente la actualización pendiente, advirtiendo si existen cambios sin guardar.
   * EN: Explicitly applies the pending update, warning if unsaved changes exist.
   */
  async applyUpdate(): Promise<void> {
    const worker = this.waitingWorker || this.registration?.waiting;
    if (!worker) return;

    if (documentStore.hasUnsavedChanges) {
      const promptText = `${i18n.current.pwa.updateUnsavedWarning}\n\n${i18n.current.pwa.updatePrompt}`;
      const confirmed = window.confirm(promptText);
      if (!confirmed) {
        return;
      }
    }

    // ES: No activar mientras otras ventanas sigan usando los recursos de la versión anterior.
    // EN: Do not activate while other windows still use the previous version resources.
    const otherClients = await this.countOtherWindowClients(worker);
    if (otherClients !== null && otherClients > 0) {
      window.alert(i18n.current.pwa.updateOtherTabsWarning);
      return;
    }

    // ES: Antes de activar la nueva versión, persistir el borrador pendiente. La recarga posterior no puede
    //     esperar la escritura asíncrona de beforeunload, así que se confirma aquí o se cancela la actualización.
    // EN: Before activating the new version, persist the pending draft. The subsequent reload cannot await the
    //     asynchronous beforeunload write, so it is confirmed here or the update is cancelled.
    const hasPendingDraft = documentStore.hasUnsavedChanges || documentStore.persistence.hasPendingWrites;
    if (hasPendingDraft) {
      // ES: Si el usuario edita mientras esperamos la escritura, la revisión cambia y no se autoriza la recarga.
      // EN: If the user edits while we await the write, the revision changes and the reload is not authorized.
      const revisionBeforeFlush = documentStore.revision;
      const persisted = await documentStore.flushPendingSave();
      const editedDuringFlush = documentStore.revision !== revisionBeforeFlush;

      if (!persisted || editedDuringFlush || documentStore.persistence.hasPendingWrites) {
        window.alert(i18n.current.pwa.updateSaveFailed);
        return;
      }
    }

    // ES: Marcar que esta pestaña inició voluntariamente la actualización para autorizar el reload en controllerchange.
    // EN: Flag that this tab voluntarily initiated the update to authorize reload in controllerchange.
    this.updateInitiatedByTab = true;
    worker.postMessage({ type: 'SKIP_WAITING' });
  }

  /**
   * ES: Permite simular estados de Service Worker para pruebas unitarias.
   * EN: Allows simulating Service Worker states for unit tests.
   */
  setStateForTesting(updates: Partial<PwaStateSnapshot>): void {
    if (updates.status !== undefined) this.status = updates.status;
    if (updates.updateAvailable !== undefined) this.updateAvailable = updates.updateAvailable;
  }

  resetForTesting(): void {
    this.status = 'idle';
    this.updateAvailable = false;
    this.registration = null;
    this.waitingWorker = null;
    this.isRefreshing = false;
    this.initialized = false;
    this.updateInitiatedByTab = false;
  }
}

export const pwaStore = new PwaStore();
