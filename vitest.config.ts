import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'core', root: 'packages/core', environment: 'node' } },
      { test: { name: 'extension', root: 'apps/extension', environment: 'jsdom' } },
      { test: { name: 'sdk', root: 'packages/browser-print-sdk', environment: 'jsdom' } },
    ],
    coverage: { provider: 'v8', include: ['packages/*/src/**', 'apps/extension/src/**'] },
  },
});
