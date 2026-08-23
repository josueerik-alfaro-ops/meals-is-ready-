/**
 * Cloudflare Pages — Basic Auth para TODO el sitio.
 * Ubicación exacta: <raíz del repo>/functions/_middleware.js
 *
 * Variable de entorno requerida: SITE_PASSWORD
 * Usuario por defecto: chef  (cambiable con la variable BASIC_AUTH_USER)
 */

const DEFAULT_USER = "chef";
const REALM = "Meals is Ready — Gestion de Compras";

function unauthorized() {
  return new Response("401 — Acceso restringido.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// Comparación en tiempo constante (evita fugas por timing).
function safeEqual(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function onRequest(context) {
  const { request, env, next } = context;

  // Si no hay contraseña configurada, no bloqueamos (útil en local).
  const password = env.SITE_PASSWORD;
  if (!password) return next();

  const user = env.BASIC_AUTH_USER || DEFAULT_USER;
  const header = request.headers.get("Authorization") || "";

  if (!header.startsWith("Basic ")) return unauthorized();

  let decoded = "";
  try {
    decoded = atob(header.slice(6).trim());
  } catch (e) {
    return unauthorized();
  }

  const sep = decoded.indexOf(":");
  if (sep < 0) return unauthorized();

  const givenUser = decoded.slice(0, sep);
  const givenPass = decoded.slice(sep + 1);

  if (!safeEqual(givenUser, user) || !safeEqual(givenPass, password)) {
    return unauthorized();
  }

  const response = await next();
  const out = new Response(response.body, response);
  out.headers.set("Cache-Control", "no-store");
  return out;
}
