-- ============================================================
--  MEDITORY — Migración 026: Amplificar Stock + Nuevos Hospitales
--  Multiplica stock de hospitales existentes y agrega datos
--  de inventario a los 6 nuevos workspaces.
--
--  EJECUTAR DESPUÉS de 023_reset_repopulate.sql
-- ============================================================

-- ─────────────────────────────────────────────
--  PASO 1: Multiplicar stock existente x3
-- ─────────────────────────────────────────────
UPDATE batches SET quantity = quantity * 3
WHERE warehouse_id IN (
  'wh-aleman-central','wh-aleman-interna','wh-aleman-ventas',
  'wh-fco-central','wh-fco-interna','wh-fco-ventas',
  'wh-blanco-central','wh-blanco-interna','wh-blanco-ventas'
);

UPDATE medication_stock_config SET min_stock = min_stock * 3, optimal_stock = optimal_stock * 3;

-- ─────────────────────────────────────────────
--  PASO 2: Agregar medicamentos faltantes (09-15)
--  para los 6 nuevos workspaces
-- ─────────────────────────────────────────────
INSERT INTO medications (id, workspace_id, name, active_ingredient, concentration_value, concentration_unit, form, sale_price, sale_enabled) VALUES
  -- Padilla
  ('med-ws-padilla-09', 'ws-padilla',    'Loratadina',   'Loratadina',  10, 'mg',  'Comprimido',  720, true),
  ('med-ws-padilla-10', 'ws-padilla',    'Dexametasona', 'Dexametasona', 8, 'mg',  'Inyectable', 2100, true),
  ('med-ws-padilla-11', 'ws-padilla',    'Atorvastatina','Atorvastatina',20,'mg',  'Comprimido', 1500, true),
  ('med-ws-padilla-12', 'ws-padilla',    'Losartán',     'Losartán',    50, 'mg',  'Comprimido',  890, true),
  ('med-ws-padilla-13', 'ws-padilla',    'Ceftriaxona',  'Ceftriaxona',  1, 'g',   'Inyectable', 3500, true),
  ('med-ws-padilla-14', 'ws-padilla',    'Heparina',     'Heparina',   5000,'UI',  'Inyectable', 4200, true),
  ('med-ws-padilla-15', 'ws-padilla',    'Solución NaCl','Cloruro de Sodio', 0.9,'%','Solución',  400, true),
  -- Niñez
  ('med-ws-ninez-09', 'ws-ninez',      'Loratadina',   'Loratadina',  10, 'mg',  'Comprimido',  720, true),
  ('med-ws-ninez-10', 'ws-ninez',      'Dexametasona', 'Dexametasona', 8, 'mg',  'Inyectable', 2100, true),
  ('med-ws-ninez-11', 'ws-ninez',      'Atorvastatina','Atorvastatina',20,'mg',  'Comprimido', 1500, true),
  ('med-ws-ninez-12', 'ws-ninez',      'Losartán',     'Losartán',    50, 'mg',  'Comprimido',  890, true),
  ('med-ws-ninez-13', 'ws-ninez',      'Ceftriaxona',  'Ceftriaxona',  1, 'g',   'Inyectable', 3500, true),
  ('med-ws-ninez-14', 'ws-ninez',      'Heparina',     'Heparina',   5000,'UI',  'Inyectable', 4200, true),
  ('med-ws-ninez-15', 'ws-ninez',      'Solución NaCl','Cloruro de Sodio', 0.9,'%','Solución',  400, true),
  -- Mujer
  ('med-ws-mujer-09', 'ws-mujer',      'Loratadina',   'Loratadina',  10, 'mg',  'Comprimido',  720, true),
  ('med-ws-mujer-10', 'ws-mujer',      'Dexametasona', 'Dexametasona', 8, 'mg',  'Inyectable', 2100, true),
  ('med-ws-mujer-11', 'ws-mujer',      'Atorvastatina','Atorvastatina',20,'mg',  'Comprimido', 1500, true),
  ('med-ws-mujer-12', 'ws-mujer',      'Losartán',     'Losartán',    50, 'mg',  'Comprimido',  890, true),
  ('med-ws-mujer-13', 'ws-mujer',      'Ceftriaxona',  'Ceftriaxona',  1, 'g',   'Inyectable', 3500, true),
  ('med-ws-mujer-14', 'ws-mujer',      'Heparina',     'Heparina',   5000,'UI',  'Inyectable', 4200, true),
  ('med-ws-mujer-15', 'ws-mujer',      'Solución NaCl','Cloruro de Sodio', 0.9,'%','Solución',  400, true),
  -- Eva Perón
  ('med-ws-evaperon-09', 'ws-evaperon', 'Loratadina',   'Loratadina',  10, 'mg',  'Comprimido',  720, true),
  ('med-ws-evaperon-10', 'ws-evaperon', 'Dexametasona', 'Dexametasona', 8, 'mg',  'Inyectable', 2100, true),
  ('med-ws-evaperon-11', 'ws-evaperon', 'Atorvastatina','Atorvastatina',20,'mg',  'Comprimido', 1500, true),
  ('med-ws-evaperon-12', 'ws-evaperon', 'Losartán',     'Losartán',    50, 'mg',  'Comprimido',  890, true),
  ('med-ws-evaperon-13', 'ws-evaperon', 'Ceftriaxona',  'Ceftriaxona',  1, 'g',   'Inyectable', 3500, true),
  ('med-ws-evaperon-14', 'ws-evaperon', 'Heparina',     'Heparina',   5000,'UI',  'Inyectable', 4200, true),
  ('med-ws-evaperon-15', 'ws-evaperon', 'Solución NaCl','Cloruro de Sodio', 0.9,'%','Solución',  400, true),
  -- Concepción
  ('med-ws-concepcion-09', 'ws-concepcion', 'Loratadina',   'Loratadina',  10, 'mg',  'Comprimido',  720, true),
  ('med-ws-concepcion-10', 'ws-concepcion', 'Dexametasona', 'Dexametasona', 8, 'mg',  'Inyectable', 2100, true),
  ('med-ws-concepcion-11', 'ws-concepcion', 'Atorvastatina','Atorvastatina',20,'mg',  'Comprimido', 1500, true),
  ('med-ws-concepcion-12', 'ws-concepcion', 'Losartán',     'Losartán',    50, 'mg',  'Comprimido',  890, true),
  ('med-ws-concepcion-13', 'ws-concepcion', 'Ceftriaxona',  'Ceftriaxona',  1, 'g',   'Inyectable', 3500, true),
  ('med-ws-concepcion-14', 'ws-concepcion', 'Heparina',     'Heparina',   5000,'UI',  'Inyectable', 4200, true),
  ('med-ws-concepcion-15', 'ws-concepcion', 'Solución NaCl','Cloruro de Sodio', 0.9,'%','Solución',  400, true),
  -- Este
  ('med-ws-este-09', 'ws-este',       'Loratadina',   'Loratadina',  10, 'mg',  'Comprimido',  720, true),
  ('med-ws-este-10', 'ws-este',       'Dexametasona', 'Dexametasona', 8, 'mg',  'Inyectable', 2100, true),
  ('med-ws-este-11', 'ws-este',       'Atorvastatina','Atorvastatina',20,'mg',  'Comprimido', 1500, true),
  ('med-ws-este-12', 'ws-este',       'Losartán',     'Losartán',    50, 'mg',  'Comprimido',  890, true),
  ('med-ws-este-13', 'ws-este',       'Ceftriaxona',  'Ceftriaxona',  1, 'g',   'Inyectable', 3500, true),
  ('med-ws-este-14', 'ws-este',       'Heparina',     'Heparina',   5000,'UI',  'Inyectable', 4200, true),
  ('med-ws-este-15', 'ws-este',       'Solución NaCl','Cloruro de Sodio', 0.9,'%','Solución',  400, true)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
