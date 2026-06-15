import { defineConfig } from 'vite';
import path from 'node:path';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      // Electron must not be bundled by Vite. Everything else (incl. the AI SDK,
      // gray-matter, js-yaml) is pure JS and is safe to bundle.
      external: ['electron'],
    },
  },
});
