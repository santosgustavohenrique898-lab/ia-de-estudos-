import { defineConfig } from "vite";

// O site fica em web/ e reaproveita os templates de cena de src/remotion.
export default defineConfig({
  root: "web",
  base: "./",
  esbuild: { jsx: "automatic" },
  build: { outDir: "../dist-web", emptyOutDir: true },
});