--  PASO 3: Capacidades de depósitos
-- ─────────────────────────────────────────────
UPDATE warehouses SET max_capacity = 8000 WHERE id IN ('wh-ws-padilla-central','wh-ws-ninez-central','wh-ws-mujer-central','wh-ws-evaperon-central','wh-ws-concepcion-central','wh-ws-este-central');
UPDATE warehouses SET max_capacity = 3000 WHERE id IN ('wh-ws-padilla-interna','wh-ws-ninez-interna','wh-ws-mujer-interna','wh-ws-evaperon-interna','wh-ws-concepcion-interna','wh-ws-este-interna');
UPDATE warehouses SET max_capacity = 1500 WHERE id IN ('wh-ws-padilla-ventas','wh-ws-ninez-ventas','wh-ws-mujer-ventas','wh-ws-evaperon-ventas','wh-ws-concepcion-ventas','wh-ws-este-ventas');

UPDATE warehouses SET max_capacity = max_capacity * 3 WHERE id IN (
  'wh-aleman-central','wh-aleman-interna','wh-aleman-ventas',
  'wh-fco-central','wh-fco-interna','wh-fco-ventas',
  'wh-blanco-central','wh-blanco-interna','wh-blanco-ventas'
);

-- ─────────────────────────────────────────────
--  PASO 4: Batches — Padilla
-- ─────────────────────────────────────────────
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b26-pad-c-01', 'med-ws-padilla-01', 'wh-ws-padilla-central', 'PAD-C-001', NOW() + INTERVAL '180 days', 1200),
  ('b26-pad-c-02', 'med-ws-padilla-02', 'wh-ws-padilla-central', 'PAD-C-002', NOW() + INTERVAL '200 days',  800),
  ('b26-pad-c-03', 'med-ws-padilla-03', 'wh-ws-padilla-central', 'PAD-C-003', NOW() + INTERVAL '150 days',  500),
  ('b26-pad-c-04', 'med-ws-padilla-04', 'wh-ws-padilla-central', 'PAD-C-004', NOW() + INTERVAL '240 days',  600),
  ('b26-pad-c-05', 'med-ws-padilla-05', 'wh-ws-padilla-central', 'PAD-C-005', NOW() + INTERVAL '120 days',  300),
  ('b26-pad-c-06', 'med-ws-padilla-06', 'wh-ws-padilla-central', 'PAD-C-006', NOW() + INTERVAL '280 days',  400),
  ('b26-pad-c-07', 'med-ws-padilla-07', 'wh-ws-padilla-central', 'PAD-C-007', NOW() + INTERVAL '190 days',  900),
  ('b26-pad-c-08', 'med-ws-padilla-08', 'wh-ws-padilla-central', 'PAD-C-008', NOW() + INTERVAL '160 days',  300),
  ('b26-pad-c-09', 'med-ws-padilla-09', 'wh-ws-padilla-central', 'PAD-C-009', NOW() + INTERVAL '300 days',  350),
  ('b26-pad-c-10', 'med-ws-padilla-10', 'wh-ws-padilla-central', 'PAD-C-010', NOW() + INTERVAL '100 days',  200),
  ('b26-pad-c-11', 'med-ws-padilla-11', 'wh-ws-padilla-central', 'PAD-C-011', NOW() + INTERVAL '220 days',  300),
  ('b26-pad-c-12', 'med-ws-padilla-12', 'wh-ws-padilla-central', 'PAD-C-012', NOW() + INTERVAL '210 days',  250),
  ('b26-pad-c-13', 'med-ws-padilla-13', 'wh-ws-padilla-central', 'PAD-C-013', NOW() + INTERVAL '130 days',  150),
  ('b26-pad-c-14', 'med-ws-padilla-14', 'wh-ws-padilla-central', 'PAD-C-014', NOW() + INTERVAL '80 days',   100),
  ('b26-pad-c-15', 'med-ws-padilla-15', 'wh-ws-padilla-central', 'PAD-C-015', NOW() + INTERVAL '60 days',  3000)
ON CONFLICT DO NOTHING;

INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b26-pad-i-01', 'med-ws-padilla-01', 'wh-ws-padilla-interna', 'PAD-I-001', NOW() + INTERVAL '90 days',  40),
  ('b26-pad-i-02', 'med-ws-padilla-02', 'wh-ws-padilla-interna', 'PAD-I-002', NOW() + INTERVAL '100 days', 35),
  ('b26-pad-i-03', 'med-ws-padilla-03', 'wh-ws-padilla-interna', 'PAD-I-003', NOW() + INTERVAL '70 days',  25),
  ('b26-pad-i-04', 'med-ws-padilla-04', 'wh-ws-padilla-interna', 'PAD-I-004', NOW() + INTERVAL '120 days', 30),
  ('b26-pad-i-05', 'med-ws-padilla-05', 'wh-ws-padilla-interna', 'PAD-I-005', NOW() + INTERVAL '60 days',  15),
  ('b26-pad-i-06', 'med-ws-padilla-06', 'wh-ws-padilla-interna', 'PAD-I-006', NOW() + INTERVAL '140 days', 25),
  ('b26-pad-i-07', 'med-ws-padilla-07', 'wh-ws-padilla-interna', 'PAD-I-007', NOW() + INTERVAL '90 days',  45),
  ('b26-pad-i-08', 'med-ws-padilla-08', 'wh-ws-padilla-interna', 'PAD-I-008', NOW() + INTERVAL '80 days',  20),
  ('b26-pad-i-09', 'med-ws-padilla-09', 'wh-ws-padilla-interna', 'PAD-I-009', NOW() + INTERVAL '160 days', 25),
  ('b26-pad-i-10', 'med-ws-padilla-10', 'wh-ws-padilla-interna', 'PAD-I-010', NOW() + INTERVAL '70 days',  15),
  ('b26-pad-i-11', 'med-ws-padilla-11', 'wh-ws-padilla-interna', 'PAD-I-011', NOW() + INTERVAL '110 days', 20),
  ('b26-pad-i-12', 'med-ws-padilla-12', 'wh-ws-padilla-interna', 'PAD-I-012', NOW() + INTERVAL '105 days', 18),
  ('b26-pad-i-13', 'med-ws-padilla-13', 'wh-ws-padilla-interna', 'PAD-I-013', NOW() + INTERVAL '60 days',  12),
  ('b26-pad-i-14', 'med-ws-padilla-14', 'wh-ws-padilla-interna', 'PAD-I-014', NOW() + INTERVAL '40 days',   8),
  ('b26-pad-i-15', 'med-ws-padilla-15', 'wh-ws-padilla-interna', 'PAD-I-015', NOW() + INTERVAL '25 days', 400)
ON CONFLICT DO NOTHING;

