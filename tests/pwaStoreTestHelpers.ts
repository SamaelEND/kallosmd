// ES: Utilidades compartidas por las pruebas del store PWA.
// EN: Shared utilities for PWA store tests.

export interface WorkerStatusOverrides {
  ready?: boolean;
  version?: string;
  count?: number;
  total?: number;
  missing?: string[];
}

// ES: Instala un worker ficticio que responde a CHECK_CACHE_STATUS con el informe indicado.
// EN: Installs a fake worker that replies to CHECK_CACHE_STATUS with the provided report.
export function installActiveWorker(overrides: WorkerStatusOverrides): () => void {
  const worker = {
    postMessage(message: { type: string }, ports?: MessagePort[]) {
      if (message.type !== 'CHECK_CACHE_STATUS' || !ports?.[0]) return;
      ports[0].postMessage({
        type: 'CACHE_STATUS_RESULT',
        ready: true,
        version: 'abc123',
        count: 5,
        total: 5,
        missing: [],
        ...overrides,
      });
    },
  } as unknown as ServiceWorker;

  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    value: { serviceWorker: { controller: worker } },
    configurable: true,
    writable: true,
  });

  return () => {
    if (original) {
      Object.defineProperty(globalThis, 'navigator', original);
    }
  };
}

export function installCachesWindow(): () => void {
  const originalWindow = globalThis.window;
  globalThis.window = {
    caches: {},
  } as unknown as Window & typeof globalThis;

  return () => {
    globalThis.window = originalWindow;
  };
}
