import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveNavigationTarget, buildServiceWorkerScript } from '../src/features/pwa/swTemplate.ts';
import { computeContentHash, readPrecacheContent } from '../scripts/vitePwaPlugin.ts';

describe('PWA Service Worker logic & script generation', () => {
  it('resolveNavigationTarget maps routes correctly', () => {
    // ES: Entrada a /app/ o subrutas
    // EN: App entrance or subroutes
    assert.equal(resolveNavigationTarget('/app'), '/app/index.html');
    assert.equal(resolveNavigationTarget('/app/'), '/app/index.html');
    assert.equal(resolveNavigationTarget('/app/index.html'), '/app/index.html');
    assert.equal(resolveNavigationTarget('/app/settings'), '/app/index.html');

    // ES: Entrada a /es/
    // EN: Spanish landing entrance
    assert.equal(resolveNavigationTarget('/es'), '/es/index.html');
    assert.equal(resolveNavigationTarget('/es/'), '/es/index.html');
    assert.equal(resolveNavigationTarget('/es/index.html'), '/es/index.html');

    // ES: Entrada a la raíz /
    // EN: Root landing entrance
    assert.equal(resolveNavigationTarget(''), '/index.html');
    assert.equal(resolveNavigationTarget('/'), '/index.html');
    assert.equal(resolveNavigationTarget('/index.html'), '/index.html');

    // ES: Rutas no reconocidas
    // EN: Unrecognized routes
    assert.equal(resolveNavigationTarget('/unknown-path'), null);
    assert.equal(resolveNavigationTarget('/api/vault'), null);
  });

  it('computeContentHash changes when content of fixed-URL assets changes', () => {
    const urls = ['/', '/app/index.html', '/manifest.webmanifest'];

    // Versión 1 de contenido
    const getContentV1 = (url: string) => {
      if (url === '/manifest.webmanifest') return '{"name":"Kallos Markdown"}';
      return '<html>v1</html>';
    };

    // Versión 2 de contenido (URL idéntica, pero contenido modificado)
    const getContentV2 = (url: string) => {
      if (url === '/manifest.webmanifest') return '{"name":"Kallos Markdown v2"}';
      return '<html>v1</html>';
    };

    const hash1 = computeContentHash(urls, getContentV1);
    const hash2 = computeContentHash(urls, getContentV2);

    assert.notEqual(hash1, hash2, 'Hash must change when fixed-URL content changes');
  });

  it('computeContentHash includes entry HTML even when the bundle does not contain it', () => {
    const root = mkdtempSync(join(tmpdir(), 'kallosmd-pwa-'));
    const publicDir = join(root, 'public');

    try {
      mkdirSync(join(root, 'es'), { recursive: true });
      mkdirSync(join(root, 'app'), { recursive: true });
      mkdirSync(publicDir, { recursive: true });
      writeFileSync(join(root, 'index.html'), '<html>main v1</html>');
      writeFileSync(join(root, 'es', 'index.html'), '<html>es v1</html>');
      writeFileSync(join(root, 'app', 'index.html'), '<html>app v1</html>');

      const urls = ['/index.html', '/es/index.html', '/app/index.html'];
      const getContent = (url: string) => readPrecacheContent(url, {}, publicDir, root);

      assert.ok(getContent('/index.html'), 'Main entry HTML must be readable from source');
      assert.ok(getContent('/es/index.html'), 'Spanish entry HTML must be readable from source');
      assert.ok(getContent('/app/index.html'), 'App entry HTML must be readable from source');

      const hash1 = computeContentHash(urls, getContent);
      writeFileSync(join(root, 'app', 'index.html'), '<html>app v2</html>');
      const hash2 = computeContentHash(urls, getContent);

      assert.notEqual(hash1, hash2, 'Changing only an entry HTML file must change the cache version');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('buildServiceWorkerScript creates compliant, isolated and secure script', () => {
    const version = 'test-hash-123';
    const urls = ['/', '/app/', '/assets/app.js', '/assets/katex.js'];
    const script = buildServiceWorkerScript(version, urls);

    // ES: Comprobar versión de caché con prefijo aislado y conjunto PRECACHE_SET
    // EN: Verify cache version with isolated prefix and PRECACHE_SET
    assert.ok(script.includes('const CACHE_NAME = "kallosmd-test-hash-123";'));
    assert.ok(script.includes('const PRECACHE_SET = new Set(PRECACHE_URLS);'));
    assert.ok(script.includes('/assets/katex.js'));

    // ES: Comprobar instalación atómica
    // EN: Verify atomic installation
    assert.ok(script.includes('cache.addAll(PRECACHE_URLS)'));

    // ES: Comprobar purgado exclusivo de kallosmd- en activación
    // EN: Verify exclusive kallosmd- cache purge in activation
    assert.ok(script.includes("key.startsWith('kallosmd-') && key !== CACHE_NAME"));

    // ES: Con pestañas abiertas se conservan temporalmente, pero la purga queda pendiente y se ejecuta
    //     cuando la nueva versión ya controla la única ventana restante.
    // EN: With tabs open they are kept temporarily, but cleanup stays pending and runs once the new
    //     version controls the only remaining window.
    assert.ok(script.includes('deleteObsoleteCaches'));
    assert.ok(script.includes('obsoleteCacheCleanupPending'));
    assert.ok(script.includes('pruneObsoleteCachesWhenSafe'));
    assert.ok(script.includes("event.data.type === 'CLEAN_OLD_CACHES'"));
    const activateIndex = script.indexOf("self.addEventListener('activate'");
    const zeroClientsIndex = script.indexOf('openClients.length === 0');
    assert.ok(
      activateIndex > -1 && zeroClientsIndex > activateIndex,
      'Activation must delete obsolete caches when no app client remains',
    );

    // ES: Comprobar que NO admite respuestas privadas ni URLs ajenas a PRECACHE_SET
    // EN: Verify it does NOT allow caching private responses or URLs outside PRECACHE_SET
    assert.ok(script.includes('!PRECACHE_SET.has(url.pathname)'));

    // ES: El filtro público debe ejecutarse antes de abrir o leer la caché versionada
    // EN: The public allowlist must run before opening or reading the versioned cache
    const filterIndex = script.indexOf('!PRECACHE_SET.has(url.pathname)');
    const versionedMatchIndex = script.indexOf('cache.match(url.pathname)');
    assert.ok(filterIndex > -1 && versionedMatchIndex > filterIndex, 'PRECACHE_SET must gate every cache read');
    assert.ok(!script.includes('caches.match('), 'Reads must be scoped to the versioned cache');

    // ES: Comprobar que en navegación sirve el HTML precacheado sin sobrescribir la caché con la red
    // EN: Verify navigation serves precached HTML without overwriting cache with network
    assert.ok(script.includes('cache.match(targetHtml)'));
    assert.ok(!script.includes('cache.put(targetHtml'));

    // ES: Una entrada ausente nunca debe sustituirse por otra página de entrada
    // EN: A missing entry must never be replaced by another entry page
    assert.ok(!script.includes('rootCached'));
    assert.ok(!script.includes("cache.match('/app/index.html')"));
    assert.ok(script.includes("cache.match('/404.html')"));

    // ES: Comprobar que no devuelve HTML para assets faltantes
    // EN: Verify it never returns HTML for missing assets
    assert.ok(script.includes("headers: { 'Content-Type': 'text/plain; charset=utf-8' }"));

    // ES: Comprobar que las respuestas 200 se validan contra el tipo solicitado y nunca se guarda HTML como JS/CSS/fuente
    // EN: Verify 200 responses are validated against the requested type and HTML is never stored as JS/CSS/font
    assert.ok(script.includes('isAcceptableAssetResponse'));
    assert.ok(script.includes('isAcceptablePrecacheResponse'));
    assert.ok(script.includes("destination === 'script'"));
    assert.ok(script.includes("destination === 'style'"));
    assert.ok(script.includes("destination === 'font'"));
    assert.ok(script.includes("contentType.includes('text/html')"));
    assert.ok(script.includes('cache.delete(url.pathname)'));
    assert.ok(script.includes('!isAcceptableAssetResponse(request, networkResponse)'));
    assert.ok(script.includes('!isAcceptablePrecacheResponse(requiredPath, cached)'));
    assert.ok(script.includes('caches.delete(CACHE_NAME)'));

    // ES: Comprobar soporte de SKIP_WAITING explícito, bloqueado si quedan otras pestañas
    // EN: Verify explicit SKIP_WAITING support, blocked while other tabs remain
    assert.ok(script.includes("event.data.type === 'SKIP_WAITING'"));
    assert.ok(script.includes('self.skipWaiting()'));
    assert.ok(script.includes('countOtherOpenClients'));
    assert.ok(script.includes("event.data.type === 'CHECK_UPDATE_SAFETY'"));
    assert.ok(script.includes('countOtherOpenClients()) === 0'));

    // ES: Comprobar verificación exhaustiva de cada recurso y de la versión activa
    // EN: Verify exhaustive checking of every resource and the active version
    assert.ok(script.includes("event.data.type === 'CHECK_CACHE_STATUS'"));
    assert.ok(script.includes('for (const requiredPath of PRECACHE_URLS)'));
    assert.ok(script.includes('missing.push(requiredPath)'));
    assert.ok(!script.includes('Math.min(10'));
  });
});
