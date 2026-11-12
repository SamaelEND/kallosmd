/**
 * ES: Tipos y contratos para el soporte de Progressive Web App (PWA) y funcionamiento offline.
 * EN: Types and contracts for Progressive Web App (PWA) and offline capabilities.
 */

// ES: Estados posibles de la preparación y ciclo de vida de la PWA.
// EN: Possible states of PWA preparation and lifecycle.
export type PwaStatus =
  | 'unsupported' // ES: Navegador sin soporte o entorno local no PWA / EN: Browser lacks support or local non-PWA environment
  | 'idle'        // ES: Esperando inicialización / EN: Waiting for initialization
  | 'installing'  // ES: Descargando y almacenando recursos en caché / EN: Downloading and precaching assets
  | 'ready'       // ES: Recursos completos verificados y listos sin conexión / EN: Complete assets verified and ready offline
  | 'error';      // ES: Fallo al instalar o almacenar recursos / EN: Failed to install or precache assets

// ES: Mensajes intercambiados entre la aplicación y el Service Worker.
// EN: Messages exchanged between the application and the Service Worker.
export type SwInboundMessage =
  | { type: 'SKIP_WAITING' }
  | { type: 'CHECK_CACHE_STATUS' }
  | { type: 'CHECK_UPDATE_SAFETY' }
  | { type: 'CLEAN_OLD_CACHES' };

// ES: Resultado de la auditoría física de la caché de la versión activa.
// EN: Result of the physical audit of the active version cache.
export interface SwCacheStatusResult {
  type: 'CACHE_STATUS_RESULT';
  ready: boolean;
  version: string;
  count: number;
  total: number;
  missing: string[];
}

export interface SwUpdateSafetyResult {
  type: 'UPDATE_SAFETY_RESULT';
  otherClients: number;
}

export type SwOutboundMessage = SwCacheStatusResult | SwUpdateSafetyResult;

// ES: Manifiesto público emitido en build con la versión activa y todos sus recursos requeridos.
// EN: Public manifest emitted at build time with the active version and every required resource.
export interface PwaBuildManifest {
  version: string;
  urls: string[];
}

// ES: Configuración y estado observable del store de PWA.
// EN: Configuration and observable state for the PWA store.
export interface PwaStateSnapshot {
  status: PwaStatus;
  updateAvailable: boolean;
  offlineReady: boolean;
}
