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
      // Native modules and electron must not be bundled by Vite.
      external: ['better-sqlite3', 'electron'],
    },
  },
});
