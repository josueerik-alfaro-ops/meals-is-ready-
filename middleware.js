/**
 * Vercel — Edge Middleware con Basic Auth.
 * Ubicación exacta: <raíz del repo>/middleware.js   (NO dentro de src/)
 *
 * Variable de entorno requerida: SITE_PASSWORD
 * Usuario por defecto: chef  (cambiable con BASIC_AUTH_USER)
 */

export const config = {
  // Protege todo menos los assets internos de Vercel.
  matcher: ["/((?!_next/static|_vercel|favicon.ico).*)"],
};

const REALM = "Meals is Ready — Gestion de Compras";

export default function middleware(request) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return; // sin contraseña configurada → sitio abierto

  const user = process.env.BASIC_AUTH_USER || "chef";
  const header = request.headers.get("authorization") || "";

  if (header.startsWith("Basic ")) {
    let decoded = "";
    try {
      decoded = atob(header.slice(6).trim());
    } catch (e) {
      decoded = "";
    }
    const sep = decoded.indexOf(":");
    if (sep > -1) {
      const givenUser = decoded.slice(0, sep);
      const givenPass = decoded.slice(sep + 1);
      if (givenUser === user && givenPass === password) return; // OK, continúa
    }
  }

  return new Response("401 — Acceso restringido.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