-- Padilla Ventas (med-01..13)
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b26-pad-v-01', 'med-ws-padilla-01', 'wh-ws-padilla-ventas', 'PAD-V-001', NOW() + INTERVAL '90 days',  20),
  ('b26-pad-v-02', 'med-ws-padilla-02', 'wh-ws-padilla-ventas', 'PAD-V-002', NOW() + INTERVAL '100 days', 15),
  ('b26-pad-v-03', 'med-ws-padilla-03', 'wh-ws-padilla-ventas', 'PAD-V-003', NOW() + INTERVAL '60 days',  10),
  ('b26-pad-v-04', 'med-ws-padilla-04', 'wh-ws-padilla-ventas', 'PAD-V-004', NOW() + INTERVAL '120 days', 12),
  ('b26-pad-v-05', 'med-ws-padilla-05', 'wh-ws-padilla-ventas', 'PAD-V-005', NOW() + INTERVAL '50 days',   5),
  ('b26-pad-v-06', 'med-ws-padilla-06', 'wh-ws-padilla-ventas', 'PAD-V-006', NOW() + INTERVAL '140 days', 10),
  ('b26-pad-v-07', 'med-ws-padilla-07', 'wh-ws-padilla-ventas', 'PAD-V-007', NOW() + INTERVAL '80 days',  18),
  ('b26-pad-v-08', 'med-ws-padilla-08', 'wh-ws-padilla-ventas', 'PAD-V-008', NOW() + INTERVAL '70 days',   8),
  ('b26-pad-v-09', 'med-ws-padilla-09', 'wh-ws-padilla-ventas', 'PAD-V-009', NOW() + INTERVAL '150 days', 10),
  ('b26-pad-v-10', 'med-ws-padilla-10', 'wh-ws-padilla-ventas', 'PAD-V-010', NOW() + INTERVAL '40 days',   5),
  ('b26-pad-v-11', 'med-ws-padilla-11', 'wh-ws-padilla-ventas', 'PAD-V-011', NOW() + INTERVAL '100 days',  8),
  ('b26-pad-v-12', 'med-ws-padilla-12', 'wh-ws-padilla-ventas', 'PAD-V-012', NOW() + INTERVAL '90 days',   7),
  ('b26-pad-v-13', 'med-ws-padilla-13', 'wh-ws-padilla-ventas', 'PAD-V-013', NOW() + INTERVAL '50 days',   5)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
--  PASO 5: Batches — Niñez
-- ─────────────────────────────────────────────
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b26-nin-c-01', 'med-ws-ninez-01', 'wh-ws-ninez-central', 'NIN-C-001', NOW() + INTERVAL '200 days', 900),
  ('b26-nin-c-02', 'med-ws-ninez-02', 'wh-ws-ninez-central', 'NIN-C-002', NOW() + INTERVAL '180 days', 600),
  ('b26-nin-c-03', 'med-ws-ninez-03', 'wh-ws-ninez-central', 'NIN-C-003', NOW() + INTERVAL '160 days', 400),
  ('b26-nin-c-04', 'med-ws-ninez-04', 'wh-ws-ninez-central', 'NIN-C-004', NOW() + INTERVAL '220 days', 450),
  ('b26-nin-c-05', 'med-ws-ninez-05', 'wh-ws-ninez-central', 'NIN-C-005', NOW() + INTERVAL '130 days', 250),
  ('b26-nin-c-06', 'med-ws-ninez-06', 'wh-ws-ninez-central', 'NIN-C-006', NOW() + INTERVAL '260 days', 300),
  ('b26-nin-c-07', 'med-ws-ninez-07', 'wh-ws-ninez-central', 'NIN-C-007', NOW() + INTERVAL '200 days', 700),
  ('b26-nin-c-08', 'med-ws-ninez-08', 'wh-ws-ninez-central', 'NIN-C-008', NOW() + INTERVAL '140 days', 220),
  ('b26-nin-c-09', 'med-ws-ninez-09', 'wh-ws-ninez-central', 'NIN-C-009', NOW() + INTERVAL '280 days', 280),
  ('b26-nin-c-10', 'med-ws-ninez-10', 'wh-ws-ninez-central', 'NIN-C-010', NOW() + INTERVAL '90 days',  150),
  ('b26-nin-c-11', 'med-ws-ninez-11', 'wh-ws-ninez-central', 'NIN-C-011', NOW() + INTERVAL '240 days', 250),
  ('b26-nin-c-12', 'med-ws-ninez-12', 'wh-ws-ninez-central', 'NIN-C-012', NOW() + INTERVAL '195 days', 200),
  ('b26-nin-c-13', 'med-ws-ninez-13', 'wh-ws-ninez-central', 'NIN-C-013', NOW() + INTERVAL '110 days', 120),
  ('b26-nin-c-14', 'med-ws-ninez-14', 'wh-ws-ninez-central', 'NIN-C-014', NOW() + INTERVAL '70 days',   80),
  ('b26-nin-c-15', 'med-ws-ninez-15', 'wh-ws-ninez-central', 'NIN-C-015', NOW() + INTERVAL '50 days', 2500)
ON CONFLICT DO NOTHING;

INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b26-nin-i-01', 'med-ws-ninez-01', 'wh-ws-ninez-interna', 'NIN-I-001', NOW() + INTERVAL '80 days',  30),
  ('b26-nin-i-02', 'med-ws-ninez-02', 'wh-ws-ninez-interna', 'NIN-I-002', NOW() + INTERVAL '90 days',  25),
  ('b26-nin-i-03', 'med-ws-ninez-03', 'wh-ws-ninez-interna', 'NIN-I-003', NOW() + INTERVAL '60 days',  18),
  ('b26-nin-i-04', 'med-ws-ninez-04', 'wh-ws-ninez-interna', 'NIN-I-004', NOW() + INTERVAL '110 days', 22),
  ('b26-nin-i-05', 'med-ws-ninez-05', 'wh-ws-ninez-interna', 'NIN-I-005', NOW() + INTERVAL '50 days',  12),
  ('b26-nin-i-06', 'med-ws-ninez-06', 'wh-ws-ninez-interna', 'NIN-I-006', NOW() + INTERVAL '130 days', 18),
  ('b26-nin-i-07', 'med-ws-ninez-07', 'wh-ws-ninez-interna', 'NIN-I-007', NOW() + INTERVAL '80 days',  35),
  ('b26-nin-i-08', 'med-ws-ninez-08', 'wh-ws-ninez-interna', 'NIN-I-008', NOW() + INTERVAL '70 days',  15),
  ('b26-nin-i-09', 'med-ws-ninez-09', 'wh-ws-ninez-interna', 'NIN-I-009', NOW() + INTERVAL '150 days', 20),
  ('b26-nin-i-10', 'med-ws-ninez-10', 'wh-ws-ninez-interna', 'NIN-I-010', NOW() + INTERVAL '60 days',  10),
  ('b26-nin-i-11', 'med-ws-ninez-11', 'wh-ws-ninez-interna', 'NIN-I-011', NOW() + INTERVAL '100 days', 15),
  ('b26-nin-i-12', 'med-ws-ninez-12', 'wh-ws-ninez-interna', 'NIN-I-012', NOW() + INTERVAL '95 days',  14),
  ('b26-nin-i-13', 'med-ws-ninez-13', 'wh-ws-ninez-interna', 'NIN-I-013', NOW() + INTERVAL '50 days',   9),
  ('b26-nin-i-14', 'med-ws-ninez-14', 'wh-ws-ninez-interna', 'NIN-I-014', NOW() + INTERVAL '35 days',   6),
  ('b26-nin-i-15', 'med-ws-ninez-15', 'wh-ws-ninez-interna', 'NIN-I-015', NOW() + INTERVAL '20 days', 350)
ON CONFLICT DO NOTHING;

INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b26-nin-v-01', 'med-ws-ninez-01', 'wh-ws-ninez-ventas', 'NIN-V-001', NOW() + INTERVAL '80 days',  15),
  ('b26-nin-v-02', 'med-ws-ninez-02', 'wh-ws-ninez-ventas', 'NIN-V-002', NOW() + INTERVAL '90 days',  12),
  ('b26-nin-v-03', 'med-ws-ninez-03', 'wh-ws-ninez-ventas', 'NIN-V-003', NOW() + INTERVAL '50 days',   8),
  ('b26-nin-v-04', 'med-ws-ninez-04', 'wh-ws-ninez-ventas', 'NIN-V-004', NOW() + INTERVAL '110 days', 10),
  ('b26-nin-v-05', 'med-ws-ninez-05', 'wh-ws-ninez-ventas', 'NIN-V-005', NOW() + INTERVAL '40 days',   4),
  ('b26-nin-v-06', 'med-ws-ninez-06', 'wh-ws-ninez-ventas', 'NIN-V-006', NOW() + INTERVAL '120 days',  8),
  ('b26-nin-v-07', 'med-ws-ninez-07', 'wh-ws-ninez-ventas', 'NIN-V-007', NOW() + INTERVAL '70 days',  14),
  ('b26-nin-v-08', 'med-ws-ninez-08', 'wh-ws-ninez-ventas', 'NIN-V-008', NOW() + INTERVAL '60 days',   6),
  ('b26-nin-v-09', 'med-ws-ninez-09', 'wh-ws-ninez-ventas', 'NIN-V-009', NOW() + INTERVAL '140 days',  8),
  ('b26-nin-v-10', 'med-ws-ninez-10', 'wh-ws-ninez-ventas', 'NIN-V-010', NOW() + INTERVAL '30 days',   3),
  ('b26-nin-v-11', 'med-ws-ninez-11', 'wh-ws-ninez-ventas', 'NIN-V-011', NOW() + INTERVAL '90 days',   6),
  ('b26-nin-v-12', 'med-ws-ninez-12', 'wh-ws-ninez-ventas', 'NIN-V-012', NOW() + INTERVAL '80 days',   5),
  ('b26-nin-v-13', 'med-ws-ninez-13', 'wh-ws-ninez-ventas', 'NIN-V-013', NOW() + INTERVAL '40 days',   4)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
--  PASO 6: Batches — Mujer
-- ─────────────────────────────────────────────
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b26-muj-c-01', 'med-ws-mujer-01', 'wh-ws-mujer-central', 'MUJ-C-001', NOW() + INTERVAL '170 days', 1100),
  ('b26-muj-c-02', 'med-ws-mujer-02', 'wh-ws-mujer-central', 'MUJ-C-002', NOW() + INTERVAL '190 days',  700),
  ('b26-muj-c-03', 'med-ws-mujer-03', 'wh-ws-mujer-central', 'MUJ-C-003', NOW() + INTERVAL '140 days',  450),
  ('b26-muj-c-04', 'med-ws-mujer-04', 'wh-ws-mujer-central', 'MUJ-C-004', NOW() + INTERVAL '230 days',  550),
  ('b26-muj-c-05', 'med-ws-mujer-05', 'wh-ws-mujer-central', 'MUJ-C-005', NOW() + INTERVAL '110 days',  280),
  ('b26-muj-c-06', 'med-ws-mujer-06', 'wh-ws-mujer-central', 'MUJ-C-006', NOW() + INTERVAL '270 days',  380),
  ('b26-muj-c-07', 'med-ws-mujer-07', 'wh-ws-mujer-central', 'MUJ-C-007', NOW() + INTERVAL '185 days',  850),
  ('b26-muj-c-08', 'med-ws-mujer-08', 'wh-ws-mujer-central', 'MUJ-C-008', NOW() + INTERVAL '150 days',  280),
  ('b26-muj-c-09', 'med-ws-mujer-09', 'wh-ws-mujer-central', 'MUJ-C-009', NOW() + INTERVAL '290 days',  320),
  ('b26-muj-c-10', 'med-ws-mujer-10', 'wh-ws-mujer-central', 'MUJ-C-010', NOW() + INTERVAL '95 days',   180),
  ('b26-muj-c-11', 'med-ws-mujer-11', 'wh-ws-mujer-central', 'MUJ-C-011', NOW() + INTERVAL '210 days',  280),
  ('b26-muj-c-12', 'med-ws-mujer-12', 'wh-ws-mujer-central', 'MUJ-C-012', NOW() + INTERVAL '200 days',  230),
  ('b26-muj-c-13', 'med-ws-mujer-13', 'wh-ws-mujer-central', 'MUJ-C-013', NOW() + INTERVAL '120 days',  140),
  ('b26-muj-c-14', 'med-ws-mujer-14', 'wh-ws-mujer-central', 'MUJ-C-014', NOW() + INTERVAL '75 days',    90),
  ('b26-muj-c-15', 'med-ws-mujer-15', 'wh-ws-mujer-central', 'MUJ-C-015', NOW() + INTERVAL '55 days',  2800)
ON CONFLICT DO NOTHING;

INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b26-muj-i-01', 'med-ws-mujer-01', 'wh-ws-mujer-interna', 'MUJ-I-001', NOW() + INTERVAL '85 days',  35),
  ('b26-muj-i-02', 'med-ws-mujer-02', 'wh-ws-mujer-interna', 'MUJ-I-002', NOW() + INTERVAL '95 days',  30),
  ('b26-muj-i-03', 'med-ws-mujer-03', 'wh-ws-mujer-interna', 'MUJ-I-003', NOW() + INTERVAL '65 days',  20),
  ('b26-muj-i-04', 'med-ws-mujer-04', 'wh-ws-mujer-interna', 'MUJ-I-004', NOW() + INTERVAL '115 days', 28),
  ('b26-muj-i-05', 'med-ws-mujer-05', 'wh-ws-mujer-interna', 'MUJ-I-005', NOW() + INTERVAL '55 days',  14),
  ('b26-muj-i-06', 'med-ws-mujer-06', 'wh-ws-mujer-interna', 'MUJ-I-006', NOW() + INTERVAL '135 days', 22),
  ('b26-muj-i-07', 'med-ws-mujer-07', 'wh-ws-mujer-interna', 'MUJ-I-007', NOW() + INTERVAL '85 days',  40),
  ('b26-muj-i-08', 'med-ws-mujer-08', 'wh-ws-mujer-interna', 'MUJ-I-008', NOW() + INTERVAL '75 days',  18),
  ('b26-muj-i-09', 'med-ws-mujer-09', 'wh-ws-mujer-interna', 'MUJ-I-009', NOW() + INTERVAL '155 days', 22),
  ('b26-muj-i-10', 'med-ws-mujer-10', 'wh-ws-mujer-interna', 'MUJ-I-010', NOW() + INTERVAL '65 days',  12),
  ('b26-muj-i-11', 'med-ws-mujer-11', 'wh-ws-mujer-interna', 'MUJ-I-011', NOW() + INTERVAL '105 days', 18),
  ('b26-muj-i-12', 'med-ws-mujer-12', 'wh-ws-mujer-interna', 'MUJ-I-012', NOW() + INTERVAL '100 days', 16),
  ('b26-muj-i-13', 'med-ws-mujer-13', 'wh-ws-mujer-interna', 'MUJ-I-013', NOW() + INTERVAL '55 days',  10),
  ('b26-muj-i-14', 'med-ws-mujer-14', 'wh-ws-mujer-interna', 'MUJ-I-014', NOW() + INTERVAL '38 days',   7),
  ('b26-muj-i-15', 'med-ws-mujer-15', 'wh-ws-mujer-interna', 'MUJ-I-015', NOW() + INTERVAL '22 days', 380)
ON CONFLICT DO NOTHING;

INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b26-muj-v-01', 'med-ws-mujer-01', 'wh-ws-mujer-ventas', 'MUJ-V-001', NOW() + INTERVAL '85 days',  18),
  ('b26-muj-v-02', 'med-ws-mujer-02', 'wh-ws-mujer-ventas', 'MUJ-V-002', NOW() + INTERVAL '95 days',  14),
  ('b26-muj-v-03', 'med-ws-mujer-03', 'wh-ws-mujer-ventas', 'MUJ-V-003', NOW() + INTERVAL '55 days',   9),
  ('b26-muj-v-04', 'med-ws-mujer-04', 'wh-ws-mujer-ventas', 'MUJ-V-004', NOW() + INTERVAL '115 days', 11),
  ('b26-muj-v-05', 'med-ws-mujer-05', 'wh-ws-mujer-ventas', 'MUJ-V-005', NOW() + INTERVAL '45 days',   5),
  ('b26-muj-v-06', 'med-ws-mujer-06', 'wh-ws-mujer-ventas', 'MUJ-V-006', NOW() + INTERVAL '125 days',  9),
  ('b26-muj-v-07', 'med-ws-mujer-07', 'wh-ws-mujer-ventas', 'MUJ-V-007', NOW() + INTERVAL '75 days',  16),
  ('b26-muj-v-08', 'med-ws-mujer-08', 'wh-ws-mujer-ventas', 'MUJ-V-008', NOW() + INTERVAL '65 days',   7),
  ('b26-muj-v-09', 'med-ws-mujer-09', 'wh-ws-mujer-ventas', 'MUJ-V-009', NOW() + INTERVAL '145 days',  9),
  ('b26-muj-v-10', 'med-ws-mujer-10', 'wh-ws-mujer-ventas', 'MUJ-V-010', NOW() + INTERVAL '35 days',   4),
  ('b26-muj-v-11', 'med-ws-mujer-11', 'wh-ws-mujer-ventas', 'MUJ-V-011', NOW() + INTERVAL '95 days',   7),
  ('b26-muj-v-12', 'med-ws-mujer-12', 'wh-ws-mujer-ventas', 'MUJ-V-012', NOW() + INTERVAL '85 days',   6),
  ('b26-muj-v-13', 'med-ws-mujer-13', 'wh-ws-mujer-ventas', 'MUJ-V-013', NOW() + INTERVAL '45 days',   4)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
--  PASO 7: Batches — Eva Perón
-- ─────────────────────────────────────────────
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b26-eva-c-01', 'med-ws-evaperon-01', 'wh-ws-evaperon-central', 'EVA-C-001', NOW() + INTERVAL '175 days', 1000),
  ('b26-eva-c-02', 'med-ws-evaperon-02', 'wh-ws-evaperon-central', 'EVA-C-002', NOW() + INTERVAL '195 days',  650),
  ('b26-eva-c-03', 'med-ws-evaperon-03', 'wh-ws-evaperon-central', 'EVA-C-003', NOW() + INTERVAL '145 days',  420),
  ('b26-eva-c-04', 'med-ws-evaperon-04', 'wh-ws-evaperon-central', 'EVA-C-004', NOW() + INTERVAL '225 days',  500),
  ('b26-eva-c-05', 'med-ws-evaperon-05', 'wh-ws-evaperon-central', 'EVA-C-005', NOW() + INTERVAL '115 days',  260),
  ('b26-eva-c-06', 'med-ws-evaperon-06', 'wh-ws-evaperon-central', 'EVA-C-006', NOW() + INTERVAL '265 days',  350),
  ('b26-eva-c-07', 'med-ws-evaperon-07', 'wh-ws-evaperon-central', 'EVA-C-007', NOW() + INTERVAL '190 days',  800),
  ('b26-eva-c-08', 'med-ws-evaperon-08', 'wh-ws-evaperon-central', 'EVA-C-008', NOW() + INTERVAL '145 days',  260),
  ('b26-eva-c-09', 'med-ws-evaperon-09', 'wh-ws-evaperon-central', 'EVA-C-009', NOW() + INTERVAL '285 days',  300),
  ('b26-eva-c-10', 'med-ws-evaperon-10', 'wh-ws-evaperon-central', 'EVA-C-010', NOW() + INTERVAL '100 days',  170),
  ('b26-eva-c-11', 'med-ws-evaperon-11', 'wh-ws-evaperon-central', 'EVA-C-011', NOW() + INTERVAL '215 days',  260),
  ('b26-eva-c-12', 'med-ws-evaperon-12', 'wh-ws-evaperon-central', 'EVA-C-012', NOW() + INTERVAL '205 days',  220),
  ('b26-eva-c-13', 'med-ws-evaperon-13', 'wh-ws-evaperon-central', 'EVA-C-013', NOW() + INTERVAL '125 days',  130),
  ('b26-eva-c-14', 'med-ws-evaperon-14', 'wh-ws-evaperon-central', 'EVA-C-014', NOW() + INTERVAL '78 days',    85),
  ('b26-eva-c-15', 'med-ws-evaperon-15', 'wh-ws-evaperon-central', 'EVA-C-015', NOW() + INTERVAL '52 days',  2700)
ON CONFLICT DO NOTHING;

INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b26-eva-i-01', 'med-ws-evaperon-01', 'wh-ws-evaperon-interna', 'EVA-I-001', NOW() + INTERVAL '82 days',  32),
  ('b26-eva-i-02', 'med-ws-evaperon-02', 'wh-ws-evaperon-interna', 'EVA-I-002', NOW() + INTERVAL '92 days',  28),
  ('b26-eva-i-03', 'med-ws-evaperon-03', 'wh-ws-evaperon-interna', 'EVA-I-003', NOW() + INTERVAL '62 days',  18),
  ('b26-eva-i-04', 'med-ws-evaperon-04', 'wh-ws-evaperon-interna', 'EVA-I-004', NOW() + INTERVAL '112 days', 25),
  ('b26-eva-i-05', 'med-ws-evaperon-05', 'wh-ws-evaperon-interna', 'EVA-I-005', NOW() + INTERVAL '52 days',  13),
  ('b26-eva-i-06', 'med-ws-evaperon-06', 'wh-ws-evaperon-interna', 'EVA-I-006', NOW() + INTERVAL '132 days', 20),
  ('b26-eva-i-07', 'med-ws-evaperon-07', 'wh-ws-evaperon-interna', 'EVA-I-007', NOW() + INTERVAL '82 days',  38),
  ('b26-eva-i-08', 'med-ws-evaperon-08', 'wh-ws-evaperon-interna', 'EVA-I-008', NOW() + INTERVAL '72 days',  17),
  ('b26-eva-i-09', 'med-ws-evaperon-09', 'wh-ws-evaperon-interna', 'EVA-I-009', NOW() + INTERVAL '152 days', 20),
  ('b26-eva-i-10', 'med-ws-evaperon-10', 'wh-ws-evaperon-interna', 'EVA-I-010', NOW() + INTERVAL '62 days',  11),
  ('b26-eva-i-11', 'med-ws-evaperon-11', 'wh-ws-evaperon-interna', 'EVA-I-011', NOW() + INTERVAL '102 days', 17),
  ('b26-eva-i-12', 'med-ws-evaperon-12', 'wh-ws-evaperon-interna', 'EVA-I-012', NOW() + INTERVAL '98 days',  15),
  ('b26-eva-i-13', 'med-ws-evaperon-13', 'wh-ws-evaperon-interna', 'EVA-I-013', NOW() + INTERVAL '52 days',   9),
  ('b26-eva-i-14', 'med-ws-evaperon-14', 'wh-ws-evaperon-interna', 'EVA-I-014', NOW() + INTERVAL '36 days',   6),
  ('b26-eva-i-15', 'med-ws-evaperon-15', 'wh-ws-evaperon-interna', 'EVA-I-015', NOW() + INTERVAL '18 days', 360)
ON CONFLICT DO NOTHING;

INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b26-eva-v-01', 'med-ws-evaperon-01', 'wh-ws-evaperon-ventas', 'EVA-V-001', NOW() + INTERVAL '82 days',  17),
  ('b26-eva-v-02', 'med-ws-evaperon-02', 'wh-ws-evaperon-ventas', 'EVA-V-002', NOW() + INTERVAL '92 days',  13),
  ('b26-eva-v-03', 'med-ws-evaperon-03', 'wh-ws-evaperon-ventas', 'EVA-V-003', NOW() + INTERVAL '52 days',   8),
  ('b26-eva-v-04', 'med-ws-evaperon-04', 'wh-ws-evaperon-ventas', 'EVA-V-004', NOW() + INTERVAL '112 days', 10),
  ('b26-eva-v-05', 'med-ws-evaperon-05', 'wh-ws-evaperon-ventas', 'EVA-V-005', NOW() + INTERVAL '42 days',   4),
  ('b26-eva-v-06', 'med-ws-evaperon-06', 'wh-ws-evaperon-ventas', 'EVA-V-006', NOW() + INTERVAL '122 days',  8),
  ('b26-eva-v-07', 'med-ws-evaperon-07', 'wh-ws-evaperon-ventas', 'EVA-V-007', NOW() + INTERVAL '72 days',  15),
  ('b26-eva-v-08', 'med-ws-evaperon-08', 'wh-ws-evaperon-ventas', 'EVA-V-008', NOW() + INTERVAL '62 days',   7),
  ('b26-eva-v-09', 'med-ws-evaperon-09', 'wh-ws-evaperon-ventas', 'EVA-V-009', NOW() + INTERVAL '142 days',  8),
  ('b26-eva-v-10', 'med-ws-evaperon-10', 'wh-ws-evaperon-ventas', 'EVA-V-010', NOW() + INTERVAL '32 days',   3),
  ('b26-eva-v-11', 'med-ws-evaperon-11', 'wh-ws-evaperon-ventas', 'EVA-V-011', NOW() + INTERVAL '92 days',   6),
  ('b26-eva-v-12', 'med-ws-evaperon-12', 'wh-ws-evaperon-ventas', 'EVA-V-012', NOW() + INTERVAL '82 days',   5),
  ('b26-eva-v-13', 'med-ws-evaperon-13', 'wh-ws-evaperon-ventas', 'EVA-V-013', NOW() + INTERVAL '42 days',   4)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
--  PASO 8: Batches — Concepción
-- ─────────────────────────────────────────────
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b26-con-c-01', 'med-ws-concepcion-01', 'wh-ws-concepcion-central', 'CON-C-001', NOW() + INTERVAL '165 days',  800),
  ('b26-con-c-02', 'med-ws-concepcion-02', 'wh-ws-concepcion-central', 'CON-C-002', NOW() + INTERVAL '185 days',  500),
  ('b26-con-c-03', 'med-ws-concepcion-03', 'wh-ws-concepcion-central', 'CON-C-003', NOW() + INTERVAL '135 days',  350),
  ('b26-con-c-04', 'med-ws-concepcion-04', 'wh-ws-concepcion-central', 'CON-C-004', NOW() + INTERVAL '215 days',  400),
  ('b26-con-c-05', 'med-ws-concepcion-05', 'wh-ws-concepcion-central', 'CON-C-005', NOW() + INTERVAL '105 days',  220),
  ('b26-con-c-06', 'med-ws-concepcion-06', 'wh-ws-concepcion-central', 'CON-C-006', NOW() + INTERVAL '255 days',  300),
  ('b26-con-c-07', 'med-ws-concepcion-07', 'wh-ws-concepcion-central', 'CON-C-007', NOW() + INTERVAL '180 days',  650),
  ('b26-con-c-08', 'med-ws-concepcion-08', 'wh-ws-concepcion-central', 'CON-C-008', NOW() + INTERVAL '130 days',  220),
  ('b26-con-c-09', 'med-ws-concepcion-09', 'wh-ws-concepcion-central', 'CON-C-009', NOW() + INTERVAL '275 days',  250),
  ('b26-con-c-10', 'med-ws-concepcion-10', 'wh-ws-concepcion-central', 'CON-C-010', NOW() + INTERVAL '85 days',   140),
  ('b26-con-c-11', 'med-ws-concepcion-11', 'wh-ws-concepcion-central', 'CON-C-011', NOW() + INTERVAL '205 days',  220),
  ('b26-con-c-12', 'med-ws-concepcion-12', 'wh-ws-concepcion-central', 'CON-C-012', NOW() + INTERVAL '195 days',  180),
  ('b26-con-c-13', 'med-ws-concepcion-13', 'wh-ws-concepcion-central', 'CON-C-013', NOW() + INTERVAL '115 days',  110),
  ('b26-con-c-14', 'med-ws-concepcion-14', 'wh-ws-concepcion-central', 'CON-C-014', NOW() + INTERVAL '65 days',    70),
  ('b26-con-c-15', 'med-ws-concepcion-15', 'wh-ws-concepcion-central', 'CON-C-015', NOW() + INTERVAL '45 days',  2200)
ON CONFLICT DO NOTHING;

INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b26-con-i-01', 'med-ws-concepcion-01', 'wh-ws-concepcion-interna', 'CON-I-001', NOW() + INTERVAL '78 days',  28),
  ('b26-con-i-02', 'med-ws-concepcion-02', 'wh-ws-concepcion-interna', 'CON-I-002', NOW() + INTERVAL '88 days',  22),
  ('b26-con-i-03', 'med-ws-concepcion-03', 'wh-ws-concepcion-interna', 'CON-I-003', NOW() + INTERVAL '58 days',  16),
  ('b26-con-i-04', 'med-ws-concepcion-04', 'wh-ws-concepcion-interna', 'CON-I-004', NOW() + INTERVAL '108 days', 20),
  ('b26-con-i-05', 'med-ws-concepcion-05', 'wh-ws-concepcion-interna', 'CON-I-005', NOW() + INTERVAL '48 days',  10),
  ('b26-con-i-06', 'med-ws-concepcion-06', 'wh-ws-concepcion-interna', 'CON-I-006', NOW() + INTERVAL '128 days', 18),
  ('b26-con-i-07', 'med-ws-concepcion-07', 'wh-ws-concepcion-interna', 'CON-I-007', NOW() + INTERVAL '78 days',  32),
  ('b26-con-i-08', 'med-ws-concepcion-08', 'wh-ws-concepcion-interna', 'CON-I-008', NOW() + INTERVAL '68 days',  14),
  ('b26-con-i-09', 'med-ws-concepcion-09', 'wh-ws-concepcion-interna', 'CON-I-009', NOW() + INTERVAL '148 days', 18),
  ('b26-con-i-10', 'med-ws-concepcion-10', 'wh-ws-concepcion-interna', 'CON-I-010', NOW() + INTERVAL '58 days',   9),
  ('b26-con-i-11', 'med-ws-concepcion-11', 'wh-ws-concepcion-interna', 'CON-I-011', NOW() + INTERVAL '98 days',  14),
  ('b26-con-i-12', 'med-ws-concepcion-12', 'wh-ws-concepcion-interna', 'CON-I-012', NOW() + INTERVAL '92 days',  12),
  ('b26-con-i-13', 'med-ws-concepcion-13', 'wh-ws-concepcion-interna', 'CON-I-013', NOW() + INTERVAL '48 days',   8),
  ('b26-con-i-14', 'med-ws-concepcion-14', 'wh-ws-concepcion-interna', 'CON-I-014', NOW() + INTERVAL '32 days',   5),
  ('b26-con-i-15', 'med-ws-concepcion-15', 'wh-ws-concepcion-interna', 'CON-I-015', NOW() + INTERVAL '15 days', 300)
