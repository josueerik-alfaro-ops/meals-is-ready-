# API Contract — webhooks de n8n para Compras y materia prima

Este documento define exactamente qué debe implementar cada workflow de n8n
para que la app (`index.html`) deje de depender solo de `localStorage` y
quede conectada a una base de datos real. Mientras estos workflows no
existan (o no sean alcanzables), la app sigue funcionando 100% offline usando
su caché local — no es un requisito bloqueante, es progresivo.

## Cómo se conecta la app

- Todas las rutas de abajo son relativas a la **URL base de n8n**, que se
  configura una sola vez desde la propia app: ícono de engrane (⚙) junto al
  selector de semanas en el header → "Configuración de sincronización" → "URL
  base de n8n". Se guarda en `localStorage['mir_config_v1']` del navegador,
  **no** en el código — así el mismo `dist/index.html` sirve para cualquier
  entorno sin necesidad de recompilar.
- Si configuras una "API key" en ese mismo panel, la app la manda en cada
  request como header `Authorization: Bearer <key>`. Tu workflow puede
  validarla o ignorarla si no la necesitas.
- Todas las respuestas deben ser JSON. Todas las peticiones `POST`/`PATCH`
  llevan header `Content-Type: application/json`.
- **CORS**: el sitio (estático, en Cloudflare/Vercel/Netlify) y la instancia
  de n8n viven en orígenes distintos. Cada workflow debe responder con
  encabezados CORS (`Access-Control-Allow-Origin`, y manejar `OPTIONS` /
  preflight) — si no, el `fetch()` del navegador falla con un error genérico
  de red, indistinguible de "n8n caído", y la app simplemente sigue en modo
  offline sin poder indicar la causa real.
- **IDs**: la app genera los IDs del lado del cliente (usa
  `crypto.randomUUID()` cuando está disponible) para poder seguir operando
  sin conexión y reconciliar después. El backend debe **insertar usando el
  ID recibido**, no reasignar uno propio — de lo contrario, una compra hecha
  offline y sincronizada más tarde quedaría duplicada o huérfana.
- **Fuente de verdad**: si el `GET` de una entidad responde con éxito al
  cargar la app (o al guardar la configuración), su resultado **reemplaza
  por completo** el estado local y la caché de `localStorage` para esa
  entidad. Si el `GET` falla o hace timeout (~9s), la app sigue usando
  silenciosamente lo que tenía en caché.
- **Reintentos**: si un `POST`/`PATCH`/`DELETE` falla, la app lo encola
  (`localStorage['mir_syncqueue_v1']`) y reintenta automáticamente cuando
  vuelve la conexión, cada ~45s mientras la pestaña esté abierta, o
  manualmente desde el mismo panel de Configuración ("Sincronizar ahora" /
  "Reintentar fallidos"). Después de 8 intentos fallidos, el cambio se marca
  como "fallido" y queda visible en ese panel — nunca se descarta en
  silencio.

---

## Catálogo

### `GET /catalogo`
Response `200`:
```json
[
  { "id": 1, "name": "Pechuga de pollo", "cat": "Proteína", "unit": "gr", "brand": "Bachoco", "active": true }
]
```

### `POST /catalogo`
Request (el `id` ya viene generado por el cliente):
```json
{ "id": "sq-a1b2c3", "name": "Queso oaxaca", "cat": "Lácteo", "unit": "gr", "brand": "Lala", "active": true }
```
Response `201`: el registro creado (mismo shape).

### `PATCH /catalogo/:id`
Request:
```json
{ "name": "Queso oaxaca", "cat": "Lácteo", "unit": "gr", "brand": "Lala" }
```
Response `200`: `{ "ok": true }` (o el registro actualizado).

### `PATCH /catalogo/:id/estado`
Request:
```json
{ "active": false }
```
Response `200`: `{ "ok": true }`. Nunca borra — solo cambia `active` (igual
que hace la propia app: "archivar", no eliminar).

### `DELETE /catalogo/:id`
Sin body. Solo se llama cuando el ingrediente no tiene historial de compras
(uso = 0) — borrado real permitido en ese caso.
Response `200`: `{ "ok": true }`.

**Tabla sugerida `catalogo`**: `id (text, pk)`, `name (text)`, `cat (text)`,
`unit (text)`, `brand (text, nullable)`, `active (boolean, default true)`,
`created_at (timestamptz)`, `updated_at (timestamptz)`.

---

## Proveedores

### `GET /proveedores`
Response `200`:
```json
[ { "id": 1, "name": "Abastos", "active": true } ]
```

### `POST /proveedores`
Request:
```json
{ "id": "sq-d4e5f6", "name": "Central de Abasto CDMX", "active": true }
```
Response `201`: el registro creado.

### `PATCH /proveedores/:id`
Request:
```json
{ "name": "Central de Abasto CDMX", "oldName": "Abastos" }
```
La app referencia proveedores **por nombre** (no por id) dentro de `compras`
y `merma`. El workflow debe: 1) actualizar el nombre en `proveedores`, 2)
hacer un `UPDATE` masivo `compras.prov = oldName → name` y
`merma.prov = oldName → name`, para mantener la consistencia — la app no
manda un PATCH por cada compra/merma afectada, se apoya en que el backend
haga ese cascade.
Response `200`: `{ "ok": true }`.

### `PATCH /proveedores/:id/estado`
Request: `{ "active": false }`. Response `200`: `{ "ok": true }`.

### `DELETE /proveedores/:id`
Solo cuando uso = 0. Response `200`: `{ "ok": true }`.

**Tabla sugerida `proveedores`**: `id (text, pk)`, `name (text, unique)`,
`active (boolean)`, `created_at`, `updated_at`.

---

## Compras (entradas de compra / "Registrar entrada")

