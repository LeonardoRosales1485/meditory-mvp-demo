-- ============================================================
--  MEDITORY — Migración 022: Demo Final
--  Agrega Hospital Blanco, tabla medication_stock_config,
--  columnas volume/max_capacity en warehouses,
--  amplifica stock del Hospital Alemán (x10),
--  y genera datos de stock mínimo/óptimo para los 3 hospitales.
--
--  EJECUTAR DESPUÉS de 999_seed_massive_dummy_data.sql
-- ============================================================

-- ─────────────────────────────────────────────
--  1. TABLA medication_stock_config
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medication_stock_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id text NOT NULL,
  warehouse_id text NOT NULL,
  min_stock int NOT NULL DEFAULT 0,
  optimal_stock int NOT NULL DEFAULT 100,
  UNIQUE(medication_id, warehouse_id)
);

-- ─────────────────────────────────────────────
--  2. COLUMNAS volume y max_capacity en warehouses
-- ─────────────────────────────────────────────
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS volume decimal(10,2) DEFAULT 0;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS max_capacity decimal(10,2) DEFAULT 1000;

-- ─────────────────────────────────────────────
--  3. WORKSPACE: Hospital Blanco
-- ─────────────────────────────────────────────
INSERT INTO workspaces (id, name, slug)
VALUES ('ws-blanco', 'Hospital Blanco', 'HOSPITALBLANCO')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
--  4. WAREHOUSES Hospital Blanco
-- ─────────────────────────────────────────────
INSERT INTO warehouses (id, workspace_id, name, type, unit)
VALUES
  ('wh-blanco-central', 'ws-blanco', 'Depósito Central', 'central', 'Hospital Blanco'),
  ('wh-blanco-interna', 'ws-blanco', 'Farmacia Interna', 'interna', 'Hospital Blanco'),
  ('wh-blanco-ventas',  'ws-blanco', 'Farmacia Ventas',  'ventas',  'Hospital Blanco')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
--  5. USUARIOS Hospital Blanco
-- ─────────────────────────────────────────────
INSERT INTO workspace_users (id, workspace_id, name, email, role)
VALUES
  ('u-admin-bla', 'ws-blanco', 'Admin Blanco',  'hospitalblancopadmin@user.com',  'admin'),
  ('u-tec-bla',   'ws-blanco', 'Téc. Blanco',   'hospitalblaocotecnico@user.com', 'tecnico')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_user_warehouses (user_id, warehouse_id)
SELECT u.id, w.id
FROM workspace_users u
CROSS JOIN warehouses w
WHERE u.workspace_id = 'ws-blanco' AND w.workspace_id = 'ws-blanco' AND u.role = 'admin'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
--  6. MEDICATIONS Hospital Blanco (5 medicamentos, stock mínimo)
-- ─────────────────────────────────────────────
INSERT INTO medications (id, workspace_id, name, active_ingredient, concentration_value, concentration_unit, form, sale_price, sale_enabled)
VALUES
  ('med-bla-01', 'ws-blanco', 'Paracetamol',  'Paracetamol',  500, 'mg',     'Comprimido', 850,  true),
  ('med-bla-02', 'ws-blanco', 'Ibuprofeno',   'Ibuprofeno',   400, 'mg',     'Comprimido', 1200, true),
  ('med-bla-03', 'ws-blanco', 'Amoxicilina',  'Amoxicilina',  875, 'mg',     'Cápsula',    2500, true),
  ('med-bla-04', 'ws-blanco', 'Omeprazol',    'Omeprazol',    20,  'mg',     'Cápsula',    1500, true),
  ('med-bla-05', 'ws-blanco', 'Salbutamol',   'Salbutamol',   100, 'mcg',    'Aerosol',    3200, true)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
