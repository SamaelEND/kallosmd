/**
 * ES: Pruebas unitarias para la selección de vista inicial, persistencia y breakpoint responsivo.
 * EN: Unit tests for initial view mode selection, persistence, and responsive breakpoint.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  SettingsStore,
  VIEW_MODE_BREAKPOINT,
} from "../src/features/settings/settingsStore.svelte.ts";
import { STORAGE_KEYS } from "../src/core/markdown/defaultDocument.ts";
import { executePdfPrint } from "../src/features/preview/export/pdfExportPresets.ts";
import type { ViewMode } from "../src/core/types/index.ts";

type WindowHost = typeof globalThis & {
  window?: unknown;
  document?: unknown;
  localStorage?: unknown;
};

interface MockWindowOptions {
  width: number;
  storedItems?: Record<string, string>;
  storageError?: boolean;
}

function setupMockEnvironment(options: MockWindowOptions) {
  const host = globalThis as WindowHost;
  const originalWindow = host.window;
  const originalDocument = host.document;
  const originalLocalStorage = host.localStorage;

  const storageMap = new Map<string, string>(
    Object.entries(options.storedItems || {}),
  );

  const mockLocalStorage = {
    getItem: (key: string): string | null => {
      if (options.storageError) throw new Error("Storage quota exceeded or disabled");
      return storageMap.has(key) ? storageMap.get(key)! : null;
    },
    setItem: (key: string, value: string): void => {
      if (options.storageError) throw new Error("Storage quota exceeded or disabled");
      storageMap.set(key, value);
    },
    removeItem: (key: string): void => {
      if (options.storageError) throw new Error("Storage quota exceeded or disabled");
      storageMap.delete(key);
    },
    clear: (): void => {
      if (options.storageError) throw new Error("Storage quota exceeded or disabled");
      storageMap.clear();
    },
  };

  let currentWidth = options.width;
  const mediaQueryListeners: Set<(e: { matches: boolean }) => void> = new Set();
  const resizeListeners: Set<() => void> = new Set();

  const mockWindow = {
    get innerWidth() {
      return currentWidth;
    },
    matchMedia: (query: string) => {
      const isMaxWidth = query.includes(`max-width: ${VIEW_MODE_BREAKPOINT}px`);
      const matches = isMaxWidth ? currentWidth <= VIEW_MODE_BREAKPOINT : false;
      return {
        matches,
        media: query,
        addEventListener: (_event: string, listener: (e: { matches: boolean }) => void) => {
          mediaQueryListeners.add(listener);
        },
        removeEventListener: (_event: string, listener: (e: { matches: boolean }) => void) => {
          mediaQueryListeners.delete(listener);
        },
        addListener: (listener: (e: { matches: boolean }) => void) => {
          mediaQueryListeners.add(listener);
        },
        removeListener: (listener: (e: { matches: boolean }) => void) => {
          mediaQueryListeners.delete(listener);
        },
      };
    },
    addEventListener: (event: string, listener: () => void) => {
      if (event === "resize") resizeListeners.add(listener);
    },
    removeEventListener: (event: string, listener: () => void) => {
      if (event === "resize") resizeListeners.delete(listener);
    },
    localStorage: mockLocalStorage,
    print: () => {},
  };

  const mockDocument = {
    title: "",
    documentElement: {
      getAttribute: () => "dark",
      setAttribute: () => {},
      classList: {
        contains: () => true,
        add: () => {},
        remove: () => {},
      },
      offsetHeight: 0,
    },
  };

  host.window = mockWindow;
  host.document = mockDocument;
  host.localStorage = mockLocalStorage;

  return {
    storageMap,
    setInnerWidth: (newWidth: number) => {
      currentWidth = newWidth;
      const matches = currentWidth <= VIEW_MODE_BREAKPOINT;
      for (const listener of mediaQueryListeners) {
        listener({ matches });
      }
      for (const listener of resizeListeners) {
        listener();
      }
    },
    restore: () => {
      if (originalWindow === undefined) delete host.window;
      else host.window = originalWindow;

      if (originalDocument === undefined) delete host.document;
      else host.document = originalDocument;

      if (originalLocalStorage === undefined) delete host.localStorage;
      else host.localStorage = originalLocalStorage;
    },
  };
}

test("initial clean start without preference in wide viewport (>640px) uses Split and does not persist", () => {
  const env = setupMockEnvironment({ width: 1024 });
  try {
    const store = new SettingsStore();
    assert.equal(store.settings.viewMode, "split");
    assert.equal(store.hasExplicitViewMode, false);
    assert.equal(env.storageMap.has(STORAGE_KEYS.VIEW_MODE), false);
    store.destroy();
  } finally {
    env.restore();
  }
});

test("initial clean start without preference in small viewport (<=640px) uses Live and does not persist", () => {
  const env = setupMockEnvironment({ width: 480 });
  try {
    const store = new SettingsStore();
    assert.equal(store.settings.viewMode, "live");
    assert.equal(store.hasExplicitViewMode, false);
    assert.equal(env.storageMap.has(STORAGE_KEYS.VIEW_MODE), false);
    store.destroy();
  } finally {
    env.restore();
  }
});

test("crossing viewport breakpoint in automatic mode switches between Split and Live without persisting", () => {
  const env = setupMockEnvironment({ width: 1024 });
  try {
    const store = new SettingsStore();
    assert.equal(store.settings.viewMode, "split");
    assert.equal(store.hasExplicitViewMode, false);

    // ES: Cambiar a pantalla pequeña <= 640px / EN: Switch to small screen <= 640px
    env.setInnerWidth(500);
    assert.equal(store.settings.viewMode, "live");
    assert.equal(store.hasExplicitViewMode, false);
    assert.equal(env.storageMap.has(STORAGE_KEYS.VIEW_MODE), false);

    // ES: Regresar a pantalla amplia > 640px / EN: Return to wide screen > 640px
    env.setInnerWidth(1280);
    assert.equal(store.settings.viewMode, "split");
    assert.equal(store.hasExplicitViewMode, false);
    assert.equal(env.storageMap.has(STORAGE_KEYS.VIEW_MODE), false);

    store.destroy();
  } finally {
    env.restore();
  }
});

test("updating unrelated settings in automatic mode does not write automatic view mode to localStorage", () => {
  const env = setupMockEnvironment({ width: 1024 });
  try {
    const store = new SettingsStore();
    assert.equal(store.settings.viewMode, "split");
    assert.equal(store.hasExplicitViewMode, false);

    // ES: Cambiar tema y fuente / EN: Change theme and font size
    store.toggleTheme();
    store.setFontSize("large");

    // ES: Se persisten el tema y la fuente, pero NO la vista / EN: Theme and font are persisted, but NOT viewMode
    assert.equal(env.storageMap.get(STORAGE_KEYS.THEME), "light");
    assert.equal(env.storageMap.get(STORAGE_KEYS.FONT_SIZE), "large");
    assert.equal(env.storageMap.has(STORAGE_KEYS.VIEW_MODE), false);
    assert.equal(store.hasExplicitViewMode, false);

    store.destroy();
  } finally {
    env.restore();
  }
});

test("explicit view mode choice (live, editor, split, preview) persists and survives crossing breakpoint", () => {
  const viewModes: ViewMode[] = ["live", "editor", "split", "preview"];

  for (const chosenMode of viewModes) {
    const env = setupMockEnvironment({ width: 1024 });
    try {
      const store = new SettingsStore();
      assert.equal(store.hasExplicitViewMode, false);

      // ES: Elección explícita del usuario / EN: Explicit user choice
      store.setViewMode(chosenMode);
      assert.equal(store.settings.viewMode, chosenMode);
      assert.equal(store.hasExplicitViewMode, true);
      assert.equal(env.storageMap.get(STORAGE_KEYS.VIEW_MODE), chosenMode);

      // ES: Redimensionar a pantalla pequeña / EN: Resize to small screen
      env.setInnerWidth(400);
      assert.equal(store.settings.viewMode, chosenMode, `Explicit mode ${chosenMode} must survive resize to small`);
      assert.equal(env.storageMap.get(STORAGE_KEYS.VIEW_MODE), chosenMode);

      // ES: Redimensionar a pantalla amplia / EN: Resize to wide screen
      env.setInnerWidth(1200);
      assert.equal(store.settings.viewMode, chosenMode, `Explicit mode ${chosenMode} must survive resize to wide`);
      assert.equal(env.storageMap.get(STORAGE_KEYS.VIEW_MODE), chosenMode);

      store.destroy();
    } finally {
      env.restore();
    }
  }
});

test("reloading with explicit saved preference respects the preference regardless of viewport width", () => {
  const env = setupMockEnvironment({
    width: 480, // Pantalla estrecha
    storedItems: {
      [STORAGE_KEYS.VIEW_MODE]: "split",
    },
  });
  try {
    const store = new SettingsStore();
    // ES: A pesar de estar en pantalla estrecha, la preferencia explícita 'split' prevalece
    // EN: Despite being on a small screen, the explicit preference 'split' prevails
    assert.equal(store.settings.viewMode, "split");
    assert.equal(store.hasExplicitViewMode, true);

    // ES: Redimensionar no altera la preferencia / EN: Resizing does not alter preference
    env.setInnerWidth(1024);
    assert.equal(store.settings.viewMode, "split");

    store.destroy();
  } finally {
    env.restore();
  }
});

test("corrupted or invalid stored viewMode falls back to automatic mode without breaking or persisting invalid value", () => {
  const invalidValues = ["invalid_mode", "", "123", "undefined", "null", "false"];

  for (const badValue of invalidValues) {
    const env = setupMockEnvironment({
      width: 1024,
      storedItems: {
        [STORAGE_KEYS.VIEW_MODE]: badValue,
      },
    });
    try {
      const store = new SettingsStore();
      // ES: Debe usar el modo automático (split para 1024px) y no considerar el valor explícito
      // EN: Must use automatic mode (split for 1024px) and not consider the value explicit
      assert.equal(store.settings.viewMode, "split");
      assert.equal(store.hasExplicitViewMode, false);

      // ES: Cambiar otro ajuste no debe guardar el valor automático
      // EN: Changing another setting must not persist automatic mode
      store.toggleTheme();
      assert.equal(env.storageMap.get(STORAGE_KEYS.VIEW_MODE), badValue); // Se mantiene intacto sin sobrescribir

      store.destroy();
    } finally {
      env.restore();
    }
  }
});

test("unavailable or throwing localStorage does not break initialization or viewport switching", () => {
  const env = setupMockEnvironment({
    width: 1024,
    storageError: true,
  });
  try {
    const store = new SettingsStore();
    assert.equal(store.settings.viewMode, "split");
    assert.equal(store.hasExplicitViewMode, false);

    // ES: Cruzar breakpoint sin fallar / EN: Cross breakpoint without throwing
    env.setInnerWidth(500);
    assert.equal(store.settings.viewMode, "live");

    // ES: Intentar guardar no lanza excepción al usuario / EN: Attempting to save does not throw to caller
    store.setViewMode("editor");
    assert.equal(store.settings.viewMode, "editor");
    assert.equal(store.hasExplicitViewMode, true);

    store.destroy();
  } finally {
    env.restore();
  }
});

test("temporary view change during PDF export does not create an explicit preference", async () => {
  // ES: Inicio estrecho sin preferencia -> Live automático
  // EN: Narrow viewport start without preference -> automatic Live
  const env = setupMockEnvironment({ width: 480 });
  try {
    const store = new SettingsStore();
    assert.equal(store.settings.viewMode, "live");
    assert.equal(store.hasExplicitViewMode, false);
    assert.equal(env.storageMap.has(STORAGE_KEYS.VIEW_MODE), false);

    let printCalled = false;
    (globalThis as WindowHost & { window: { print: () => void } }).window.print = () => {
      printCalled = true;
      // ES: Durante la impresión, la vista temporal debe ser preview
      // EN: During print, temporary view must be preview
      assert.equal(store.settings.viewMode, "preview");
      assert.equal(store.hasExplicitViewMode, false);
      assert.equal(env.storageMap.has(STORAGE_KEYS.VIEW_MODE), false);
    };

    // ES: Flujo de exportación PDF usando setViewMode con isExplicit = false
    // EN: PDF export flow using setViewMode with isExplicit = false
    await executePdfPrint({
      docTitle: "Documento de prueba",
      currentViewMode: store.settings.viewMode,
      setViewMode: (mode) => store.setViewMode(mode, false),
    });

    assert.equal(printCalled, true);
    // ES: Al terminar la exportación, la vista vuelve a live sin fijar preferencia
    // EN: Upon export completion, view returns to live without setting preference
    assert.equal(store.settings.viewMode, "live");
    assert.equal(store.hasExplicitViewMode, false);
    assert.equal(env.storageMap.has(STORAGE_KEYS.VIEW_MODE), false);

    // ES: Redimensionar a pantalla amplia -> resultado Split, sin clave guardada
    // EN: Resize to wide viewport -> result Split, without saved key
    env.setInnerWidth(1024);
    assert.equal(store.settings.viewMode, "split");
    assert.equal(store.hasExplicitViewMode, false);
    assert.equal(env.storageMap.has(STORAGE_KEYS.VIEW_MODE), false);

    store.destroy();
  } finally {
    env.restore();
  }
});

test("temporary view change during HTML export does not create an explicit preference", () => {
  // ES: Inicio estrecho sin preferencia -> Live automático
  // EN: Narrow viewport start without preference -> automatic Live
  const env = setupMockEnvironment({ width: 480 });
  try {
    const store = new SettingsStore();
    assert.equal(store.settings.viewMode, "live");
    assert.equal(store.hasExplicitViewMode, false);
    assert.equal(env.storageMap.has(STORAGE_KEYS.VIEW_MODE), false);

    // ES: Flujo de exportación HTML en App.svelte
    // EN: HTML export flow in App.svelte
    const previousMode = store.settings.viewMode;
    store.setViewMode("preview", false);
    assert.equal(store.settings.viewMode, "preview");
    assert.equal(store.hasExplicitViewMode, false);
    assert.equal(env.storageMap.has(STORAGE_KEYS.VIEW_MODE), false);

    // ES: Restaurar vista previa tras exportar
    // EN: Restore previous view after export
    store.setViewMode(previousMode, false);
    assert.equal(store.settings.viewMode, "live");
    assert.equal(store.hasExplicitViewMode, false);
    assert.equal(env.storageMap.has(STORAGE_KEYS.VIEW_MODE), false);

    // ES: Redimensionar a pantalla amplia -> resultado Split, sin clave guardada
    // EN: Resize to wide viewport -> result Split, without saved key
    env.setInnerWidth(1280);
    assert.equal(store.settings.viewMode, "split");
    assert.equal(store.hasExplicitViewMode, false);
    assert.equal(env.storageMap.has(STORAGE_KEYS.VIEW_MODE), false);

    store.destroy();
  } finally {
    env.restore();
  }
});

test("selecting Split mode on narrow screens keeps both editor and preview accessible without hiding preview", () => {
  // ES: Inicio en pantalla estrecha (<= 640px)
  // EN: Start on narrow screen (<= 640px)
  const env = setupMockEnvironment({ width: 480 });
  try {
    const store = new SettingsStore();
    assert.equal(store.settings.viewMode, "live");

    // ES: El usuario elige explícitamente Split en pantalla estrecha
    // EN: User explicitly selects Split on narrow screen
    store.setViewMode("split");
    assert.equal(store.settings.viewMode, "split");
    assert.equal(store.hasExplicitViewMode, true);
    assert.equal(env.storageMap.get(STORAGE_KEYS.VIEW_MODE), "split");

    // ES: Verificar que el diseño responsive de App.svelte no oculta preview-pane con display: none
    // EN: Verify responsive design in App.svelte does not hide preview-pane with display: none
    const appSveltePath = path.resolve(process.cwd(), "src/App.svelte");
    const appSvelteContent = fs.readFileSync(appSveltePath, "utf-8");

    // ES: Verificar que NO contiene display: none para preview-pane en mode-split
    // EN: Verify it does NOT contain display: none for preview-pane in mode-split
    assert.doesNotMatch(
      appSvelteContent,
      /\.workspace-container\.mode-split\s+\.preview-pane\s*\{[^}]*display:\s*none/i,
      "preview-pane must not be hidden with display: none in mode-split on small screens",
    );

    // ES: Verificar que configura flex-direction: column y display: flex para ambos paneles
    // EN: Verify that flex-direction: column and display: flex are configured for both panes
    assert.match(
      appSvelteContent,
      /\.workspace-container\.mode-split\s*\{[^}]*flex-direction:\s*column/i,
      "mode-split must stack vertically in column direction on small screens",
    );
    assert.match(
      appSvelteContent,
      /\.workspace-container\.mode-split\s+\.preview-pane\s*\{[^}]*display:\s*flex/i,
      "preview-pane must remain visible with display: flex on small screens",
    );

    // ES: Verificar que el separador lateral se oculta correctamente usando .resizer-gutter
    // EN: Verify that lateral resizer is properly hidden using .resizer-gutter
    assert.match(
      appSvelteContent,
      /:global\(\.resizer-gutter\)\s*\{[^}]*display:\s*none\s*!important/i,
      "App.svelte must hide .resizer-gutter in small screen media query",
    );
    assert.doesNotMatch(
      appSvelteContent,
      /:global\(\.resizer-divider\)/i,
      "App.svelte must not reference obsolete .resizer-divider class",
    );

    const resizerPath = path.resolve(process.cwd(), "src/features/workspace/Resizer.svelte");
    const resizerContent = fs.readFileSync(resizerPath, "utf-8");
    assert.match(
      resizerContent,
      /\.resizer-gutter\s*\{[^}]*display:\s*none\s*!important/i,
      "Resizer.svelte must hide .resizer-gutter on small screens",
    );

    // ES: Verificar que la preferencia se mantiene en cualquier tamaño de pantalla
    // EN: Verify that preference is maintained at any screen size
    env.setInnerWidth(1024);
    assert.equal(store.settings.viewMode, "split");
    assert.equal(store.hasExplicitViewMode, true);

    env.setInnerWidth(360);
    assert.equal(store.settings.viewMode, "split");
    assert.equal(store.hasExplicitViewMode, true);

    store.destroy();
  } finally {
    env.restore();
  }
});
