import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('PWA Manifest & HTML configuration', () => {
  const rootDir = process.cwd();
  const manifestPath = resolve(rootDir, 'public/manifest.webmanifest');

  it('manifest is valid JSON with Kallos Markdown branding and offline configuration', () => {
    assert.ok(existsSync(manifestPath), 'manifest.webmanifest must exist in public/');
    const raw = readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(raw);

    assert.equal(manifest.name, 'Kallos Markdown');
    assert.equal(manifest.short_name, 'Kallos MD');
    assert.equal(manifest.id, '/app/');
    assert.equal(manifest.start_url, '/app/');
    assert.equal(manifest.scope, '/');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.background_color, '#151617');
    assert.equal(manifest.theme_color, '#151617');
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 4);

    for (const icon of manifest.icons) {
      assert.ok(icon.src.startsWith('/'), `icon src must be absolute: ${icon.src}`);
      const iconDiskPath = resolve(rootDir, 'public', icon.src.slice(1));
      assert.ok(existsSync(iconDiskPath), `Icon file must exist: ${icon.src}`);
    }
  });

  it('all HTML entry points link manifest and define worker-src in CSP', () => {
    const entryPoints = ['index.html', 'es/index.html', 'app/index.html'];

    for (const relPath of entryPoints) {
      const fullPath = resolve(rootDir, relPath);
      assert.ok(existsSync(fullPath), `${relPath} must exist`);
      const html = readFileSync(fullPath, 'utf-8');

      assert.ok(
        html.includes('rel="manifest"') && html.includes('/manifest.webmanifest'),
        `${relPath} must link /manifest.webmanifest`,
      );
      assert.ok(
        html.includes("worker-src 'self'"),
        `${relPath} must permit Service Worker under CSP with worker-src 'self'`,
      );
    }
  });
});
