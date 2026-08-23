// Servidor mock, sin dependencias, para probar la capa de sync de la app
// (index.html, en la raíz del repo) sin depender de que existan workflows reales en n8n.
//
// Uso:
//   node tools/mock-n8n-server.mjs
//   MOCK_FAIL=/compras/entrada,/merma/registro node tools/mock-n8n-server.mjs
//   MOCK_DELAY_MS=15000 node tools/mock-n8n-server.mjs   (fuerza timeout, el cliente corta a los 9s)
//   MOCK_DOWN=1 node tools/mock-n8n-server.mjs           (simula servidor totalmente inalcanzable)
//
// Luego, en el panel de Configuración de la app (ícono de engrane junto al
// selector de semanas), apunta "URL base de n8n" a http://localhost:4000.
//
// Este servidor NO valida ni persiste datos de verdad — solo confirma que la
// app manda el método/ruta/body correctos y permite forzar fallos para
// probar la cola de reintentos. Ver API-CONTRACT.md para la forma exacta de
// cada request/response que un workflow real de n8n debe implementar.

import http from 'node:http';

const PORT = Number(process.env.PORT || 4000);
const FAIL_PATHS = new Set((process.env.MOCK_FAIL || '').split(',').filter(Boolean));
const DELAY_MS = Number(process.env.MOCK_DELAY_MS || 0);
const ALWAYS_DOWN = process.env.MOCK_DOWN === '1';

// Un arreglo en memoria por entidad, para que GET devuelva algo coherente
// después de varios POST (no persiste entre reinicios del proceso).
const store = { catalogo: [], proveedores: [], compras: [], merma: [], inventario: [] };

function entityFromPath(url) {
  const p = url.split('?')[0];
  if (p.startsWith('/catalogo')) return 'catalogo';
  if (p.startsWith('/proveedores')) return 'proveedores';
  if (p.startsWith('/compras')) return 'compras';
  if (p.startsWith('/merma')) return 'merma';
  if (p.startsWith('/inventario')) return 'inventario';
  return null;
}

const server = http.createServer((req, res) => {
  const setCors = () => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  };
  setCors();

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (ALWAYS_DOWN) { req.socket.destroy(); return; } // simula "servidor inalcanzable"

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const path = req.url.split('?')[0];
    console.log(new Date().toISOString(), req.method, req.url, body || '(sin body)');

    const respond = () => {
      if (FAIL_PATHS.has(path)) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'mock failure forzado por MOCK_FAIL' }));
        return;
      }

      const entity = entityFromPath(path);
      res.setHeader('Content-Type', 'application/json');

      if (req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify(entity ? store[entity] : []));
        return;
      }

      if (req.method === 'POST') {
        let parsed = null;
        try { parsed = body ? JSON.parse(body) : null; } catch (e) { parsed = null; }
        if (entity && parsed) store[entity].push(parsed);
        res.writeHead(201);
        res.end(JSON.stringify(parsed || { ok: true }));
        return;
      }

      // PATCH / DELETE
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
    };

    if (DELAY_MS) setTimeout(respond, DELAY_MS);
    else respond();
  });
});

server.listen(PORT, () => {
  console.log(`mock n8n escuchando en http://localhost:${PORT}`);
  if (FAIL_PATHS.size) console.log('Rutas que fallarán (500):', [...FAIL_PATHS].join(', '));
  if (DELAY_MS) console.log('Delay artificial por request:', DELAY_MS + 'ms');
  if (ALWAYS_DOWN) console.log('MOCK_DOWN=1 — el servidor cierra la conexión sin responder (simula caído)');
});
