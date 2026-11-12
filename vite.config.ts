import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { vitePwaPlugin } from './scripts/vitePwaPlugin.ts'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [svelte(), vitePwaPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        es: resolve(rootDir, 'es/index.html'),
        app: resolve(rootDir, 'app/index.html'),
      },
    },
  },
})
