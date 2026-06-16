import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { RENDERER_PORT } from "./src/shared/clerk-config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: RENDERER_PORT,
    strictPort: true,
  },
});
