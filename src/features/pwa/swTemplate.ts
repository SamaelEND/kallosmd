/**
 * ES: Generador y utilidades de enrutamiento para el Service Worker de Kallos Markdown.
 * EN: Generator and routing utilities for the Kallos Markdown Service Worker.
 */

/**
 * ES: Resuelve el destino HTML correspondiente a una ruta de navegación del cliente.
 * EN: Resolves the matching HTML target for a client navigation route.
 */
export function resolveNavigationTarget(pathname: string): string | null {
  // ES: Normalizar eliminando trailing slash a menos que sea la raíz
  // EN: Normalize by stripping trailing slash unless it is root
  const clean = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  if (clean === '/app' || clean.startsWith('/app/')) {
    return '/app/index.html';
  }
  if (clean === '/es' || clean.startsWith('/es/')) {
    return '/es/index.html';
  }
  if (clean === '' || clean === '/' || clean === '/index.html') {
    return '/index.html';
  }
  return null;
}

/**
 * ES: Genera el script en JavaScript ejecutable del Service Worker con los assets inyectados.
 * EN: Generates the executable JavaScript Service Worker script with injected assets.
 */
export function buildServiceWorkerScript(cacheVersion: string, precacheUrls: string[]): string {
  const jsonUrls = JSON.stringify(precacheUrls, null, 2);
  const cacheName = `kallosmd-${cacheVersion}`;

  return `/**
 * ES: Service Worker nativo para Kallos Markdown. Almacena recursos estáticos y garantiza reapertura offline.
 * EN: Native Service Worker for Kallos Markdown. Caches static assets and guarantees offline reopening.
 */

const CACHE_VERSION = ${JSON.stringify(cacheVersion)};
const CACHE_NAME = ${JSON.stringify(cacheName)};
const PRECACHE_URLS = ${jsonUrls};
const PRECACHE_SET = new Set(PRECACHE_URLS);

// ES: Marca si quedaron cachés obsoletas pendientes de purgar tras una activación con ventanas abiertas.
// EN: Flags whether obsolete caches remain pending purge after an activation with open windows.
let obsoleteCacheCleanupPending = false;

// ES: Instalación atómica: todos los recursos precacheados deben resolverse con el tipo correcto o la instalación falla.
// EN: Atomic installation: all precached assets must resolve with the correct type or installation fails.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        await cache.addAll(PRECACHE_URLS);

        // ES: Verificar que ninguna URL haya recibido un fallback HTML con estado 200 (p. ej. JS inexistente).
        // EN: Verify no URL received an HTML fallback with status 200 (e.g. missing JS).
        for (const requiredPath of PRECACHE_URLS) {
          const cached = await cache.match(requiredPath);
          if (!isAcceptablePrecacheResponse(requiredPath, cached)) {
            throw new Error('Invalid precached response: ' + requiredPath);
          }
        }
      } catch (error) {
        // ES: No dejar una caché parcial ni corrupta si la instalación no es válida.
        // EN: Do not leave a partial or corrupted cache when installation is invalid.
        await caches.delete(CACHE_NAME);
        throw error;
      }
    })()
  );
});

// ES: Activación: si no quedan ventanas abiertas, elimina las cachés anteriores de inmediato. Si queda
//     alguna, las conserva temporalmente para no romper sus chunks diferidos y marca una purga pendiente.
// EN: Activation: if no windows remain, removes older caches immediately. If any remains, keeps them
//     temporarily to avoid breaking their deferred chunks and marks a pending purge.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const openClients = await getOpenAppClients();
      if (openClients.length === 0) {
        await deleteObsoleteCaches();
      } else {
        obsoleteCacheCleanupPending = true;
      }
    })()
  );
});

function resolveNavigationTarget(pathname) {
  const clean = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (clean === '/app' || clean.startsWith('/app/')) {
    return '/app/index.html';
  }
  if (clean === '/es' || clean.startsWith('/es/')) {
    return '/es/index.html';
  }
  if (clean === '' || clean === '/' || clean === '/index.html') {
    return '/index.html';
  }
  return null;
}

function assetNotFoundResponse() {
  return new Response('Asset not found or offline', {
    status: 404,
    statusText: 'Not Found',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

// ES: Comprueba que la respuesta corresponde al tipo de recurso solicitado. Evita guardar o servir HTML
//     (por ejemplo, una página de fallback del servidor) como si fuera JS, CSS o una fuente.
// EN: Verifies that the response matches the requested resource type. Prevents storing or serving HTML
//     (for example, a server fallback page) as if it were JS, CSS, or a font.
function isAcceptableAssetResponse(request, response) {
  if (!response || response.status !== 200) return false;

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const pathname = new URL(request.url).pathname.toLowerCase();
  const destination = request.destination;

  const isScript = destination === 'script' || destination === 'worker' || /\\.m?js$/.test(pathname);
  if (isScript) return /(?:javascript|ecmascript)/.test(contentType);

  const isStyle = destination === 'style' || /\\.css$/.test(pathname);
  if (isStyle) return contentType.includes('text/css');

  const isFont = destination === 'font' || /\\.(?:woff2?|ttf|otf|eot)$/.test(pathname);
  if (isFont) return /(?:font|application\\/octet-stream)/.test(contentType);

  return !contentType.includes('text/html');
}

// ES: Valida una respuesta de precarga según su URL: los documentos deben ser HTML y los assets su tipo real.
// EN: Validates a precache response by URL: documents must be HTML and assets must match their real type.
function isAcceptablePrecacheResponse(url, response) {
  if (!response || response.status !== 200) return false;

  const absoluteUrl = new URL(url, self.location.origin).toString();
  const pathname = new URL(absoluteUrl).pathname.toLowerCase();
  const contentType = (response.headers.get('content-type') || '').toLowerCase();

  const isDocument = /\\.html$/.test(pathname) || pathname === '/' || pathname.endsWith('/');
  if (isDocument) {
    return contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
  }

  return isAcceptableAssetResponse({ url: absoluteUrl, destination: '' }, response);
}

// ES: Obtiene las ventanas de la aplicación que pueden depender de chunks versionados.
// EN: Gets the application windows that may depend on versioned chunks.
async function getOpenAppClients() {
  const openClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return openClients.filter((client) => {
    try {
      return new URL(client.url).pathname.startsWith('/app');
    } catch (_) {
      return false;
    }
  });
}

// ES: Cuenta las demás ventanas de la app; una actualización solo es segura cuando queda una sola.
// EN: Counts other app windows; an update is only safe when a single window remains.
async function countOtherOpenClients() {
  const openClients = await getOpenAppClients();
  return Math.max(0, openClients.length - 1);
}

// ES: Elimina todas las cachés de versiones anteriores, sin tocar la versión activa ni datos de usuario.
// EN: Deletes every cache from previous versions, without touching the active version or user data.
async function deleteObsoleteCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith('kallosmd-') && key !== CACHE_NAME)
      .map((key) => caches.delete(key))
  );
  obsoleteCacheCleanupPending = false;
}

// ES: Purga las cachés obsoletas solo cuando la nueva versión ya controla la única ventana de la app.
// EN: Purges obsolete caches only once the new version controls the only remaining app window.
async function pruneObsoleteCachesWhenSafe() {
  const openClients = await getOpenAppClients();
  if (openClients.length > 1) {
    obsoleteCacheCleanupPending = true;
    return;
  }
  await deleteObsoleteCaches();
}

// ES: Intercepción de peticiones estáticas y navegación.
// EN: Interception of static assets and navigation.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // ES: Limitar la caché estrictamente al mismo origen y esquemas http(s) públicos.
  // EN: Strictly limit cache to same origin and public http(s) schemes.
  if (url.origin !== self.location.origin) return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // ES: Aprovechar cualquier petición de la nueva versión para purgar cachés antiguas pendientes.
  // EN: Use any request from the new version to purge pending obsolete caches.
  if (obsoleteCacheCleanupPending) {
    event.waitUntil(pruneObsoleteCachesWhenSafe());
  }

  // ES: Peticiones de navegación: servir el HTML inmutable de la versión activa.
  // EN: Navigation requests: serve immutable HTML corresponding to the active version.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const targetHtml = resolveNavigationTarget(url.pathname);

        if (targetHtml) {
          // ES: Servir siempre el HTML precacheado de la versión para evitar que la red sobrescriba con HTML de otra versión
          // EN: Always serve the precached version HTML to prevent network from overwriting with incompatible versions
          if (PRECACHE_SET.has(targetHtml)) {
            const cached = await cache.match(targetHtml);
            if (cached) return cached;
          }

          try {
            const networkResponse = await fetch(request);
            if (networkResponse && networkResponse.status === 200) {
              return networkResponse;
            }
          } catch (_) {}
        }

        // ES: Si falta la entrada solicitada, devolver la página 404 con estado 404; nunca otra entrada.
        // EN: If the requested entry is missing, return the 404 page with status 404; never another entry.
        if (PRECACHE_SET.has('/404.html')) {
          const notFound = await cache.match('/404.html');
          if (notFound) {
            return new Response(notFound.body, {
              status: 404,
              statusText: 'Not Found',
              headers: notFound.headers,
            });
          }
        }
        return new Response('Not Found', {
          status: 404,
          statusText: 'Not Found',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })()
    );
    return;
  }

  // ES: Peticiones de recursos (scripts, estilos, fuentes, imágenes).
  // EN: Resource requests (scripts, styles, fonts, images).
  event.respondWith(
    (async () => {
      // ES: Seguridad: el filtro público precede a cualquier lectura de caché. Las rutas ajenas no se leen ni se guardan.
      // EN: Security: the public allowlist precedes every cache read. Foreign paths are neither read nor stored.
      if (!PRECACHE_SET.has(url.pathname)) {
        try {
          return await fetch(request);
        } catch (_) {
          return assetNotFoundResponse();
        }
      }

      // ES: Cache First limitado a la caché de esta versión, con normalización de pathname.
      // EN: Cache First scoped to this version's cache, with pathname normalization.
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(url.pathname);
      if (cached) {
        // ES: Una entrada corrupta con tipo incorrecto (p. ej. HTML guardado como JS) se descarta y se reintenta.
        // EN: A corrupted entry with the wrong type (e.g. HTML stored as JS) is discarded and retried.
        if (isAcceptableAssetResponse(request, cached)) return cached;
        await cache.delete(url.pathname);
      }

      // ES: Solo si pertenece a los assets públicos previstos y faltaba, descargar y almacenar.
      // EN: Only if it belongs to expected public assets and was missing, fetch and cache.
      try {
        const networkResponse = await fetch(request);

        // ES: Rechazar cualquier respuesta 200 que no corresponda al tipo solicitado (scripts, estilos, fuentes).
        //     Nunca se guarda ni se sirve HTML como si fuera un asset.
        // EN: Reject any 200 response that does not match the requested type (scripts, styles, fonts).
        //     HTML is never stored or served as if it were an asset.
        if (!isAcceptableAssetResponse(request, networkResponse)) {
          return assetNotFoundResponse();
        }

        await cache.put(url.pathname, networkResponse.clone());
        return networkResponse;
      } catch (_) {
        // ES: NUNCA devolver HTML para un recurso ausente (evita SyntaxError en JS/CSS).
        // EN: NEVER return HTML for a missing asset (prevents SyntaxError in JS/CSS).
        return assetNotFoundResponse();
      }
    })()
  );
});

// ES: Mensajes de control: aplicación segura de actualización e inspección exhaustiva de caché.
// EN: Control messages: safe update application and exhaustive cache inspection.
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    event.waitUntil(
      (async () => {
        // ES: No tomar el control de otras pestañas: podrían seguir usando chunks de la versión anterior.
        // EN: Do not take over other tabs: they may still need chunks from the previous version.
        if ((await countOtherOpenClients()) === 0) {
          await self.skipWaiting();
        }
      })()
    );
  } else if (event.data.type === 'CHECK_UPDATE_SAFETY') {
    event.waitUntil(
      (async () => {
        const otherClients = await countOtherOpenClients();
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ type: 'UPDATE_SAFETY_RESULT', otherClients });
        }
      })()
    );
  } else if (event.data.type === 'CLEAN_OLD_CACHES') {
    event.waitUntil(pruneObsoleteCachesWhenSafe());
  } else if (event.data.type === 'CHECK_CACHE_STATUS') {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const missing = [];

        // ES: Cada recurso requerido por la versión activa debe existir con respuesta 200.
        // EN: Every resource required by the active version must exist with a 200 response.
        for (const requiredPath of PRECACHE_URLS) {
          const matched = await cache.match(requiredPath);
          if (!matched || matched.status !== 200) {
            missing.push(requiredPath);
          }
        }

        const keys = await cache.keys();
        const isReady = missing.length === 0;

        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            type: 'CACHE_STATUS_RESULT',
            ready: isReady,
            version: CACHE_VERSION,
            count: keys.length,
            total: PRECACHE_URLS.length,
            missing,
          });
        }
      })()
    );
  }
});
`;
}
