import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pwaStore } from '../src/features/pwa/pwaStore.svelte.ts';
import { documentStore } from '../src/features/vault/vaultStore.svelte.ts';

interface DraftOverrides {
  unsaved?: boolean;
  pending?: boolean | (() => boolean);
  flush?: () => Promise<boolean>;
}

// ES: Instala un worker de actualización ficticio que responde a CHECK_UPDATE_SAFETY.
// EN: Installs a fake update worker that replies to CHECK_UPDATE_SAFETY.
function installUpdateWorker(otherClients = 0): { worker: ServiceWorker; messages: unknown[] } {
  const messages: unknown[] = [];
  const worker = {
    postMessage(message: { type: string }, ports?: MessagePort[]) {
      if (message.type === 'CHECK_UPDATE_SAFETY' && ports?.[0]) {
        ports[0].postMessage({ type: 'UPDATE_SAFETY_RESULT', otherClients });
      } else {
        messages.push(message);
      }
    },
  } as unknown as ServiceWorker;

  return { worker, messages };
}

function installWindow(onAlert?: (message: string) => void, confirm = true): () => void {
  const original = globalThis.window;
  globalThis.window = {
    confirm: () => confirm,
    alert: (message: string) => onAlert?.(message),
  } as unknown as Window & typeof globalThis;

  return () => {
    globalThis.window = original;
  };
}

// ES: Sustituye el estado de borrador del store por uno controlado por la prueba.
// EN: Replaces the store draft state with one controlled by the test.
function overrideDraft(overrides: DraftOverrides): () => void {
  const originalRevision = documentStore.revision;

  Object.defineProperty(documentStore, 'hasUnsavedChanges', {
    value: overrides.unsaved ?? false,
    configurable: true,
  });

  if (typeof overrides.pending === 'function') {
    Object.defineProperty(documentStore.persistence, 'hasPendingWrites', {
      get: overrides.pending,
      configurable: true,
    });
  } else {
    Object.defineProperty(documentStore.persistence, 'hasPendingWrites', {
      value: overrides.pending ?? false,
      configurable: true,
    });
  }

  Object.defineProperty(documentStore, 'flushPendingSave', {
    value: overrides.flush ?? (async () => true),
    configurable: true,
  });

  return () => {
    delete (documentStore as unknown as Record<string, unknown>).hasUnsavedChanges;
    delete (documentStore as unknown as Record<string, unknown>).flushPendingSave;
    delete (documentStore.persistence as unknown as Record<string, unknown>).hasPendingWrites;
    documentStore.revision = originalRevision;
  };
}

function useWaitingWorker(worker: ServiceWorker): void {
  pwaStore.setStateForTesting({ updateAvailable: true });
  (pwaStore as unknown as { waitingWorker: ServiceWorker }).waitingWorker = worker;
}

