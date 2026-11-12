import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pwaStore } from '../src/features/pwa/pwaStore.svelte.ts';
import { installActiveWorker, installCachesWindow } from './pwaStoreTestHelpers.ts';

describe('PwaStore reactive state & lifecycle', () => {
  beforeEach(() => {
    pwaStore.resetForTesting();
  });

  it('initial state is idle and not offline-ready', () => {
    assert.equal(pwaStore.status, 'idle');
    assert.equal(pwaStore.offlineReady, false);
    assert.equal(pwaStore.updateAvailable, false);
  });

  it('only reports offline-ready when status is strictly ready', () => {
    pwaStore.setStateForTesting({ status: 'installing' });
    assert.equal(pwaStore.offlineReady, false);

    pwaStore.setStateForTesting({ status: 'error' });
    assert.equal(pwaStore.offlineReady, false);

    pwaStore.setStateForTesting({ status: 'unsupported' });
    assert.equal(pwaStore.offlineReady, false);

    pwaStore.setStateForTesting({ status: 'ready' });
    assert.equal(pwaStore.offlineReady, true);
  });

  it('verifyCacheIntegrity rejects empty caches', async () => {
    const originalWindow = globalThis.window;
    try {
      // Caso 1: Sin caches en window
      globalThis.window = {} as unknown as Window & typeof globalThis;
      let isReady = await pwaStore.verifyCacheIntegrity();
      assert.equal(isReady, false, 'Should be false when caches not in window');

      // Caso 2: caches.keys() vacío
      globalThis.window = {
        caches: {
          keys: async () => [],
          open: async () => ({} as Cache),
        },
      } as unknown as Window & typeof globalThis;
      isReady = await pwaStore.verifyCacheIntegrity();
      assert.equal(isReady, false, 'Should be false when no kallosmd caches exist');
    } finally {
      globalThis.window = originalWindow;
    }
  });

  it('verifyCacheIntegrity rejects a complete cache when there is no active worker', async () => {
    const originalWindow = globalThis.window;
    const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    try {
      const version = 'abc123';
      const urls = ['/pwa-manifest.json', '/app/index.html', '/es/index.html', '/manifest.webmanifest', '/assets/app.js'];

      globalThis.window = {
        caches: {
          keys: async () => [`kallosmd-${version}`],
          open: async () => ({
            match: async (path: string) =>
              path === '/pwa-manifest.json'
                ? { status: 200, json: async () => ({ version, urls }) }
                : { status: 200 },
          }),
        },
      } as unknown as Window & typeof globalThis;

      Object.defineProperty(globalThis, 'navigator', {
        value: { serviceWorker: { controller: null } },
        configurable: true,
        writable: true,
      });

      const isReady = await pwaStore.verifyCacheIntegrity();
      assert.equal(isReady, false, 'A cache alone cannot guarantee offline interception without an active worker');
    } finally {
      globalThis.window = originalWindow;
      if (originalNavigatorDesc) {
        Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
      }
    }
  });

  it('verifyCacheIntegrity rejects a partial worker report with only ten entries', async () => {
    const restoreWorker = installActiveWorker({ ready: false, count: 10, total: 50, missing: ['/assets/large.js'] });
    const restoreWindow = installCachesWindow();
    try {
      const isReady = await pwaStore.verifyCacheIntegrity();
      assert.equal(isReady, false, 'A partial cache with ten entries must not be reported as ready');
    } finally {
      restoreWorker();
      restoreWindow();
    }
  });

  it('verifyCacheIntegrity rejects a worker report whose active version is empty', async () => {
    const restoreWorker = installActiveWorker({
      ready: true,
      version: '',
      count: 5,
      total: 5,
      missing: [],
    });
    const restoreWindow = installCachesWindow();
    try {
      const isReady = await pwaStore.verifyCacheIntegrity();
      assert.equal(isReady, false, 'The active version must be identified before reporting readiness');
    } finally {
      restoreWorker();
      restoreWindow();
    }
  });

  it('verifyCacheIntegrity rejects a worker report missing any required resource', async () => {
    const restoreWorker = installActiveWorker({
      ready: false,
      count: 4,
      total: 5,
      missing: ['/es/index.html'],
    });
    const restoreWindow = installCachesWindow();
    try {
      const isReady = await pwaStore.verifyCacheIntegrity();
      assert.equal(isReady, false, 'Every resource from the active version manifest must be present');
    } finally {
      restoreWorker();
      restoreWindow();
    }
  });

  it('verifyCacheIntegrity accepts an exhaustive worker report for the active version', async () => {
    const restoreWorker = installActiveWorker({ ready: true, count: 5, total: 5, missing: [] });
    const restoreWindow = installCachesWindow();
    try {
      const isReady = await pwaStore.verifyCacheIntegrity();
      assert.equal(isReady, true, 'An exhaustive audit from the active worker must be reported as ready');
    } finally {
      restoreWorker();
      restoreWindow();
    }
  });

  it('requests obsolete cache cleanup from the active worker when ready', async () => {
    const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const restoreWindow = installCachesWindow();
    const messages: Array<{ type: string }> = [];
    const registration = {
      waiting: null,
      installing: null,
      active: null,
      addEventListener: () => {},
    } as unknown as ServiceWorkerRegistration;
    const controller = {
      postMessage(message: { type: string }, ports?: MessagePort[]) {
        if (message.type === 'CHECK_CACHE_STATUS' && ports?.[0]) {
          ports[0].postMessage({
            type: 'CACHE_STATUS_RESULT',
            ready: true,
            version: 'abc123',
            count: 5,
            total: 5,
            missing: [],
          });
        } else {
          messages.push(message);
        }
      },
    } as unknown as ServiceWorker;

    try {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          serviceWorker: {
            controller,
            ready: Promise.resolve(registration),
          },
        },
        configurable: true,
        writable: true,
      });

      pwaStore.handleRegistration(registration);
      await new Promise((resolve) => setTimeout(resolve, 100));

      assert.equal(pwaStore.status, 'ready', 'A verified worker must mark the app ready');
      assert.ok(
        messages.some((message) => message.type === 'CLEAN_OLD_CACHES'),
        'The store must request stale cache cleanup once the new version is ready',
      );
    } finally {
      restoreWindow();
      if (originalNavigatorDesc) {
        Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
      }
    }
  });

  it('checkReadiness updates status to ready only after an active worker audit passes', async () => {
    const restoreWindow = installCachesWindow();
    const restorePartial = installActiveWorker({
      ready: false,
      count: 2,
      total: 5,
      missing: ['/es/index.html'],
    });

    try {
      pwaStore.status = 'idle';
      await pwaStore.checkReadiness();
      assert.notEqual(pwaStore.status, 'ready', 'Status must not be ready with an incomplete cache');

      restorePartial();
      const restoreReady = installActiveWorker({ ready: true, count: 5, total: 5, missing: [] });
      try {
        await pwaStore.checkReadiness();
        assert.equal(pwaStore.status, 'ready', 'Status must be ready after an exhaustive worker audit');
      } finally {
        restoreReady();
      }
    } finally {
      restoreWindow();
    }
  });
});
