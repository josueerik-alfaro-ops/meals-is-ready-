/**
 * Netlify — Edge Function con Basic Auth.
 * Ubicación exacta: <raíz del repo>/netlify/edge-functions/basic-auth.js
 * Se activa mediante el bloque [[edge_functions]] de netlify.toml
 */

export default async (request, context) => {
  const password = Deno.env.get("SITE_PASSWORD");
  if (!password) return context.next();

  const user = Deno.env.get("BASIC_AUTH_USER") || "chef";
  const header = request.headers.get("authorization") || "";

  if (header.startsWith("Basic ")) {
    let decoded = "";
    try {
      decoded = atob(header.slice(6).trim());
    } catch (e) {
      decoded = "";
    }
    const sep = decoded.indexOf(":");
    if (sep > -1 && decoded.slice(0, sep) === user && decoded.slice(sep + 1) === password) {
      return context.next();
    }
  }

  return new Response("401 — Acceso restringido.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Meals is Ready — Gestion de Compras", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};

export const config = { path: "/*" };