ON CONFLICT DO NOTHING;

INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b26-con-v-01', 'med-ws-concepcion-01', 'wh-ws-concepcion-ventas', 'CON-V-001', NOW() + INTERVAL '78 days',  14),
  ('b26-con-v-02', 'med-ws-concepcion-02', 'wh-ws-concepcion-ventas', 'CON-V-002', NOW() + INTERVAL '88 days',  11),
  ('b26-con-v-03', 'med-ws-concepcion-03', 'wh-ws-concepcion-ventas', 'CON-V-003', NOW() + INTERVAL '48 days',   7),
  ('b26-con-v-04', 'med-ws-concepcion-04', 'wh-ws-concepcion-ventas', 'CON-V-004', NOW() + INTERVAL '108 days',  8),
  ('b26-con-v-05', 'med-ws-concepcion-05', 'wh-ws-concepcion-ventas', 'CON-V-005', NOW() + INTERVAL '38 days',   3),
  ('b26-con-v-06', 'med-ws-concepcion-06', 'wh-ws-concepcion-ventas', 'CON-V-006', NOW() + INTERVAL '118 days',  7),
  ('b26-con-v-07', 'med-ws-concepcion-07', 'wh-ws-concepcion-ventas', 'CON-V-007', NOW() + INTERVAL '68 days',  13),
  ('b26-con-v-08', 'med-ws-concepcion-08', 'wh-ws-concepcion-ventas', 'CON-V-008', NOW() + INTERVAL '58 days',   6),
  ('b26-con-v-09', 'med-ws-concepcion-09', 'wh-ws-concepcion-ventas', 'CON-V-009', NOW() + INTERVAL '138 days',  7),
  ('b26-con-v-10', 'med-ws-concepcion-10', 'wh-ws-concepcion-ventas', 'CON-V-010', NOW() + INTERVAL '28 days',   3),
  ('b26-con-v-11', 'med-ws-concepcion-11', 'wh-ws-concepcion-ventas', 'CON-V-011', NOW() + INTERVAL '88 days',   5),
  ('b26-con-v-12', 'med-ws-concepcion-12', 'wh-ws-concepcion-ventas', 'CON-V-012', NOW() + INTERVAL '78 days',   4),
  ('b26-con-v-13', 'med-ws-concepcion-13', 'wh-ws-concepcion-ventas', 'CON-V-013', NOW() + INTERVAL '38 days',   3)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
--  PASO 9: Batches — Este
-- ─────────────────────────────────────────────
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b26-est-c-01', 'med-ws-este-01', 'wh-ws-este-central', 'EST-C-001', NOW() + INTERVAL '160 days',  950),
  ('b26-est-c-02', 'med-ws-este-02', 'wh-ws-este-central', 'EST-C-002', NOW() + INTERVAL '180 days',  600),
  ('b26-est-c-03', 'med-ws-este-03', 'wh-ws-este-central', 'EST-C-003', NOW() + INTERVAL '130 days',  380),
  ('b26-est-c-04', 'med-ws-este-04', 'wh-ws-este-central', 'EST-C-004', NOW() + INTERVAL '210 days',  480),
  ('b26-est-c-05', 'med-ws-este-05', 'wh-ws-este-central', 'EST-C-005', NOW() + INTERVAL '100 days',  240),
  ('b26-est-c-06', 'med-ws-este-06', 'wh-ws-este-central', 'EST-C-006', NOW() + INTERVAL '250 days',  330),
  ('b26-est-c-07', 'med-ws-este-07', 'wh-ws-este-central', 'EST-C-007', NOW() + INTERVAL '175 days',  750),
  ('b26-est-c-08', 'med-ws-este-08', 'wh-ws-este-central', 'EST-C-008', NOW() + INTERVAL '125 days',  240),
  ('b26-est-c-09', 'med-ws-este-09', 'wh-ws-este-central', 'EST-C-009', NOW() + INTERVAL '270 days',  270),
  ('b26-est-c-10', 'med-ws-este-10', 'wh-ws-este-central', 'EST-C-010', NOW() + INTERVAL '80 days',   160),
  ('b26-est-c-11', 'med-ws-este-11', 'wh-ws-este-central', 'EST-C-011', NOW() + INTERVAL '200 days',  240),
  ('b26-est-c-12', 'med-ws-este-12', 'wh-ws-este-central', 'EST-C-012', NOW() + INTERVAL '190 days',  200),
  ('b26-est-c-13', 'med-ws-este-13', 'wh-ws-este-central', 'EST-C-013', NOW() + INTERVAL '110 days',  120),
  ('b26-est-c-14', 'med-ws-este-14', 'wh-ws-este-central', 'EST-C-014', NOW() + INTERVAL '60 days',    75),
  ('b26-est-c-15', 'med-ws-este-15', 'wh-ws-este-central', 'EST-C-015', NOW() + INTERVAL '40 days',  2400)
ON CONFLICT DO NOTHING;

INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b26-est-i-01', 'med-ws-este-01', 'wh-ws-este-interna', 'EST-I-001', NOW() + INTERVAL '75 days',  30),
  ('b26-est-i-02', 'med-ws-este-02', 'wh-ws-este-interna', 'EST-I-002', NOW() + INTERVAL '85 days',  25),
  ('b26-est-i-03', 'med-ws-este-03', 'wh-ws-este-interna', 'EST-I-003', NOW() + INTERVAL '55 days',  17),
  ('b26-est-i-04', 'med-ws-este-04', 'wh-ws-este-interna', 'EST-I-004', NOW() + INTERVAL '105 days', 22),
  ('b26-est-i-05', 'med-ws-este-05', 'wh-ws-este-interna', 'EST-I-005', NOW() + INTERVAL '45 days',  12),
  ('b26-est-i-06', 'med-ws-este-06', 'wh-ws-este-interna', 'EST-I-006', NOW() + INTERVAL '125 days', 18),
  ('b26-est-i-07', 'med-ws-este-07', 'wh-ws-este-interna', 'EST-I-007', NOW() + INTERVAL '75 days',  35),
  ('b26-est-i-08', 'med-ws-este-08', 'wh-ws-este-interna', 'EST-I-008', NOW() + INTERVAL '65 days',  15),
  ('b26-est-i-09', 'med-ws-este-09', 'wh-ws-este-interna', 'EST-I-009', NOW() + INTERVAL '145 days', 18),
  ('b26-est-i-10', 'med-ws-este-10', 'wh-ws-este-interna', 'EST-I-010', NOW() + INTERVAL '55 days',  10),
  ('b26-est-i-11', 'med-ws-este-11', 'wh-ws-este-interna', 'EST-I-011', NOW() + INTERVAL '95 days',  15),
  ('b26-est-i-12', 'med-ws-este-12', 'wh-ws-este-interna', 'EST-I-012', NOW() + INTERVAL '90 days',  13),
  ('b26-est-i-13', 'med-ws-este-13', 'wh-ws-este-interna', 'EST-I-013', NOW() + INTERVAL '45 days',   8),
  ('b26-est-i-14', 'med-ws-este-14', 'wh-ws-este-interna', 'EST-I-014', NOW() + INTERVAL '30 days',   6),
  ('b26-est-i-15', 'med-ws-este-15', 'wh-ws-este-interna', 'EST-I-015', NOW() + INTERVAL '12 days', 320)
ON CONFLICT DO NOTHING;

INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b26-est-v-01', 'med-ws-este-01', 'wh-ws-este-ventas', 'EST-V-001', NOW() + INTERVAL '75 days',  16),
  ('b26-est-v-02', 'med-ws-este-02', 'wh-ws-este-ventas', 'EST-V-002', NOW() + INTERVAL '85 days',  12),
  ('b26-est-v-03', 'med-ws-este-03', 'wh-ws-este-ventas', 'EST-V-003', NOW() + INTERVAL '45 days',   7),
  ('b26-est-v-04', 'med-ws-este-04', 'wh-ws-este-ventas', 'EST-V-004', NOW() + INTERVAL '105 days',  9),
  ('b26-est-v-05', 'med-ws-este-05', 'wh-ws-este-ventas', 'EST-V-005', NOW() + INTERVAL '35 days',   4),
  ('b26-est-v-06', 'med-ws-este-06', 'wh-ws-este-ventas', 'EST-V-006', NOW() + INTERVAL '115 days',  7),
  ('b26-est-v-07', 'med-ws-este-07', 'wh-ws-este-ventas', 'EST-V-007', NOW() + INTERVAL '65 days',  14),
  ('b26-est-v-08', 'med-ws-este-08', 'wh-ws-este-ventas', 'EST-V-008', NOW() + INTERVAL '55 days',   6),
  ('b26-est-v-09', 'med-ws-este-09', 'wh-ws-este-ventas', 'EST-V-009', NOW() + INTERVAL '135 days',  7),
  ('b26-est-v-10', 'med-ws-este-10', 'wh-ws-este-ventas', 'EST-V-010', NOW() + INTERVAL '25 days',   3),
  ('b26-est-v-11', 'med-ws-este-11', 'wh-ws-este-ventas', 'EST-V-011', NOW() + INTERVAL '85 days',   6),
  ('b26-est-v-12', 'med-ws-este-12', 'wh-ws-este-ventas', 'EST-V-012', NOW() + INTERVAL '75 days',   5),
  ('b26-est-v-13', 'med-ws-este-13', 'wh-ws-este-ventas', 'EST-V-013', NOW() + INTERVAL '35 days',   3)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
--  PASO 10: Stock Config para nuevos hospitales
-- ─────────────────────────────────────────────
DO $$
DECLARE
  ws_id text;
  wh_c  text;
  wh_i  text;
  wh_v  text;
BEGIN
  FOREACH ws_id IN ARRAY ARRAY['ws-padilla','ws-ninez','ws-mujer','ws-evaperon','ws-concepcion','ws-este'] LOOP
    wh_c := 'wh-' || ws_id || '-central';
    wh_i := 'wh-' || ws_id || '-interna';
    wh_v := 'wh-' || ws_id || '-ventas';

    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock) VALUES
      ( 'med-' || ws_id || '-01', wh_c, 640, 1020),
      ( 'med-' || ws_id || '-02', wh_c, 510,  815),
      ( 'med-' || ws_id || '-03', wh_c, 320,  512),
      ( 'med-' || ws_id || '-04', wh_c, 440,  704),
      ( 'med-' || ws_id || '-05', wh_c, 240,  384),
      ( 'med-' || ws_id || '-06', wh_c, 120,  220),
      ( 'med-' || ws_id || '-07', wh_c, 600,  960),
      ( 'med-' || ws_id || '-08', wh_c,  80,  140),
      ( 'med-' || ws_id || '-09', wh_c,  90,  160),
      ( 'med-' || ws_id || '-10', wh_c, 150,  260),
      ( 'med-' || ws_id || '-11', wh_c,  80,  140),
      ( 'med-' || ws_id || '-12', wh_c,  70,  120),
      ( 'med-' || ws_id || '-13', wh_c,  40,   70),
      ( 'med-' || ws_id || '-14', wh_c,  25,   45),
      ( 'med-' || ws_id || '-15', wh_c, 500,  900),
      ( 'med-' || ws_id || '-01', wh_i, 120, 190),
      ( 'med-' || ws_id || '-02', wh_i, 100, 160),
      ( 'med-' || ws_id || '-03', wh_i,  60,  98),
      ( 'med-' || ws_id || '-04', wh_i,  85, 136),
      ( 'med-' || ws_id || '-05', wh_i,  45,  72),
      ( 'med-' || ws_id || '-06', wh_i,  22,  40),
      ( 'med-' || ws_id || '-07', wh_i, 120, 192),
      ( 'med-' || ws_id || '-08', wh_i,  16,  28),
      ( 'med-' || ws_id || '-09', wh_i,  18,  30),
      ( 'med-' || ws_id || '-10', wh_i,  28,  50),
      ( 'med-' || ws_id || '-11', wh_i,  16,  28),
      ( 'med-' || ws_id || '-12', wh_i,  14,  24),
      ( 'med-' || ws_id || '-13', wh_i,   8,  14),
      ( 'med-' || ws_id || '-14', wh_i,   5,   9),
      ( 'med-' || ws_id || '-15', wh_i,  80, 144),
      ( 'med-' || ws_id || '-01', wh_v,  40,  70),
      ( 'med-' || ws_id || '-02', wh_v,  30,  55),
      ( 'med-' || ws_id || '-03', wh_v,  20,  32),
      ( 'med-' || ws_id || '-04', wh_v,  25,  40),
      ( 'med-' || ws_id || '-05', wh_v,  15,  24),
      ( 'med-' || ws_id || '-06', wh_v,  14,  26),
      ( 'med-' || ws_id || '-07', wh_v,  30,  48),
      ( 'med-' || ws_id || '-08', wh_v,  10,  18),
      ( 'med-' || ws_id || '-09', wh_v,  12,  20),
      ( 'med-' || ws_id || '-10', wh_v,  22,  38),
      ( 'med-' || ws_id || '-11', wh_v,  10,  18),
      ( 'med-' || ws_id || '-12', wh_v,   8,  14)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────
--  PASO 11: Actualizar volume de depósitos
-- ─────────────────────────────────────────────
UPDATE warehouses w
SET volume = COALESCE((
  SELECT SUM(b.quantity) FROM batches b WHERE b.warehouse_id = w.id
), 0)
WHERE w.id IN (
  'wh-aleman-central','wh-aleman-interna','wh-aleman-ventas',
  'wh-fco-central','wh-fco-interna','wh-fco-ventas',
  'wh-blanco-central','wh-blanco-interna','wh-blanco-ventas',
  'wh-ws-padilla-central','wh-ws-padilla-interna','wh-ws-padilla-ventas',
  'wh-ws-ninez-central','wh-ws-ninez-interna','wh-ws-ninez-ventas',
  'wh-ws-mujer-central','wh-ws-mujer-interna','wh-ws-mujer-ventas',
  'wh-ws-evaperon-central','wh-ws-evaperon-interna','wh-ws-evaperon-ventas',
  'wh-ws-concepcion-central','wh-ws-concepcion-interna','wh-ws-concepcion-ventas',
  'wh-ws-este-central','wh-ws-este-interna','wh-ws-este-ventas'
);

-- ─────────────────────────────────────────────
--  VERIFICACIÓN
-- ─────────────────────────────────────────────
DO $$
DECLARE
  total_units bigint;
  ws_count    int;
BEGIN
  SELECT COALESCE(SUM(b.quantity),0) INTO total_units FROM batches b;
  SELECT COUNT(DISTINCT w.workspace_id) INTO ws_count
  FROM batches b
  JOIN warehouses w ON w.id = b.warehouse_id;

  RAISE NOTICE '=== Migración 026 — Resumen ===';
  RAISE NOTICE 'Total unidades sistema: %', total_units;
  RAISE NOTICE 'Workspaces con stock:   %', ws_count;
END $$;