--  7. BATCHES Hospital Blanco (stock muy bajo / crítico)
-- ─────────────────────────────────────────────
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
VALUES
  -- Depósito Central: stock casi nulo
  ('bat-bla-c-01', 'med-bla-01', 'wh-blanco-central', 'BC-2026-001', NOW() + INTERVAL '90 days',   0),
  ('bat-bla-c-02', 'med-bla-02', 'wh-blanco-central', 'BC-2026-002', NOW() + INTERVAL '120 days',  5),
  ('bat-bla-c-03', 'med-bla-03', 'wh-blanco-central', 'BC-2026-003', NOW() + INTERVAL '60 days',   0),
  ('bat-bla-c-04', 'med-bla-04', 'wh-blanco-central', 'BC-2026-004', NOW() + INTERVAL '180 days',  8),
  ('bat-bla-c-05', 'med-bla-05', 'wh-blanco-central', 'BC-2026-005', NOW() + INTERVAL '45 days',   0),
  -- Farmacia Interna: algún stock mínimo
  ('bat-bla-i-01', 'med-bla-01', 'wh-blanco-interna', 'BI-2026-001', NOW() + INTERVAL '30 days',   12),
  ('bat-bla-i-02', 'med-bla-02', 'wh-blanco-interna', 'BI-2026-002', NOW() + INTERVAL '25 days',   3),
  ('bat-bla-i-03', 'med-bla-03', 'wh-blanco-interna', 'BI-2026-003', NOW() + INTERVAL '15 days',   0),
  ('bat-bla-i-04', 'med-bla-04', 'wh-blanco-interna', 'BI-2026-004', NOW() + INTERVAL '90 days',   20),
  ('bat-bla-i-05', 'med-bla-05', 'wh-blanco-interna', 'BI-2026-005', NOW() + INTERVAL '10 days',   4),
  -- Farmacia Ventas: vacía
  ('bat-bla-v-01', 'med-bla-01', 'wh-blanco-ventas',  'BV-2026-001', NOW() + INTERVAL '60 days',   0),
  ('bat-bla-v-02', 'med-bla-02', 'wh-blanco-ventas',  'BV-2026-002', NOW() + INTERVAL '90 days',   2),
  ('bat-bla-v-03', 'med-bla-03', 'wh-blanco-ventas',  'BV-2026-003', NOW() + INTERVAL '45 days',   0),
  ('bat-bla-v-04', 'med-bla-04', 'wh-blanco-ventas',  'BV-2026-004', NOW() + INTERVAL '30 days',   0),
  ('bat-bla-v-05', 'med-bla-05', 'wh-blanco-ventas',  'BV-2026-005', NOW() + INTERVAL '20 days',   0)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
