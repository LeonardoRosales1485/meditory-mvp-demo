-- ============================================================
--  MEDITORY — Migración 024: Licitaciones
--  Tablas para gestión de licitaciones de compra de medicamentos,
--  proveedores, ofertas y trazabilidad de estados.
--
--  EJECUTAR DESPUÉS de 023_reset_repopulate.sql
-- ============================================================

-- ─────────────────────────────────────────────
--  1. TABLA: proveedores (catálogo global)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proveedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  contacto text NOT NULL DEFAULT '',
  telefono text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  cuit text NOT NULL DEFAULT '',
  direccion text NOT NULL DEFAULT '',
  activo bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proveedores_nombre ON proveedores(nombre);
CREATE INDEX IF NOT EXISTS idx_proveedores_cuit ON proveedores(cuit);

-- ─────────────────────────────────────────────
--  2. TABLA: licitaciones
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE licitacion_estado AS ENUM (
    'borrador',
    'en_licitacion',
    'ofertas_recibidas',
    'adjudicado',
    'en_ejecucion',
    'completado',
    'cancelado'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS licitaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  titulo text NOT NULL,
  descripcion text NOT NULL DEFAULT '',
  estado licitacion_estado NOT NULL DEFAULT 'borrador',
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  fecha_limite_ofertas timestamptz,
  fecha_adjudicacion timestamptz,
  fecha_estimada_entrega timestamptz,
  creado_por text NOT NULL DEFAULT '',
  observaciones text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_licitaciones_codigo ON licitaciones(codigo);
CREATE INDEX IF NOT EXISTS idx_licitaciones_estado ON licitaciones(estado);
CREATE INDEX IF NOT EXISTS idx_licitaciones_fecha ON licitaciones(fecha_creacion DESC);

-- ─────────────────────────────────────────────
--  3. TABLA: licitacion_items
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS licitacion_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licitacion_id uuid NOT NULL REFERENCES licitaciones(id) ON DELETE CASCADE,
  medication_id text NOT NULL,
  workspace_id text NOT NULL,
  cantidad_solicitada int NOT NULL CHECK (cantidad_solicitada > 0),
  cantidad_adjudicada int DEFAULT 0,
  precio_unitario_estimado numeric(12,2) DEFAULT 0,
  justificacion text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_licitacion_items_licitacion ON licitacion_items(licitacion_id);

-- ─────────────────────────────────────────────
--  4. TABLA: licitacion_ofertas
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS licitacion_ofertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licitacion_id uuid NOT NULL REFERENCES licitaciones(id) ON DELETE CASCADE,
  proveedor_id uuid NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  fecha_presentacion timestamptz NOT NULL DEFAULT now(),
  monto_total numeric(12,2) NOT NULL CHECK (monto_total > 0),
  plazo_entrega_dias int NOT NULL DEFAULT 30,
  observaciones text NOT NULL DEFAULT '',
  adjudicado bool NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_licitacion_ofertas_licitacion ON licitacion_ofertas(licitacion_id);
CREATE INDEX IF NOT EXISTS idx_licitacion_ofertas_proveedor ON licitacion_ofertas(proveedor_id);

-- ─────────────────────────────────────────────
--  5. TABLA: licitacion_historial
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS licitacion_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licitacion_id uuid NOT NULL REFERENCES licitaciones(id) ON DELETE CASCADE,
  estado_anterior licitacion_estado,
  estado_nuevo licitacion_estado NOT NULL,
  fecha_cambio timestamptz NOT NULL DEFAULT now(),
  usuario text NOT NULL DEFAULT '',
  comentario text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_licitacion_historial_licitacion ON licitacion_historial(licitacion_id);
