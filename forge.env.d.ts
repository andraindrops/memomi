/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injected into the main-process bundle by vite.main.config.ts `define`.
declare const CLERK_PUBLISHABLE_KEY: string;
