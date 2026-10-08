import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { buildManifest } from './manifest.config';

function manifestPlugin(): Plugin {
  return {
    name: 'xdbp-manifest',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: JSON.stringify(buildManifest(), null, 2) });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), manifestPlugin()],
  base: '',
  build: {
    outDir: process.env.XDBP_E2E === '1' ? 'dist-e2e' : 'dist',
    emptyOutDir: true,
    target: 'chrome118',
    sourcemap: mode === 'development',
    // MV3 forbids remote code; everything is bundled and emitted locally.
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, 'popup.html'),
        options: resolve(import.meta.dirname, 'options.html'),
        approve: resolve(import.meta.dirname, 'approve.html'),
        print: resolve(import.meta.dirname, 'print.html'),
        background: resolve(import.meta.dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
}));
