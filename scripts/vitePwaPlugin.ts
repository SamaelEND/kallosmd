/**
 * ES: Plugin de Vite para empaquetar el Service Worker con la lista exhaustiva de activos offline.
 * EN: Vite plugin to package the Service Worker with the exhaustive offline asset manifest.
 */

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';
import { buildServiceWorkerScript } from '../src/features/pwa/swTemplate.ts';

// ES: Recorre un directorio de forma recursiva obteniendo todas las rutas relativas.
// EN: Recursively traverses a directory obtaining all relative paths.
function getFilesRecursively(dir: string, baseDir = dir): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFilesRecursively(fullPath, baseDir));
    } else if (entry.isFile()) {
      if (!entry.name.startsWith('.') && entry.name !== 'CNAME') {
        const rel = relative(baseDir, fullPath).replace(/\\/g, '/');
        files.push('/' + rel);
      }
    }
  }

  return files;
}

/**
 * ES: Calcula un hash SHA-256 determinista incluyendo URL y contenido real de cada recurso.
 * EN: Computes a deterministic SHA-256 hash including both URL and actual content of each asset.
 */
export function computeContentHash(
  urls: string[],
  getContent: (url: string) => Uint8Array | string | null,
): string {
  const hasher = createHash('sha256');
  for (const url of urls) {
    hasher.update(url);
    hasher.update('\0');
    const content = getContent(url);
    if (content !== null) {
      hasher.update(content);
    }
    hasher.update('\n');
  }
  return hasher.digest('hex').slice(0, 12);
}

// ES: Obtiene el contenido de una URL fija desde el bundle, public/ o el HTML fuente. Los HTML de entrada
//     pueden no estar aún en el bundle cuando se ejecuta generateBundle.
// EN: Gets fixed-URL content from the bundle, public/, or source HTML. Entry HTML files may not be in the
//     bundle yet when generateBundle runs.
export function readPrecacheContent(
  url: string,
  bundle: object,
  publicDir: string,
  projectRoot: string,
): Uint8Array | string | null {
  let bundleKey = url.startsWith('/') ? url.slice(1) : url;
  if (url === '/') bundleKey = 'index.html';
  else if (url === '/es/') bundleKey = 'es/index.html';
  else if (url === '/app/') bundleKey = 'app/index.html';

  const bundleItem = (bundle as Record<string, unknown>)[bundleKey] as
    | { type: 'chunk'; code: string }
    | { type: 'asset'; source: string | Uint8Array }
    | undefined;

  if (bundleItem) {
    if (bundleItem.type === 'chunk') return bundleItem.code;
    if (bundleItem.type === 'asset') return bundleItem.source;
  }

  const publicFilePath = join(publicDir, bundleKey);
  try {
    if (statSync(publicFilePath).isFile()) {
      return readFileSync(publicFilePath);
    }
  } catch (_) {}

  const sourceFilePath = join(projectRoot, bundleKey);
  try {
    if (statSync(sourceFilePath).isFile()) {
      return readFileSync(sourceFilePath);
    }
  } catch (_) {}

  return null;
}

export function vitePwaPlugin(): Plugin {
  // ES: Raíz efectiva del proyecto y carpeta pública resueltas por Vite. Evita depender del cwd del proceso,
  //     de modo que un build sobre una copia temporal lea exclusivamente esa copia.
  // EN: Effective project root and public directory resolved by Vite. Avoids relying on the process cwd,
  //     so a build over a temporary copy reads exclusively from that copy.
  let projectRoot = process.cwd();
  let publicDir = resolve(projectRoot, 'public');

  return {
    name: 'kallosmd-vite-pwa-plugin',
    apply: 'build',
    configResolved(config) {
      projectRoot = config.root;
      publicDir = config.publicDir || resolve(config.root, 'public');
    },
    generateBundle: {
      // ES: Ejecutar al final para que Vite ya haya emitido los HTML definitivos en el bundle.
      // EN: Run last so Vite has already emitted the final HTML files into the bundle.
      order: 'post',
      handler(_options, bundle) {
        const urls = new Set<string>();

        // ES: 1. Rutas de navegación principales de la aplicación
        // EN: 1. Core application navigation routes
        urls.add('/');
        urls.add('/index.html');
        urls.add('/es/');
        urls.add('/es/index.html');
        urls.add('/app/');
        urls.add('/app/index.html');

        // ES: 2. Activos emitidos dinámicamente por Vite (chunks, css, fuentes KaTeX)
        // EN: 2. Dynamically emitted assets from Vite (chunks, css, KaTeX fonts)
        for (const [fileName, item] of Object.entries(bundle)) {
          if (fileName === 'sw.js') continue;

          // ES: Ignorar chunks de fachada vacíos que Vite descarta al escribir a disco
          // EN: Ignore empty facade chunks that Vite discards when writing to disk
          if (item.type === 'chunk' && (!item.code || item.code.trim().length === 0 || item.moduleIds.length === 0)) {
            continue;
          }

          urls.add('/' + fileName.replace(/\\/g, '/'));
        }

        // ES: 3. Activos estáticos en la carpeta public
        // EN: 3. Static assets in public folder
        try {
          if (statSync(publicDir).isDirectory()) {
            const publicFiles = getFilesRecursively(publicDir);
            for (const file of publicFiles) {
              urls.add(file);
            }
          }
        } catch (err) {
          console.warn('Advertencia al leer directorio public para PWA:', err);
        }

        // ES: El manifiesto forma parte de la lista de precarga y se authored a sí mismo.
        // EN: The manifest belongs to the precache list and declares itself.
        urls.add('/pwa-manifest.json');

        const sortedUrls = Array.from(urls).sort();

        // ES: Obtener contenido real de cada URL para asegurar que cualquier cambio en recursos fijos invalide la versión
        // EN: Get actual content for each URL to ensure any change to fixed-URL assets invalidates the version
        const getContent = (url: string): Uint8Array | string | null =>
          readPrecacheContent(url, bundle, publicDir, projectRoot);

        const hash = computeContentHash(sortedUrls, getContent);

        // ES: Manifiesto público consultable por la app para auditar la versión activa y todos sus recursos.
        // EN: Public manifest readable by the app to audit the active version and all its required resources.
        this.emitFile({
          type: 'asset',
          fileName: 'pwa-manifest.json',
          source: JSON.stringify({ version: hash, urls: sortedUrls }),
        });

        const swCode = buildServiceWorkerScript(hash, sortedUrls);

        this.emitFile({
          type: 'asset',
          fileName: 'sw.js',
          source: swCode,
        });
      },
    },
  };
}
