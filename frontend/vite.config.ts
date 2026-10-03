import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(frontendDir, "../app/static/trend-widget"),
    emptyOutDir: true,
    lib: {
      entry: path.resolve(frontendDir, "src/main.tsx"),
      name: "FxTrendWidget",
      formats: ["es"],
      fileName: () => "trend-widget",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
