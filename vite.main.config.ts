import { defineConfig, loadEnv } from 'vite';
import path from 'node:path';

// https://vitejs.dev/config
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    define: {
      // Injected as a global constant (like forge's MAIN_WINDOW_VITE_* globals)
      // rather than import.meta.env, which the commonjs tsconfig disallows here.
      CLERK_PUBLISHABLE_KEY: JSON.stringify(env.VITE_CLERK_PUBLISHABLE_KEY ?? ''),
    },
    build: {
      rollupOptions: {
        external: ['electron'],
      },
    },
  };
});