--  8. MOVIMIENTOS HISTÓRICOS Hospital Blanco (30d mínimos)
-- ─────────────────────────────────────────────
INSERT INTO movements (id, workspace_id, type, medication_id, warehouse_id, quantity, user_name, reason, date)
VALUES
  ('mov-bla-01', 'ws-blanco', 'ingreso',      'med-bla-01', 'wh-blanco-central', 50,   'Admin Blanco', 'Compra OC-0001', NOW() - INTERVAL '25 days'),
  ('mov-bla-02', 'ws-blanco', 'egreso',       'med-bla-01', 'wh-blanco-central', -38,  'Admin Blanco', 'Consumo UCI',    NOW() - INTERVAL '20 days'),
  ('mov-bla-03', 'ws-blanco', 'egreso',       'med-bla-01', 'wh-blanco-central', -12,  'Admin Blanco', 'Consumo UCI',    NOW() - INTERVAL '10 days'),
  ('mov-bla-04', 'ws-blanco', 'ingreso',      'med-bla-02', 'wh-blanco-central', 30,   'Admin Blanco', 'Compra OC-0002', NOW() - INTERVAL '28 days'),
  ('mov-bla-05', 'ws-blanco', 'egreso',       'med-bla-02', 'wh-blanco-central', -25,  'Admin Blanco', 'Consumo',        NOW() - INTERVAL '15 days'),
  ('mov-bla-06', 'ws-blanco', 'ingreso',      'med-bla-04', 'wh-blanco-central', 40,   'Admin Blanco', 'Compra OC-0003', NOW() - INTERVAL '30 days'),
  ('mov-bla-07', 'ws-blanco', 'egreso',       'med-bla-04', 'wh-blanco-central', -12,  'Téc. Blanco',  'Dispensación',   NOW() - INTERVAL '7 days'),
  ('mov-bla-08', 'ws-blanco', 'dispensacion', 'med-bla-01', 'wh-blanco-interna', -5,   'Téc. Blanco',  'Paciente #1',    NOW() - INTERVAL '3 days'),
  ('mov-bla-09', 'ws-blanco', 'dispensacion', 'med-bla-02', 'wh-blanco-interna', -2,   'Téc. Blanco',  'Paciente #2',    NOW() - INTERVAL '2 days'),
  ('mov-bla-10', 'ws-blanco', 'dispensacion', 'med-bla-05', 'wh-blanco-interna', -1,   'Téc. Blanco',  'Paciente #3',    NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
--  9. AMPLIFICAR STOCK Hospital Alemán (x10)
--     Solo si no se ha amplificado antes (comprobamos promedio)
-- ─────────────────────────────────────────────
DO $$
DECLARE
  avg_qty numeric;
BEGIN
  SELECT AVG(quantity) INTO avg_qty
  FROM batches b
  JOIN warehouses w ON w.id = b.warehouse_id
  WHERE w.workspace_id = 'ws-aleman';

  -- Si el promedio ya supera 2000 asumimos que ya se amplificó
  IF avg_qty IS NOT NULL AND avg_qty < 2000 THEN
    UPDATE batches
    SET quantity = quantity * 10
    WHERE warehouse_id IN ('wh-aleman-central', 'wh-aleman-interna', 'wh-aleman-ventas');

    RAISE NOTICE 'Stock Hospital Alemán amplificado x10. Promedio previo: %', avg_qty;
  ELSE
    RAISE NOTICE 'Stock Hospital Alemán ya amplificado (promedio actual: %). Omitiendo.', avg_qty;
  END IF;
END $$;

-- ─────────────────────────────────────────────
--  10. CAPACIDADES DE DEPÓSITOS (max_capacity)
-- ─────────────────────────────────────────────
UPDATE warehouses SET max_capacity = 50000 WHERE id = 'wh-aleman-central';
UPDATE warehouses SET max_capacity = 20000 WHERE id = 'wh-aleman-interna';
UPDATE warehouses SET max_capacity = 10000 WHERE id = 'wh-aleman-ventas';
UPDATE warehouses SET max_capacity = 15000 WHERE id = 'wh-fco-central';
UPDATE warehouses SET max_capacity = 8000  WHERE id = 'wh-fco-interna';
UPDATE warehouses SET max_capacity = 5000  WHERE id = 'wh-fco-ventas';
UPDATE warehouses SET max_capacity = 3000  WHERE id = 'wh-blanco-central';
UPDATE warehouses SET max_capacity = 2000  WHERE id = 'wh-blanco-interna';
UPDATE warehouses SET max_capacity = 1000  WHERE id = 'wh-blanco-ventas';

-- Actualizar volume = suma de units en cada depósito
UPDATE warehouses w
SET volume = COALESCE((
  SELECT SUM(b.quantity)
  FROM batches b
  WHERE b.warehouse_id = w.id
), 0);

-- ─────────────────────────────────────────────
--  11. STOCK MÍNIMO Y ÓPTIMO — medication_stock_config
--      Para los medicamentos del Hospital Alemán
-- ─────────────────────────────────────────────

-- Alemán Central (deposito grande, stock alto)
INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
SELECT m.id, 'wh-aleman-central',
  CASE m.id
    WHEN 'med-ale-01' THEN 500   -- Paracetamol: muy demandado
    WHEN 'med-ale-02' THEN 300
    WHEN 'med-ale-03' THEN 200
    WHEN 'med-ale-04' THEN 150
    WHEN 'med-ale-05' THEN 100
    WHEN 'med-ale-06' THEN 200
    WHEN 'med-ale-07' THEN 250
    WHEN 'med-ale-08' THEN 150
    WHEN 'med-ale-09' THEN 100
    WHEN 'med-ale-10' THEN 80
    WHEN 'med-ale-11' THEN 100
    WHEN 'med-ale-12' THEN 150
    WHEN 'med-ale-13' THEN 50
    WHEN 'med-ale-14' THEN 30
    WHEN 'med-ale-15' THEN 200
    ELSE 100
  END,
  CASE m.id
    WHEN 'med-ale-01' THEN 2000
    WHEN 'med-ale-02' THEN 1000
    WHEN 'med-ale-03' THEN 800
    WHEN 'med-ale-04' THEN 600
    WHEN 'med-ale-05' THEN 500
    WHEN 'med-ale-06' THEN 800
    WHEN 'med-ale-07' THEN 1000
    WHEN 'med-ale-08' THEN 600
    WHEN 'med-ale-09' THEN 400
    WHEN 'med-ale-10' THEN 300
    WHEN 'med-ale-11' THEN 500
    WHEN 'med-ale-12' THEN 600
    WHEN 'med-ale-13' THEN 200
    WHEN 'med-ale-14' THEN 100
    WHEN 'med-ale-15' THEN 800
    ELSE 500
  END
FROM medications m
WHERE m.workspace_id = 'ws-aleman'
ON CONFLICT (medication_id, warehouse_id) DO UPDATE
  SET min_stock = EXCLUDED.min_stock, optimal_stock = EXCLUDED.optimal_stock;

-- Alemán Interna
INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
SELECT m.id, 'wh-aleman-interna', 50, 300
FROM medications m WHERE m.workspace_id = 'ws-aleman'
ON CONFLICT (medication_id, warehouse_id) DO NOTHING;

-- Alemán Ventas
INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
SELECT m.id, 'wh-aleman-ventas', 20, 150
FROM medications m WHERE m.workspace_id = 'ws-aleman' AND m.sale_enabled = true
ON CONFLICT (medication_id, warehouse_id) DO NOTHING;

-- Francisco Central
INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
SELECT m.id, 'wh-fco-central',
  CASE m.id
    WHEN 'med-fco-01' THEN 150 WHEN 'med-fco-02' THEN 100
    WHEN 'med-fco-03' THEN 80  WHEN 'med-fco-04' THEN 60
    WHEN 'med-fco-05' THEN 50  WHEN 'med-fco-06' THEN 70
    WHEN 'med-fco-07' THEN 100 WHEN 'med-fco-08' THEN 60
    WHEN 'med-fco-09' THEN 50  WHEN 'med-fco-10' THEN 80
    WHEN 'med-fco-11' THEN 60  WHEN 'med-fco-12' THEN 50
    WHEN 'med-fco-13' THEN 20  WHEN 'med-fco-14' THEN 10
    WHEN 'med-fco-15' THEN 100 ELSE 50
  END,
  CASE m.id
    WHEN 'med-fco-01' THEN 600 WHEN 'med-fco-02' THEN 400
    WHEN 'med-fco-03' THEN 350 WHEN 'med-fco-04' THEN 250
    WHEN 'med-fco-05' THEN 200 WHEN 'med-fco-06' THEN 300
    WHEN 'med-fco-07' THEN 400 WHEN 'med-fco-08' THEN 250
    WHEN 'med-fco-09' THEN 200 WHEN 'med-fco-10' THEN 350
    WHEN 'med-fco-11' THEN 250 WHEN 'med-fco-12' THEN 200
    WHEN 'med-fco-13' THEN 80  WHEN 'med-fco-14' THEN 40
    WHEN 'med-fco-15' THEN 400 ELSE 200
  END
FROM medications m WHERE m.workspace_id = 'ws-francisco'
ON CONFLICT (medication_id, warehouse_id) DO NOTHING;

-- Francisco Interna y Ventas
INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
SELECT m.id, 'wh-fco-interna', 20, 100
FROM medications m WHERE m.workspace_id = 'ws-francisco'
ON CONFLICT (medication_id, warehouse_id) DO NOTHING;

INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
SELECT m.id, 'wh-fco-ventas', 10, 60
FROM medications m WHERE m.workspace_id = 'ws-francisco' AND m.sale_enabled = true
ON CONFLICT (medication_id, warehouse_id) DO NOTHING;

-- Hospital Blanco (mínimos muy bajos, óptimos moderados)
INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
VALUES
  ('med-bla-01', 'wh-blanco-central', 100, 400),
  ('med-bla-02', 'wh-blanco-central', 80,  300),
  ('med-bla-03', 'wh-blanco-central', 60,  200),
  ('med-bla-04', 'wh-blanco-central', 50,  150),
  ('med-bla-05', 'wh-blanco-central', 40,  120),
  ('med-bla-01', 'wh-blanco-interna', 30,  100),
  ('med-bla-02', 'wh-blanco-interna', 20,  80),
  ('med-bla-03', 'wh-blanco-interna', 15,  60),
  ('med-bla-04', 'wh-blanco-interna', 10,  50),
  ('med-bla-05', 'wh-blanco-interna', 10,  40)
ON CONFLICT (medication_id, warehouse_id) DO NOTHING;

-- ─────────────────────────────────────────────
--  VERIFICACIÓN FINAL
-- ─────────────────────────────────────────────
DO $$
DECLARE
  cnt_workspaces int;
  cnt_meds int;
  cnt_stock_cfg int;
  avg_aleman numeric;
BEGIN
  SELECT COUNT(*) INTO cnt_workspaces FROM workspaces WHERE id IN ('ws-aleman','ws-francisco','ws-blanco');
  SELECT COUNT(*) INTO cnt_meds FROM medications WHERE workspace_id = 'ws-blanco';
  SELECT COUNT(*) INTO cnt_stock_cfg FROM medication_stock_config;
  SELECT AVG(quantity) INTO avg_aleman FROM batches b
    JOIN warehouses w ON w.id = b.warehouse_id WHERE w.workspace_id = 'ws-aleman';

  RAISE NOTICE '✓ Workspaces activos: %', cnt_workspaces;
  RAISE NOTICE '✓ Medicamentos Hospital Blanco: %', cnt_meds;
  RAISE NOTICE '✓ Configuraciones stock min/opt: %', cnt_stock_cfg;
  RAISE NOTICE '✓ Promedio stock Hospital Alemán: %', ROUND(avg_aleman, 0);
END $$;
