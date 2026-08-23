import { defineConfig } from "vite";

// La app se compila a un unico archivo estatico autocontenido (index.html,
// en la raíz del repo). Vite solo lo copia a dist/ y sirve el dev server;
// no hay bundling adicional porque el HTML ya trae React, el runtime y el
// design system embebidos.
export default defineConfig({
  root: ".",
  publicDir: "static",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // El HTML ya esta minificado/inlineado: no volver a procesar sus scripts.
    assetsInlineLimit: 0,
    rollupOptions: {
      input: "index.html",
    },
  },
  server: { port: 5173, open: true },
});