describe('PWA update lifecycle & draft protection', () => {
  beforeEach(() => {
    pwaStore.resetForTesting();
  });

  it('detects update available without forcing auto-reload', () => {
    pwaStore.setStateForTesting({ status: 'ready', updateAvailable: true });
    assert.equal(pwaStore.updateAvailable, true);
    assert.equal(pwaStore.offlineReady, true);
  });

  it('applyUpdate sends SKIP_WAITING to waiting worker and sets tab initiator', async () => {
    const { worker, messages } = installUpdateWorker();
    useWaitingWorker(worker);

    await pwaStore.applyUpdate();

    assert.deepEqual(messages, [{ type: 'SKIP_WAITING' }]);
  });

  it('applyUpdate persists a pending draft before sending SKIP_WAITING', async () => {
    const { worker, messages } = installUpdateWorker();
    const restoreWindow = installWindow(() => {
      throw new Error('The update must not warn when the draft was persisted');
    });
    let flushCalled = false;
    const restoreDraft = overrideDraft({
      unsaved: true,
      pending: false,
      flush: async () => {
        flushCalled = true;
        return true;
      },
    });

    try {
      useWaitingWorker(worker);
      await pwaStore.applyUpdate();

      assert.equal(flushCalled, true, 'The pending draft must be flushed before activation');
      assert.deepEqual(messages, [{ type: 'SKIP_WAITING' }]);
    } finally {
      restoreDraft();
      restoreWindow();
    }
  });

  it('applyUpdate cancels activation when the pending draft cannot be persisted', async () => {
    const { worker, messages } = installUpdateWorker();
    const alerts: string[] = [];
    const restoreWindow = installWindow((message) => alerts.push(message));
    const restoreDraft = overrideDraft({
      unsaved: true,
      pending: true,
      flush: async () => false,
    });

    try {
      useWaitingWorker(worker);
      await pwaStore.applyUpdate();

      assert.equal(alerts.length, 1, 'The user must be told that the draft could not be saved');
      assert.equal(messages.length, 0, 'SKIP_WAITING must not be sent if the draft was not persisted');
    } finally {
      restoreDraft();
      restoreWindow();
    }
  });

  it('applyUpdate waits for a pending draft write before sending SKIP_WAITING', async () => {
    const { worker, messages } = installUpdateWorker();
    const restoreWindow = installWindow();
    let releaseFlush!: (persisted: boolean) => void;
    let markFlushStarted!: () => void;
    const flushStarted = new Promise<void>((resolve) => {
      markFlushStarted = resolve;
    });
    const pending = { value: true };
    const restoreDraft = overrideDraft({
      unsaved: false,
      pending: () => pending.value,
      flush: () => {
        markFlushStarted();
        return new Promise<boolean>((resolve) => {
          releaseFlush = resolve;
        });
      },
    });

    try {
      useWaitingWorker(worker);
      const updating = pwaStore.applyUpdate();
      await flushStarted;

      assert.equal(messages.length, 0, 'SKIP_WAITING must not be sent while the write is pending');

      pending.value = false;
      releaseFlush(true);
      await updating;

      assert.deepEqual(messages, [{ type: 'SKIP_WAITING' }]);
    } finally {
      restoreDraft();
      restoreWindow();
    }
  });

  it('applyUpdate cancels activation when an edit happens during the flush', async () => {
    const { worker, messages } = installUpdateWorker();
    const alerts: string[] = [];
    const restoreWindow = installWindow((message) => alerts.push(message));
    const restoreDraft = overrideDraft({
      unsaved: true,
      pending: false,
      flush: async () => {
        documentStore.revision += 1;
        return true;
      },
    });

    try {
      useWaitingWorker(worker);
      await pwaStore.applyUpdate();

      assert.equal(alerts.length, 1, 'A concurrent edit must cancel the update');
      assert.equal(messages.length, 0, 'SKIP_WAITING must not be sent if revision changed during the flush');
    } finally {
      restoreDraft();
      restoreWindow();
    }
  });

  it('applyUpdate refuses activation while another window is still open', async () => {
    const { worker, messages } = installUpdateWorker(1);
    const alerts: string[] = [];
    const restoreWindow = installWindow((message) => alerts.push(message));
    const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

    try {
      Object.defineProperty(globalThis, 'navigator', {
        value: { serviceWorker: {} },
        configurable: true,
        writable: true,
      });

      useWaitingWorker(worker);
      await pwaStore.applyUpdate();

      assert.equal(alerts.length, 1, 'The user must be told to close the other tabs');
      assert.equal(messages.length, 0, 'SKIP_WAITING must not be sent while another tab is open');
    } finally {
      restoreWindow();
      if (originalNavigatorDesc) {
        Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
      }
    }
  });

  it('controllerchange does not reload if another tab initiated update and unsaved changes exist', () => {
    const originalWindow = globalThis.window;
    const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const originalRevision = documentStore.revision;
    let reloadCalled = false;
    let controllerChangeHandler: (() => void) | null = null;

    try {
      globalThis.window = {
        location: {
          reload: () => {
            reloadCalled = true;
          },
        },
        caches: {
          keys: async () => [],
        },
        addEventListener: () => {},
      } as unknown as Window & typeof globalThis;

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          serviceWorker: {
            controller: {},
            addEventListener: (event: string, handler: () => void) => {
              if (event === 'controllerchange') {
                controllerChangeHandler = handler;
              }
            },
          },
        },
        configurable: true,
        writable: true,
      });

      pwaStore.init();

      Object.defineProperty(documentStore, 'hasUnsavedChanges', {
        value: true,
        configurable: true,
      });

      assert.ok(controllerChangeHandler, 'controllerchange listener must be registered');
      controllerChangeHandler!();

      assert.equal(reloadCalled, false, 'Must NOT reload current tab if another tab triggered update and unsaved changes exist');
      assert.equal(pwaStore.updateAvailable, true, 'Must flag updateAvailable so user can apply it when ready');
    } finally {
      delete (documentStore as unknown as Record<string, unknown>).hasUnsavedChanges;
      documentStore.revision = originalRevision;
      globalThis.window = originalWindow;
      if (originalNavigatorDesc) {
        Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
      }
    }
  });

  it('applyUpdate respects user cancellation when unsaved changes exist', async () => {
    const { worker, messages } = installUpdateWorker();
    const restoreWindow = installWindow(undefined, false);
    const restoreDraft = overrideDraft({ unsaved: true, pending: false });

    try {
      useWaitingWorker(worker);
      await pwaStore.applyUpdate();

      assert.equal(messages.length, 0, 'Should not post SKIP_WAITING if user cancels');
    } finally {
      restoreDraft();
      restoreWindow();
    }
  });
});
