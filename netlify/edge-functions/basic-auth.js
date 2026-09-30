/**
 * Netlify — Edge Function con Basic Auth (varios usuarios).
 * Variables de entorno (en Netlify, NO en el código):
 *   BASIC_AUTH_USERS = "usuario1:clave1,usuario2:clave2,usuario3:clave3"
 *   (opcional, compatibilidad) SITE_PASSWORD + BASIC_AUTH_USER
 * Los usuarios distinguen mayúsculas/minúsculas. No uses "," ni ":" dentro de las claves.
 */

function loadUsers() {
  const users = new Map();
  const list = Deno.env.get("BASIC_AUTH_USERS") || "";
  for (const pair of list.split(",")) {
    const p = pair.trim();
    const i = p.indexOf(":");
    if (i > 0) users.set(p.slice(0, i).trim(), p.slice(i + 1));
  }
  const legacy = Deno.env.get("SITE_PASSWORD");
  if (legacy) users.set(Deno.env.get("BASIC_AUTH_USER") || "chef", legacy);
  return users;
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

export default async (request, context) => {
  const users = loadUsers();
  if (users.size === 0) return context.next(); // sin usuarios configurados → sitio abierto

  const header = request.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    let decoded = "";
    try {
      decoded = new TextDecoder().decode(
        Uint8Array.from(atob(header.slice(6).trim()), (c) => c.charCodeAt(0))
      );
    } catch (e) {
      decoded = "";
    }
    const sep = decoded.indexOf(":");
    if (sep > -1) {
      const expected = users.get(decoded.slice(0, sep));
      if (expected !== undefined && safeEqual(decoded.slice(sep + 1), expected)) {
        return context.next();
      }
    }
  }

  return new Response("401 — Acceso restringido.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Meals is Ready - Gestion de Compras", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};

export const config = { path: "/*" };