### `GET /compras`
Response `200`:
```json
[
  {
    "id": "m1755000000000", "week": "2026-07-25", "date": "2026-07-27",
    "ing": 1, "prov": "Abastos", "qty": 6000, "baseUnit": "gr",
    "buyQty": 6, "buyUnit": "kg", "paid": 870.5, "note": "", "manual": true
  }
]
```
`ing` es el id numérico del catálogo. `prov` es el nombre del proveedor
(string, no id). `qty`/`baseUnit` son la cantidad ya normalizada a la unidad
base del ingrediente; `buyQty`/`buyUnit` son la cantidad tal como se compró.

### `POST /compras/entrada`
Request: mismo shape que un elemento de la respuesta de `GET` (el `id` ya
viene generado por el cliente).
Response `201`: el registro creado.

**Tabla sugerida `compras`**: `id (text, pk)`, `week (date)`, `date (date)`,
`ing (int, fk catalogo.id)`, `prov (text)`, `qty (numeric)`,
`base_unit (text)`, `buy_qty (numeric)`, `buy_unit (text)`, `paid (numeric)`,
`note (text, nullable)`, `manual (boolean)`, `created_at`.

---

## Merma

### `GET /merma`
Response `200`:
```json
[
  {
    "id": "w1755000000001", "week": "2026-07-25", "date": "2026-07-28",
    "ing": 30, "prov": "Abastos", "qty": 1200, "reason": "Caducidad",
    "note": "", "cost": 33.6
  }
]
```
`qty` viene en la unidad base del ingrediente. `cost` puede ser `null` si no
había precio de referencia disponible al momento de registrar la merma.

### `POST /merma/registro`
Request: mismo shape que un elemento de `GET` (el `id` ya viene generado por
el cliente). Este único endpoint recibe **tanto** las mermas capturadas
manualmente en la pestaña Merma **como** las que se generan automáticamente
al dar salida a un lote en Inventarios con motivo distinto de "Consumido"
(en ese caso, `note` trae el texto `"Salida de lote <código> (Inventarios)"`
para poder distinguirlas si hace falta).
Response `201`: el registro creado.

**Tabla sugerida `merma`**: `id (text, pk)`, `week (date)`, `date (date)`,
`ing (int, fk catalogo.id)`, `prov (text, nullable)`, `qty (numeric, en
unidad base)`, `reason (text)`, `note (text, nullable)`, `cost (numeric,
nullable)`, `created_at`.

---

## Inventario (lotes)

### `GET /inventario`
Response `200`:
```json
[
  {
    "id": "L-abc123", "ing": 1, "lote": "L-0142", "perecedero": true,
    "cantidad": 12000, "unidad": "gr", "fechaEntrada": "2026-08-10",
    "vidaUtilDias": 5, "fechaCaducidad": "2026-08-15", "prov": "Abastos",
    "archivado": false, "salida": null
  }
]
```
`ing` es el id numérico del catálogo (el nombre/categoría se resuelven en el
cliente contra el catálogo, no van denormalizados en el lote). `salida` es
`null` mientras el lote está activo, o `{ "fecha": "...", "motivo": "..." }`
una vez que se le dio salida.

### `POST /inventario/entrada`
Request: mismo shape que un elemento de `GET`, sin `id` si el backend lo va
a asignar, o con el `id` que ya generó el cliente (ver nota de "IDs" arriba)
— usado tanto por "Alta rápida de lote" como por la creación automática de
un lote cuando se registra una compra de un ingrediente perecedero en
"Registrar entrada".
Response `201`: el lote creado.

### `POST /inventario/salida`
Request:
```json
{ "id": "L-abc123", "fecha": "2026-08-14", "motivo": "Consumido" }
```
`motivo` es uno de: `"Consumido"`, `"Caducidad"`, `"Daño en
transporte/almacén"`, `"Sobreproducción"`, `"Otro"` (los mismos valores que
usa la pestaña Merma, menos "Consumido" que es exclusivo de Inventarios).
Cuando `motivo !== "Consumido"`, la app **también** manda por separado un
`POST /merma/registro` con el registro de merma correspondiente — el
workflow de `/inventario/salida` solo necesita marcar el lote como salido,
no duplicar la merma.
Response `200`: `{ "ok": true }` (o el lote actualizado).

### `PATCH /inventario/:id`
Request:
```json
{ "lote": "L-0142-B", "cantidad": 11500, "unidad": "gr", "fechaEntrada": "2026-08-10", "vidaUtilDias": 5, "fechaCaducidad": "2026-08-15" }
```
Response `200`: `{ "ok": true }` (o el lote actualizado).

### `PATCH /inventario/:id/archivar`
Request: `{ "archivado": true }`. Nunca borra.
Response `200`: `{ "ok": true }`.

**Tabla sugerida `lotes`**: `id (text, pk)`, `ing (int, fk catalogo.id)`,
`lote (text)`, `perecedero (boolean)`, `cantidad (numeric)`, `unidad (text)`,
`fecha_entrada (date)`, `vida_util_dias (int, nullable)`,
`fecha_caducidad (date, nullable)`, `prov (text, nullable)`,
`archivado (boolean, default false)`, `salida_fecha (date, nullable)`,
`salida_motivo (text, nullable)`, `created_at`, `updated_at`.

---

## Probar sin un n8n real

`tools/mock-n8n-server.mjs` es un servidor Node sin dependencias que
implementa esta misma superficie (GET/POST/PATCH/DELETE por entidad) para
poder probar toda la capa de sync del cliente sin depender de que los
workflows reales ya existan. Ver el encabezado de ese archivo para las
variables de entorno que permiten forzar fallos, timeouts, o un servidor
totalmente inalcanzable.
