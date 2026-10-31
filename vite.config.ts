import { defineConfig } from "vite";

// O site fica em web/ e reaproveita os templates de cena de src/remotion.
// Em desenvolvimento, as chamadas /api vão para o servidor (npm run servidor).
export default defineConfig({
  root: "web",
  base: "./",
  esbuild: { jsx: "automatic" },
  build: { outDir: "../dist-web", emptyOutDir: true },
  server: { proxy: { "/api": "http://localhost:8787" } },
});
