# Meals is Ready — Gestión de Compras · Guía de despliegue

App web estática protegida con **Basic Auth** (usuario `chef` + contraseña en la variable de entorno `SITE_PASSWORD`).

> **Nota:** esta carpeta (`netlify-deploy/`) es una copia limpia de `export/`, lista para subir a GitHub y conectar con Netlify. Se quitaron `node_modules`, la configuración local de `.claude/`, el archivo `.env.docker` con contraseñas reales, el backup `index.backup-*.html` y una captura de pantalla suelta que no usa la app. Las contraseñas de ejemplo en `.env.example`, `docker.env.example` y `package.json` se reemplazaron por `changeme` — cámbialas antes de usarlas en local o producción.
>
> `index.html` vive en la **raíz** del repo (no dentro de `src/`), para que se vea de inmediato al abrir la carpeta o el repo de GitHub. Esto NO significa que todo lo demás (docker-compose.yml, db/, API-CONTRACT.md, etc.) quede visible en la URL pública: **Netlify solo publica el contenido de `dist/`**, que `npm run build` genera copiando únicamente `index.html` (ver `scripts/build.mjs`). Todo lo demás puede vivir en el repo de GitHub sin que Netlify lo sirva jamás.

---

## 1. Estructura del repositorio

```
/  (raíz del repo de GitHub)
├── index.html                  ← LA APP (React + design system, autocontenida)
├── functions/
│   └── _middleware.js          ← Basic Auth · Cloudflare Pages
├── middleware.js               ← Basic Auth · Vercel (Edge Middleware)
├── netlify/
│   └── edge-functions/
│       └── basic-auth.js       ← Basic Auth · Netlify
├── netlify.toml                ← config Netlify
├── vercel.json                 ← config Vercel
├── scripts/
│   └── build.mjs               ← build (copia index.html → dist/)
├── vite.config.js
├── package.json
├── .env.example
└── .gitignore
```

`dist/` (generada por `npm run build`, no se sube a git) es la única carpeta que las plataformas publican. Ahí es donde de verdad "vive" la URL pública — todo lo que está fuera de `dist/` (este `index.html` incluido) es solo el código fuente del repositorio.

**Dónde va el middleware, exactamente:**

| Hosting | Ruta exacta | Notas |
|---|---|---|
| **Cloudflare Pages** | `functions/_middleware.js` — en la **raíz del repo**, hermano de `package.json`, **NO** dentro de `src/` ni de `dist/` | Cloudflare detecta la carpeta `functions/` automáticamente. `_middleware.js` en la raíz de `functions/` intercepta **todas** las rutas. |
| **Vercel** | `middleware.js` en la **raíz del repo** | Sin carpeta. |
| **Netlify** | `netlify/edge-functions/basic-auth.js` + el bloque `[[edge_functions]]` de `netlify.toml` | Netlify no usa el nombre `_middleware.js`. |

> Importante: el middleware **nunca** se copia a `dist/`. Vive fuera del output y lo ejecuta la plataforma en el edge.

---

## 2. Variables de entorno

Ambos middlewares leen:

- `SITE_PASSWORD` — **obligatoria**. Si está vacía, el sitio queda abierto (pensado para desarrollo).
- `BASIC_AUTH_USER` — opcional, por defecto **`chef`**.

### Cloudflare Pages
1. Dashboard → **Workers & Pages** → tu proyecto → **Settings** → **Variables and Secrets**.
2. **Add variable** → tipo **Secret** (encriptada).
   - Name: `SITE_PASSWORD` · Value: tu contraseña.
   - (Opcional) `BASIC_AUTH_USER` = `chef`.
3. Márcala tanto en **Production** como en **Preview** (son entornos separados).
4. **Save** y luego **Retry deployment** — las variables solo se aplican en despliegues nuevos.

### Vercel
1. Proyecto → **Settings** → **Environment Variables**.
2. Key `SITE_PASSWORD`, Value tu contraseña, entornos: **Production**, **Preview** y **Development**.
3. **Save** → pestaña **Deployments** → menú `···` del último deploy → **Redeploy**.

### Netlify
1. Site configuration → **Environment variables** → **Add a variable**.
2. Key `SITE_PASSWORD`. Scope: **All scopes** (incluye Edge Functions).
3. **Deploys** → **Trigger deploy** → **Clear cache and deploy site**.

---

## 3. Probar en local

```bash
npm install
```

**Opción A — solo la app, sin contraseña** (iteración rápida de UI):
```bash
npm run dev          # http://localhost:5173
```

**Opción B — app + Basic Auth real** (recomendado antes de subir):
```bash
npm run dev:auth     # http://localhost:8788
```
Levanta Wrangler (el emulador de Cloudflare Pages) sirviendo `dist/` con el middleware activo y `SITE_PASSWORD=changeme`. El navegador pedirá usuario y contraseña: `chef` / `changeme`.

Para cambiar la contraseña local, edita el script `dev:auth` en `package.json` o crea `.dev.vars` en la raíz:
```
SITE_PASSWORD=miclave
BASIC_AUTH_USER=chef
```

**Verificar desde terminal:**
```bash
# Debe devolver 401
curl -I http://localhost:8788/

# Debe devolver 200
curl -I -u chef:changeme http://localhost:8788/
```

**Vercel en local:**
```bash
npx vercel dev        # lee las variables de .env.local
```

---

## 4. Subir a GitHub y desplegar

```bash
git init
git add .
git commit -m "App de compras + Basic Auth"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

### Cloudflare Pages
1. **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → elige el repo.
2. Build settings:
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Añade `SITE_PASSWORD` (paso 2) y despliega.
4. Al abrir la URL `*.pages.dev` el navegador pedirá credenciales.

### Vercel
1. **Add New… → Project** → importa el repo.
2. Framework Preset: **Other** · Build Command: `npm run build` · Output Directory: `dist`.
3. Añade `SITE_PASSWORD` y despliega.

### Netlify
1. **Add new site → Import an existing project** → repo.
2. Build command `npm run build`, publish directory `dist`.
3. Añade `SITE_PASSWORD` y despliega.

---

## 5. Notas y límites de Basic Auth

- El navegador **cachea** las credenciales hasta cerrarlo. Para “cerrar sesión”, cierra el navegador o usa una ventana privada.
- Basic Auth viaja en base64, **no** cifrado: es seguro solo porque todo el tráfico va por HTTPS (los tres hostings lo fuerzan). No lo uses para datos regulados.
- Es un muro único para todo el equipo, sin usuarios individuales ni auditoría. Si más adelante necesitas control por persona, el siguiente paso es Cloudflare Access (gratis hasta 50 usuarios, login con Google) — se activa sin tocar el código.
- La app guarda sus datos en el navegador (`localStorage`): cada persona ve su propio historial. Para datos compartidos hace falta un backend.

---

## 6. Actualizar la app

`index.html` (en la raíz) es un archivo compilado y autocontenido: **no lo edites a mano**. Haz los cambios en el proyecto de diseño, vuelve a exportar y reemplaza ese archivo.
