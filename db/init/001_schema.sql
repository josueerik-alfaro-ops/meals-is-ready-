-- Esquema inicial para "Meals is Ready — Gestión de Compras"
-- Se ejecuta automáticamente la PRIMERA vez que se crea el volumen de Postgres
-- (docker-entrypoint-initdb.d). Si ya existe el volumen, este archivo se
-- ignora — para volver a aplicarlo hay que borrar el volumen (`docker
-- compose down -v`) y levantar de nuevo.
--
-- Basado en las tablas sugeridas en API-CONTRACT.md.

CREATE TABLE IF NOT EXISTS catalogo (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  cat        TEXT NOT NULL,
  unit       TEXT NOT NULL,
  brand      TEXT,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proveedores (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compras (
  id         TEXT PRIMARY KEY,
  week       DATE NOT NULL,
  date       DATE NOT NULL,
  ing        TEXT NOT NULL REFERENCES catalogo(id),
  prov       TEXT,
  qty        NUMERIC NOT NULL,
  base_unit  TEXT NOT NULL,
  buy_qty    NUMERIC NOT NULL,
  buy_unit   TEXT NOT NULL,
  paid       NUMERIC,
  note       TEXT,
  manual     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS merma (
  id         TEXT PRIMARY KEY,
  week       DATE NOT NULL,
  date       DATE NOT NULL,
  ing        TEXT NOT NULL REFERENCES catalogo(id),
  prov       TEXT,
  qty        NUMERIC NOT NULL,
  reason     TEXT NOT NULL,
  note       TEXT,
  cost       NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lotes (
  id             TEXT PRIMARY KEY,
  ing            TEXT NOT NULL REFERENCES catalogo(id),
  lote           TEXT NOT NULL,
  perecedero     BOOLEAN NOT NULL DEFAULT false,
  cantidad       NUMERIC NOT NULL,
  unidad         TEXT NOT NULL,
  fecha_entrada  DATE NOT NULL,
  vida_util_dias INT,
  fecha_caducidad DATE,
  prov           TEXT,
  archivado      BOOLEAN NOT NULL DEFAULT false,
  salida_fecha   DATE,
  salida_motivo  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compras_ing  ON compras(ing);
CREATE INDEX IF NOT EXISTS idx_merma_ing    ON merma(ing);
CREATE INDEX IF NOT EXISTS idx_lotes_ing    ON lotes(ing);
CREATE INDEX IF NOT EXISTS idx_lotes_activo ON lotes(archivado) WHERE archivado = false;
