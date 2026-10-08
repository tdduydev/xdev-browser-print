import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/** Content scripts cannot be ES modules, so this one is built separately as a single IIFE. */
export default defineConfig({
  publicDir: false,
  build: {
    outDir: process.env.XDBP_E2E === '1' ? 'dist-e2e' : 'dist',
    emptyOutDir: false,
    target: 'chrome118',
    lib: {
      entry: resolve(import.meta.dirname, 'src/content/index.ts'),
      formats: ['iife'],
      name: 'xdevBrowserPrintContent',
      fileName: () => 'content.js',
    },
  },
});
