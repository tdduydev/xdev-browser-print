import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The extension pairs with an exact origin; a fixed port keeps the pairing stable between runs.
  server: { host: 'localhost', port: 5174, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
});
