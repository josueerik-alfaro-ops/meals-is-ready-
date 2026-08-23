// Build sin bundler: la app ya es un unico HTML autocontenido.
// Copia index.html (+ static/ si existe) a dist/.
// dist/ es la UNICA carpeta que se publica (Netlify/Vercel/Cloudflare):
// así nada del resto del repo (docker-compose, db/, docs, etc.) queda
// visible en la URL pública, aunque sí viva en el repositorio de GitHub.
import { cp, rm, mkdir, access } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("index.html", "dist/index.html");

try {
  await access("static");
  await cp("static", "dist", { recursive: true });
} catch {}

console.log("dist/ listo.");
