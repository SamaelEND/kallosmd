import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'vite';

// ES: Copia el proyecto a un directorio temporal y reutiliza node_modules mediante un enlace simbólico.
// EN: Copies the project to a temporary directory and reuses node_modules through a symbolic link.
function copyProject(source: string, destination: string): void {
  const excluded = new Set(['.git', 'dist', 'node_modules']);
  cpSync(source, destination, {
    recursive: true,
    filter: (filePath) => {
      if (filePath === source) return true;
      const topLevel = relative(source, filePath).split(sep)[0];
      return !excluded.has(topLevel);
    },
  });
  symlinkSync(
    resolve(source, 'node_modules'),
    join(destination, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
}

describe('PWA Build integration & precache completeness', () => {
  const rootDir = process.cwd();
  let tempRoot = '';
  let projectCopy = '';
  let buildDir = '';

  // ES: Generar un build propio en una copia temporal para que `npm test` no dependa de un `dist/` previo.
  // EN: Generate a dedicated build in a temporary copy so `npm test` does not depend on a previous `dist/`.
  before(async () => {
    tempRoot = mkdtempSync(join(tmpdir(), 'kallosmd-pwa-build-'));
    projectCopy = join(tempRoot, 'project');
    buildDir = join(tempRoot, 'baseline');
    copyProject(rootDir, projectCopy);

    await build({
      root: projectCopy,
      configFile: resolve(projectCopy, 'vite.config.ts'),
      logLevel: 'silent',
      build: { outDir: buildDir, emptyOutDir: true },
    });
  });

  after(() => {
    if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  });

  it('temporary build emits sw.js with exhaustive precache urls', () => {
    const swPath = resolve(buildDir, 'sw.js');
    assert.ok(existsSync(swPath), 'sw.js must be emitted during the temporary build');
    const swContent = readFileSync(swPath, 'utf-8');

    // ES: Extraer el array PRECACHE_URLS del archivo sw.js generado
    // EN: Extract the PRECACHE_URLS array from the generated sw.js file
    const match = swContent.match(/const PRECACHE_URLS = (\[[\s\S]*?\]);/);
    assert.ok(match, 'sw.js must define PRECACHE_URLS array');

    const urls: string[] = JSON.parse(match[1]);
    assert.ok(Array.isArray(urls), 'PRECACHE_URLS must be an array');
    assert.ok(urls.length > 50, `PRECACHE_URLS should include all assets, found ${urls.length}`);

    // ES: Verificar presencia de entradas críticas
    // EN: Verify presence of critical entry points
    assert.ok(urls.includes('/'), 'precache must include root');
    assert.ok(urls.includes('/app/'), 'precache must include /app/');
    assert.ok(urls.includes('/es/'), 'precache must include /es/');
    assert.ok(urls.includes('/manifest.webmanifest'), 'precache must include manifest');
    assert.ok(urls.includes('/favicon.svg'), 'precache must include favicon');

    // ES: Verificar chunks diferidos de KaTeX y Mermaid
    // EN: Verify deferred KaTeX and Mermaid chunks
    const hasKaTeXChunk = urls.some((u) => u.includes('katex'));
    const hasKaTeXFont = urls.some((u) => u.includes('KaTeX_') && u.endsWith('.woff2'));
    const hasMermaidChunk = urls.some((u) => u.includes('mermaid'));

    assert.ok(hasKaTeXChunk, 'precache must contain KaTeX bundle chunk');
    assert.ok(hasKaTeXFont, 'precache must contain KaTeX woff2 fonts for offline math');
    assert.ok(hasMermaidChunk, 'precache must contain Mermaid deferred chunks for offline diagrams');

    // ES: Verificar que cada archivo referenciado existe en el build temporal
    // EN: Verify each referenced file exists in the temporary build output
    for (const url of urls) {
      if (url === '/' || url === '/es/' || url === '/app/') continue;
      const filePath = resolve(buildDir, url.slice(1));
      assert.ok(existsSync(filePath), `Precached URL must exist in the build output: ${url} (path: ${filePath})`);
    }
  });

  it('temporary build emits pwa-manifest.json with the active version and every required resource', () => {
    const manifestPath = resolve(buildDir, 'pwa-manifest.json');
    assert.ok(existsSync(manifestPath), 'pwa-manifest.json must be emitted during the temporary build');

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      version: string;
      urls: string[];
    };
    assert.equal(typeof manifest.version, 'string');
    assert.ok(manifest.version.length > 0, 'Manifest must declare an active version');
    assert.ok(Array.isArray(manifest.urls), 'Manifest must declare its required URLs');
    assert.ok(manifest.urls.includes('/app/index.html'), 'Manifest must include the app entry');
    assert.ok(manifest.urls.includes('/manifest.webmanifest'), 'Manifest must include the web manifest');
    assert.ok(manifest.urls.length > 50, 'Manifest must include every built asset');

    const swContent = readFileSync(resolve(buildDir, 'sw.js'), 'utf-8');
    assert.ok(
      swContent.includes(`const CACHE_NAME = "kallosmd-${manifest.version}";`),
      'Service worker cache version must match the public manifest version',
    );
    assert.ok(/["']\/pwa-manifest\.json["']/.test(swContent), 'The manifest itself must be precached');
  });

  it('changes the sw.js version when only an entry HTML changes between two builds', async () => {
    // ES: La prueba reutiliza la copia temporal creada en `before`; el HTML del workspace no se modifica.
    // EN: The test reuses the temporary copy created in `before`; the workspace HTML is never modified.
    const workspaceHtmlPath = resolve(rootDir, 'app/index.html');
    const workspaceHtmlBefore = readFileSync(workspaceHtmlPath, 'utf-8');
    const changedOut = join(tempRoot, 'changed');

    const readVersion = (outDir: string): string => {
      const swContent = readFileSync(resolve(outDir, 'sw.js'), 'utf-8');
      const match = swContent.match(/const CACHE_NAME = "kallosmd-([^"]+)";/);
      assert.ok(match, 'sw.js must declare a cache version');
      return match[1];
    };

    const firstVersion = readVersion(buildDir);

    const copiedHtmlPath = resolve(projectCopy, 'app/index.html');
    const copiedHtml = readFileSync(copiedHtmlPath, 'utf-8');
    writeFileSync(copiedHtmlPath, `${copiedHtml}\n<!-- pwa-version-integration-probe -->\n`);

    await build({
      root: projectCopy,
      configFile: resolve(projectCopy, 'vite.config.ts'),
      logLevel: 'silent',
      build: { outDir: changedOut, emptyOutDir: true },
    });
    const secondVersion = readVersion(changedOut);

    assert.notEqual(
      secondVersion,
      firstVersion,
      'Changing only an entry HTML must change the Service Worker version',
    );
    assert.equal(
      readFileSync(workspaceHtmlPath, 'utf-8'),
      workspaceHtmlBefore,
      'The test must not modify the workspace app/index.html',
    );
  });
});
