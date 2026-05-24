-- ============================================================
--  MEDITORY — Migración 023: Reset y Repoblación Demo
--  Borra y reinserta batches + stock_config para los 3 hospitales
--  con números realistas y coherentes para el demo.
--
--  Metas:
--    Pérdida sin transfers:  ~$3.5M ARS
--    Ahorro potencial:       ~$2.5M ARS  (70% de la pérdida)
--    Total unidades:         ~36.900
--    Alemán:  ~31.000  (dominante, sobrestock en meds compartidos)
--    Francisco: ~5.700  (déficit parcial en meds compartidos — redistribución parcial realizada)
--    Blanco:    ~141   (crítico, todo por debajo del mínimo)
--
--  EJECUTAR DESPUÉS de 999_seed_massive_dummy_data.sql y 022_demo_final_data.sql
-- ============================================================

-- ─────────────────────────────────────────────
--  PASO 1: Limpiar batches de los 3 hospitales
-- ─────────────────────────────────────────────
DELETE FROM batches
WHERE warehouse_id IN (
  'wh-aleman-central','wh-aleman-interna','wh-aleman-ventas',
  'wh-fco-central','wh-fco-interna','wh-fco-ventas',
  'wh-blanco-central','wh-blanco-interna','wh-blanco-ventas'
);

-- ─────────────────────────────────────────────
--  PASO 2: Limpiar medication_stock_config
-- ─────────────────────────────────────────────
DELETE FROM medication_stock_config;

-- ─────────────────────────────────────────────
--  PASO 3: Asegurar workspace, depósitos y meds de Hospital Blanco
-- ─────────────────────────────────────────────
INSERT INTO workspaces (id, name, slug)
VALUES
  ('ws-blanco', 'Hospital Blanco', 'HOSPITALBLANCO'),
  ('ws-padilla', 'Hospital Ángel C. Padilla', 'HOSPITALPADILLA'),
  ('ws-ninez', 'Hospital del Niño Jesús', 'HOSPITALNINEZ'),
  ('ws-mujer', 'Hospital de la Mujer', 'HOSPITALMUJER'),
  ('ws-evaperon', 'Hospital Eva Perón', 'HOSPITALEVAPERON'),
  ('ws-concepcion', 'Hospital Regional de Concepción', 'HOSPITALCONCEPCION'),
  ('ws-este', 'Hospital de la Comunidad - Este', 'HOSPITALESTE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO warehouses (id, workspace_id, name, type, unit)
VALUES
  ('wh-blanco-central', 'ws-blanco', 'Depósito Central', 'central', 'Hospital Blanco'),
  ('wh-blanco-interna', 'ws-blanco', 'Farmacia Interna',  'interna', 'Hospital Blanco'),
  ('wh-blanco-ventas',  'ws-blanco', 'Farmacia Ventas',   'ventas',  'Hospital Blanco')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_users (id, workspace_id, name, email, role)
VALUES
  ('u-admin-bla', 'ws-blanco', 'Admin Blanco', 'hospitalblancopadmin@user.com',  'admin'),
  ('u-tec-bla',   'ws-blanco', 'Téc. Blanco',  'hospitalblaocotecnico@user.com', 'tecnico')
ON CONFLICT (id) DO NOTHING;

INSERT INTO medications (id, workspace_id, name, active_ingredient, concentration_value, concentration_unit, form, sale_price, sale_enabled)
VALUES
  ('med-bla-01', 'ws-blanco', 'Paracetamol', 'Paracetamol', 500, 'mg',  'Comprimido', 850,  true),
  ('med-bla-02', 'ws-blanco', 'Ibuprofeno',  'Ibuprofeno',  400, 'mg',  'Comprimido', 1200, true),
  ('med-bla-03', 'ws-blanco', 'Amoxicilina', 'Amoxicilina', 875, 'mg',  'Cápsula',    2500, true),
  ('med-bla-04', 'ws-blanco', 'Omeprazol',   'Omeprazol',   20,  'mg',  'Cápsula',    1500, true),
  ('med-bla-05', 'ws-blanco', 'Salbutamol',  'Salbutamol',  100, 'mcg', 'Aerosol',    3200, true)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
--  PASO 4: BATCHES — Hospital Alemán
--  Diseñado para tener sobrestock en los 6 medicamentos compartidos
--  Surplus objetivo (post-redistribución): Para=400, Ibu=300, Amo=200, Ome=250, Sal=180, Met=880
--  Solución NaCl reducida a 10.456 uds total (Central 8.056 + Interna 2.400)
-- ─────────────────────────────────────────────

-- Depósito Central (almacén principal)
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b23-ale-c-01', 'med-ale-01', 'wh-aleman-central', 'A26-C-001', NOW() + INTERVAL '365 days', 2600),  -- Paracetamol (-400 transferido a Francisco)
  ('b23-ale-c-02', 'med-ale-02', 'wh-aleman-central', 'A26-C-002', NOW() + INTERVAL '420 days', 1900),  -- Ibuprofeno (-300)
  ('b23-ale-c-03', 'med-ale-03', 'wh-aleman-central', 'A26-C-003', NOW() + INTERVAL '300 days', 1500),  -- Amoxicilina (-150)
  ('b23-ale-c-04', 'med-ale-04', 'wh-aleman-central', 'A26-C-004', NOW() + INTERVAL '480 days', 1520),  -- Omeprazol (-200)
  ('b23-ale-c-05', 'med-ale-05', 'wh-aleman-central', 'A26-C-005', NOW() + INTERVAL '240 days',  770),  -- Salbutamol (-100)
  ('b23-ale-c-06', 'med-ale-06', 'wh-aleman-central', 'A26-C-006', NOW() + INTERVAL '400 days',  920),
  ('b23-ale-c-07', 'med-ale-07', 'wh-aleman-central', 'A26-C-007', NOW() + INTERVAL '360 days', 2230),  -- Metformina (-300)
  ('b23-ale-c-08', 'med-ale-08', 'wh-aleman-central', 'A26-C-008', NOW() + INTERVAL '280 days',  680),
  ('b23-ale-c-09', 'med-ale-09', 'wh-aleman-central', 'A26-C-009', NOW() + INTERVAL '540 days',  820),
  ('b23-ale-c-10', 'med-ale-10', 'wh-aleman-central', 'A26-C-010', NOW() + INTERVAL '180 days',  480),
  ('b23-ale-c-11', 'med-ale-11', 'wh-aleman-central', 'A26-C-011', NOW() + INTERVAL '420 days',  690),
  ('b23-ale-c-12', 'med-ale-12', 'wh-aleman-central', 'A26-C-012', NOW() + INTERVAL '380 days',  760),
  ('b23-ale-c-13', 'med-ale-13', 'wh-aleman-central', 'A26-C-013', NOW() + INTERVAL '120 days',  420),
  ('b23-ale-c-14', 'med-ale-14', 'wh-aleman-central', 'A26-C-014', NOW() + INTERVAL '90 days',   280),
  ('b23-ale-c-15', 'med-ale-15', 'wh-aleman-central', 'A26-C-015', NOW() + INTERVAL '60 days',  8056);  -- NaCl: 8.056 Central + 2.400 Interna = 10.456 total

-- Lotes extra con vencimientos variados (para sección vencimientos)
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b23-ale-c-x1', 'med-ale-01', 'wh-aleman-central', 'A26-C-001B', NOW() + INTERVAL '18 days',  200),
  ('b23-ale-c-x2', 'med-ale-13', 'wh-aleman-central', 'A26-C-013B', NOW() - INTERVAL '5 days',    45),
  ('b23-ale-c-x3', 'med-ale-14', 'wh-aleman-central', 'A26-C-014B', NOW() + INTERVAL '8 days',    30),
  ('b23-ale-c-x4', 'med-ale-05', 'wh-aleman-central', 'A26-C-005B', NOW() + INTERVAL '22 days',  130);

-- Farmacia Interna
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b23-ale-i-01', 'med-ale-01', 'wh-aleman-interna', 'A26-I-001', NOW() + INTERVAL '200 days',  600),
  ('b23-ale-i-02', 'med-ale-02', 'wh-aleman-interna', 'A26-I-002', NOW() + INTERVAL '230 days',  440),
  ('b23-ale-i-03', 'med-ale-03', 'wh-aleman-interna', 'A26-I-003', NOW() + INTERVAL '150 days',  330),
  ('b23-ale-i-04', 'med-ale-04', 'wh-aleman-interna', 'A26-I-004', NOW() + INTERVAL '260 days',  340),
  ('b23-ale-i-05', 'med-ale-05', 'wh-aleman-interna', 'A26-I-005', NOW() + INTERVAL '120 days',  170),
  ('b23-ale-i-06', 'med-ale-06', 'wh-aleman-interna', 'A26-I-006', NOW() + INTERVAL '200 days',  180),
  ('b23-ale-i-07', 'med-ale-07', 'wh-aleman-interna', 'A26-I-007', NOW() + INTERVAL '190 days',  500),
  ('b23-ale-i-08', 'med-ale-08', 'wh-aleman-interna', 'A26-I-008', NOW() + INTERVAL '140 days',  135),
  ('b23-ale-i-09', 'med-ale-09', 'wh-aleman-interna', 'A26-I-009', NOW() + INTERVAL '280 days',  160),
  ('b23-ale-i-10', 'med-ale-10', 'wh-aleman-interna', 'A26-I-010', NOW() + INTERVAL '90 days',    95),
  ('b23-ale-i-11', 'med-ale-11', 'wh-aleman-interna', 'A26-I-011', NOW() + INTERVAL '210 days',  135),
  ('b23-ale-i-12', 'med-ale-12', 'wh-aleman-interna', 'A26-I-012', NOW() + INTERVAL '195 days',  150),
  ('b23-ale-i-13', 'med-ale-13', 'wh-aleman-interna', 'A26-I-013', NOW() + INTERVAL '60 days',    85),
  ('b23-ale-i-14', 'med-ale-14', 'wh-aleman-interna', 'A26-I-014', NOW() + INTERVAL '45 days',    55),
  ('b23-ale-i-15', 'med-ale-15', 'wh-aleman-interna', 'A26-I-015', NOW() + INTERVAL '30 days',  2400);

-- Farmacia Ventas (solo sale_enabled = med-ale-01..13)
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b23-ale-v-01', 'med-ale-01', 'wh-aleman-ventas', 'A26-V-001', NOW() + INTERVAL '180 days',  200),
  ('b23-ale-v-02', 'med-ale-02', 'wh-aleman-ventas', 'A26-V-002', NOW() + INTERVAL '210 days',  160),
  ('b23-ale-v-03', 'med-ale-03', 'wh-aleman-ventas', 'A26-V-003', NOW() + INTERVAL '120 days',  120),
  ('b23-ale-v-04', 'med-ale-04', 'wh-aleman-ventas', 'A26-V-004', NOW() + INTERVAL '240 days',  140),
  ('b23-ale-v-05', 'med-ale-05', 'wh-aleman-ventas', 'A26-V-005', NOW() + INTERVAL '90 days',    60),
  ('b23-ale-v-06', 'med-ale-06', 'wh-aleman-ventas', 'A26-V-006', NOW() + INTERVAL '180 days',   70),
  ('b23-ale-v-07', 'med-ale-07', 'wh-aleman-ventas', 'A26-V-007', NOW() + INTERVAL '160 days',  170),
  ('b23-ale-v-08', 'med-ale-08', 'wh-aleman-ventas', 'A26-V-008', NOW() + INTERVAL '100 days',   55),
  ('b23-ale-v-09', 'med-ale-09', 'wh-aleman-ventas', 'A26-V-009', NOW() + INTERVAL '200 days',   65),
  ('b23-ale-v-10', 'med-ale-10', 'wh-aleman-ventas', 'A26-V-010', NOW() + INTERVAL '70 days',    40),
  ('b23-ale-v-11', 'med-ale-11', 'wh-aleman-ventas', 'A26-V-011', NOW() + INTERVAL '190 days',   55),
  ('b23-ale-v-12', 'med-ale-12', 'wh-aleman-ventas', 'A26-V-012', NOW() + INTERVAL '170 days',   60),
  ('b23-ale-v-13', 'med-ale-13', 'wh-aleman-ventas', 'A26-V-013', NOW() + INTERVAL '50 days',    35);

-- ─────────────────────────────────────────────
--  PASO 5: BATCHES — Hospital Francisco
--  Meds compartidos: recibieron transferencias parciales de Alemán → stock más visible pero sigue
--  por debajo del mínimo configurado (para mantener el déficit del demo)
--  Meds propios: stock normal
-- ─────────────────────────────────────────────

-- Depósito Central Francisco
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  -- Compartidos (stock post-transferencia, aún en déficit)
  ('b23-fco-c-01', 'med-fco-01', 'wh-fco-central', 'F26-C-001', NOW() + INTERVAL '180 days',  570),  -- Paracetamol (+400 de Alemán)
  ('b23-fco-c-02', 'med-fco-02', 'wh-fco-central', 'F26-C-002', NOW() + INTERVAL '200 days',  410),  -- Ibuprofeno (+300)
  ('b23-fco-c-03', 'med-fco-03', 'wh-fco-central', 'F26-C-003', NOW() + INTERVAL '120 days',  245),  -- Amoxicilina (+150)
  ('b23-fco-c-04', 'med-fco-04', 'wh-fco-central', 'F26-C-004', NOW() + INTERVAL '240 days',  340),  -- Omeprazol (+200)
  ('b23-fco-c-05', 'med-fco-05', 'wh-fco-central', 'F26-C-005', NOW() + INTERVAL '90 days',   165),  -- Salbutamol (+100)
  ('b23-fco-c-07', 'med-fco-07', 'wh-fco-central', 'F26-C-007', NOW() + INTERVAL '160 days',  380),  -- Metformina (+300)
  -- Propios (stock razonable)
  ('b23-fco-c-06', 'med-fco-06', 'wh-fco-central', 'F26-C-006', NOW() + INTERVAL '300 days',  280),
  ('b23-fco-c-08', 'med-fco-08', 'wh-fco-central', 'F26-C-008', NOW() + INTERVAL '140 days',  180),
  ('b23-fco-c-09', 'med-fco-09', 'wh-fco-central', 'F26-C-009', NOW() + INTERVAL '360 days',  220),
  ('b23-fco-c-10', 'med-fco-10', 'wh-fco-central', 'F26-C-010', NOW() + INTERVAL '280 days',  350),
  ('b23-fco-c-11', 'med-fco-11', 'wh-fco-central', 'F26-C-011', NOW() + INTERVAL '320 days',  180),
  ('b23-fco-c-12', 'med-fco-12', 'wh-fco-central', 'F26-C-012', NOW() + INTERVAL '240 days',  160),
  ('b23-fco-c-13', 'med-fco-13', 'wh-fco-central', 'F26-C-013', NOW() + INTERVAL '180 days',   95),
  ('b23-fco-c-14', 'med-fco-14', 'wh-fco-central', 'F26-C-014', NOW() + INTERVAL '120 days',   65),
  ('b23-fco-c-15', 'med-fco-15', 'wh-fco-central', 'F26-C-015', NOW() + INTERVAL '45 days',  1200);

-- Lotes con vencimiento próximo Francisco
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b23-fco-c-x1', 'med-fco-03', 'wh-fco-central', 'F26-C-003B', NOW() + INTERVAL '12 days',  15),
  ('b23-fco-c-x2', 'med-fco-15', 'wh-fco-central', 'F26-C-015B', NOW() - INTERVAL '3 days',   80);

-- Farmacia Interna Francisco
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b23-fco-i-01', 'med-fco-01', 'wh-fco-interna', 'F26-I-001', NOW() + INTERVAL '90 days',   20),
  ('b23-fco-i-02', 'med-fco-02', 'wh-fco-interna', 'F26-I-002', NOW() + INTERVAL '100 days',  20),
  ('b23-fco-i-03', 'med-fco-03', 'wh-fco-interna', 'F26-I-003', NOW() + INTERVAL '60 days',   18),
  ('b23-fco-i-04', 'med-fco-04', 'wh-fco-interna', 'F26-I-004', NOW() + INTERVAL '120 days',  22),
  ('b23-fco-i-05', 'med-fco-05', 'wh-fco-interna', 'F26-I-005', NOW() + INTERVAL '45 days',   12),
  ('b23-fco-i-06', 'med-fco-06', 'wh-fco-interna', 'F26-I-006', NOW() + INTERVAL '150 days',  55),
  ('b23-fco-i-07', 'med-fco-07', 'wh-fco-interna', 'F26-I-007', NOW() + INTERVAL '80 days',   15),
  ('b23-fco-i-08', 'med-fco-08', 'wh-fco-interna', 'F26-I-008', NOW() + INTERVAL '70 days',   35),
  ('b23-fco-i-09', 'med-fco-09', 'wh-fco-interna', 'F26-I-009', NOW() + INTERVAL '180 days',  40),
  ('b23-fco-i-10', 'med-fco-10', 'wh-fco-interna', 'F26-I-010', NOW() + INTERVAL '130 days',  70),
  ('b23-fco-i-11', 'med-fco-11', 'wh-fco-interna', 'F26-I-011', NOW() + INTERVAL '160 days',  35),
  ('b23-fco-i-12', 'med-fco-12', 'wh-fco-interna', 'F26-I-012', NOW() + INTERVAL '120 days',  30),
  ('b23-fco-i-13', 'med-fco-13', 'wh-fco-interna', 'F26-I-013', NOW() + INTERVAL '90 days',   20),
  ('b23-fco-i-14', 'med-fco-14', 'wh-fco-interna', 'F26-I-014', NOW() + INTERVAL '60 days',   12),
  ('b23-fco-i-15', 'med-fco-15', 'wh-fco-interna', 'F26-I-015', NOW() + INTERVAL '20 days',  180);

-- Farmacia Ventas Francisco (fco-01..12 tienen sale_enabled=true)
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b23-fco-v-01', 'med-fco-01', 'wh-fco-ventas', 'F26-V-001', NOW() + INTERVAL '60 days',  10),
  ('b23-fco-v-02', 'med-fco-02', 'wh-fco-ventas', 'F26-V-002', NOW() + INTERVAL '70 days',  10),
  ('b23-fco-v-03', 'med-fco-03', 'wh-fco-ventas', 'F26-V-003', NOW() + INTERVAL '40 days',   7),
  ('b23-fco-v-04', 'med-fco-04', 'wh-fco-ventas', 'F26-V-004', NOW() + INTERVAL '80 days',   8),
  ('b23-fco-v-05', 'med-fco-05', 'wh-fco-ventas', 'F26-V-005', NOW() + INTERVAL '30 days',   3),
  ('b23-fco-v-06', 'med-fco-06', 'wh-fco-ventas', 'F26-V-006', NOW() + INTERVAL '150 days', 35),
  ('b23-fco-v-07', 'med-fco-07', 'wh-fco-ventas', 'F26-V-007', NOW() + INTERVAL '50 days',   5),
  ('b23-fco-v-08', 'med-fco-08', 'wh-fco-ventas', 'F26-V-008', NOW() + INTERVAL '60 days',  25),
  ('b23-fco-v-09', 'med-fco-09', 'wh-fco-ventas', 'F26-V-009', NOW() + INTERVAL '130 days', 30),
  ('b23-fco-v-10', 'med-fco-10', 'wh-fco-ventas', 'F26-V-010', NOW() + INTERVAL '110 days', 50),
  ('b23-fco-v-11', 'med-fco-11', 'wh-fco-ventas', 'F26-V-011', NOW() + INTERVAL '140 days', 25),
  ('b23-fco-v-12', 'med-fco-12', 'wh-fco-ventas', 'F26-V-012', NOW() + INTERVAL '90 days',  20);

-- ─────────────────────────────────────────────
--  PASO 6: BATCHES — Hospital Blanco
--  Stock casi nulo en todo — para contraste visual
-- ─────────────────────────────────────────────
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  -- Central (mínimo)
  ('b23-bla-c-01', 'med-bla-01', 'wh-blanco-central', 'B26-C-001', NOW() + INTERVAL '30 days',  50),
  ('b23-bla-c-02', 'med-bla-02', 'wh-blanco-central', 'B26-C-002', NOW() + INTERVAL '45 days',  30),
  ('b23-bla-c-03', 'med-bla-03', 'wh-blanco-central', 'B26-C-003', NOW() + INTERVAL '20 days',   0),
  ('b23-bla-c-04', 'med-bla-04', 'wh-blanco-central', 'B26-C-004', NOW() + INTERVAL '60 days',  20),
  ('b23-bla-c-05', 'med-bla-05', 'wh-blanco-central', 'B26-C-005', NOW() + INTERVAL '15 days',  10),
  -- Interna (mínimo)
  ('b23-bla-i-01', 'med-bla-01', 'wh-blanco-interna', 'B26-I-001', NOW() + INTERVAL '14 days',  12),
  ('b23-bla-i-02', 'med-bla-02', 'wh-blanco-interna', 'B26-I-002', NOW() + INTERVAL '10 days',   7),
  ('b23-bla-i-03', 'med-bla-03', 'wh-blanco-interna', 'B26-I-003', NOW() + INTERVAL '8 days',    0),
  ('b23-bla-i-04', 'med-bla-04', 'wh-blanco-interna', 'B26-I-004', NOW() + INTERVAL '20 days',   8),
  ('b23-bla-i-05', 'med-bla-05', 'wh-blanco-interna', 'B26-I-005', NOW() + INTERVAL '5 days',    4),
  -- Ventas (vacío)
  ('b23-bla-v-01', 'med-bla-01', 'wh-blanco-ventas',  'B26-V-001', NOW() + INTERVAL '30 days',   0),
  ('b23-bla-v-02', 'med-bla-02', 'wh-blanco-ventas',  'B26-V-002', NOW() + INTERVAL '30 days',   0),
  ('b23-bla-v-03', 'med-bla-03', 'wh-blanco-ventas',  'B26-V-003', NOW() + INTERVAL '30 days',   0),
  ('b23-bla-v-04', 'med-bla-04', 'wh-blanco-ventas',  'B26-V-004', NOW() + INTERVAL '30 days',   0),
  ('b23-bla-v-05', 'med-bla-05', 'wh-blanco-ventas',  'B26-V-005', NOW() + INTERVAL '30 days',   0);

-- ─────────────────────────────────────────────
--  PASO 7: MEDICATION STOCK CONFIG
--  Valores diseñados para producir los números del demo
-- ─────────────────────────────────────────────

-- ── ALEMÁN CENTRAL ──
-- Paracetamol: actual=3200, opt=2380 → Central surplus=820
-- Ibuprofeno:  actual=2200, opt=1745 → surplus=455
-- etc. (surplus total por med = suma de los 3 depósitos)
INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock) VALUES
  ('med-ale-01', 'wh-aleman-central', 1430, 2380),  -- Paracetamol
  ('med-ale-02', 'wh-aleman-central', 1050, 1745),  -- Ibuprofeno
  ('med-ale-03', 'wh-aleman-central',  830, 1380),  -- Amoxicilina
  ('med-ale-04', 'wh-aleman-central',  830, 1380),  -- Omeprazol
  ('med-ale-05', 'wh-aleman-central',  390,  645),  -- Salbutamol
  ('med-ale-06', 'wh-aleman-central',  400,  700),  -- Enalapril
  ('med-ale-07', 'wh-aleman-central',  960, 1595),  -- Metformina
  ('med-ale-08', 'wh-aleman-central',  300,  500),  -- Diclofenac
  ('med-ale-09', 'wh-aleman-central',  400,  650),  -- Loratadina
  ('med-ale-10', 'wh-aleman-central',  200,  350),  -- Dexametasona
  ('med-ale-11', 'wh-aleman-central',  300,  550),  -- Atorvastatina
  ('med-ale-12', 'wh-aleman-central',  360,  600),  -- Losartán
  ('med-ale-13', 'wh-aleman-central',  150,  280),  -- Ceftriaxona
  ('med-ale-14', 'wh-aleman-central',  100,  200),  -- Heparina
  ('med-ale-15', 'wh-aleman-central', 8000, 15000); -- Solución NaCl

-- ── ALEMÁN INTERNA ──
INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock) VALUES
  ('med-ale-01', 'wh-aleman-interna', 285, 475),
  ('med-ale-02', 'wh-aleman-interna', 210, 345),
  ('med-ale-03', 'wh-aleman-interna', 165, 280),
  ('med-ale-04', 'wh-aleman-interna', 165, 280),
  ('med-ale-05', 'wh-aleman-interna',  78, 130),
  ('med-ale-06', 'wh-aleman-interna',  80, 130),
  ('med-ale-07', 'wh-aleman-interna', 190, 320),
  ('med-ale-08', 'wh-aleman-interna',  60, 100),
  ('med-ale-09', 'wh-aleman-interna',  75, 130),
  ('med-ale-10', 'wh-aleman-interna',  40,  70),
  ('med-ale-11', 'wh-aleman-interna',  60, 100),
  ('med-ale-12', 'wh-aleman-interna',  70, 110),
  ('med-ale-13', 'wh-aleman-interna',  35,  60),
  ('med-ale-14', 'wh-aleman-interna',  20,  40),
  ('med-ale-15', 'wh-aleman-interna', 1000, 2000);

-- ── ALEMÁN VENTAS ──
INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock) VALUES
  ('med-ale-01', 'wh-aleman-ventas',  85, 145),
  ('med-ale-02', 'wh-aleman-ventas',  67, 110),
  ('med-ale-03', 'wh-aleman-ventas',  50,  90),
  ('med-ale-04', 'wh-aleman-ventas',  50,  90),
  ('med-ale-05', 'wh-aleman-ventas',  25,  45),
  ('med-ale-06', 'wh-aleman-ventas',  30,  50),
  ('med-ale-07', 'wh-aleman-ventas',  65, 105),
  ('med-ale-08', 'wh-aleman-ventas',  25,  40),
  ('med-ale-09', 'wh-aleman-ventas',  30,  50),
  ('med-ale-10', 'wh-aleman-ventas',  15,  30),
  ('med-ale-11', 'wh-aleman-ventas',  25,  40),
  ('med-ale-12', 'wh-aleman-ventas',  25,  45),
  ('med-ale-13', 'wh-aleman-ventas',  12,  25);

-- Verificación surplus Alemán post-redistribución (comentario para referencia):
-- Paracetamol: (2600+600+200) - (2380+475+145) = 3400 - 3000 = 400
-- Ibuprofeno:  (1900+440+160) - (1745+345+110) = 2500 - 2200 = 300
-- Amoxicilina: (1500+330+120) - (1380+280+90)  = 1950 - 1750 = 200
-- Omeprazol:   (1520+340+140) - (1380+280+90)  = 2000 - 1750 = 250
-- Salbutamol:  (770+170+60)   - (645+130+45)   = 1000 -  820 = 180
-- Metformina:  (2230+500+170) - (1595+320+105) = 2900 - 2020 = 880

-- ── FRANCISCO CENTRAL ──
-- Config: min > actual (genera déficit)
INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock) VALUES
  ('med-fco-01', 'wh-fco-central',  640, 1020),  -- Paracetamol: actual=170, min=640 → déficit=470
  ('med-fco-02', 'wh-fco-central',  510,  815),  -- Ibuprofeno:  actual=110, min=510 → déficit=400
  ('med-fco-03', 'wh-fco-central',  320,  512),  -- Amoxicilina: actual=95,  min=320 → déficit=225
  ('med-fco-04', 'wh-fco-central',  440,  704),  -- Omeprazol:   actual=140, min=440 → déficit=300
  ('med-fco-05', 'wh-fco-central',  240,  384),  -- Salbutamol:  actual=65,  min=240 → déficit=175
  ('med-fco-06', 'wh-fco-central',  120,  220),  -- Clonazepam (propio, stock OK)
  ('med-fco-07', 'wh-fco-central',  600,  960),  -- Metformina:  actual=80,  min=600 → déficit=520
  ('med-fco-08', 'wh-fco-central',   80,  140),
  ('med-fco-09', 'wh-fco-central',   90,  160),
  ('med-fco-10', 'wh-fco-central',  150,  260),
  ('med-fco-11', 'wh-fco-central',   80,  140),
  ('med-fco-12', 'wh-fco-central',   70,  120),
  ('med-fco-13', 'wh-fco-central',   40,   70),
  ('med-fco-14', 'wh-fco-central',   25,   45),
  ('med-fco-15', 'wh-fco-central',  500,  900);

-- ── FRANCISCO INTERNA ──
INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock) VALUES
  ('med-fco-01', 'wh-fco-interna', 120, 190),
  ('med-fco-02', 'wh-fco-interna', 100, 160),
  ('med-fco-03', 'wh-fco-interna',  60,  98),
  ('med-fco-04', 'wh-fco-interna',  85, 136),
  ('med-fco-05', 'wh-fco-interna',  45,  72),
  ('med-fco-06', 'wh-fco-interna',  22,  40),
  ('med-fco-07', 'wh-fco-interna', 120, 192),
  ('med-fco-08', 'wh-fco-interna',  16,  28),
  ('med-fco-09', 'wh-fco-interna',  18,  30),
  ('med-fco-10', 'wh-fco-interna',  28,  50),
  ('med-fco-11', 'wh-fco-interna',  16,  28),
  ('med-fco-12', 'wh-fco-interna',  14,  24),
  ('med-fco-13', 'wh-fco-interna',   8,  14),
  ('med-fco-14', 'wh-fco-interna',   5,   9),
  ('med-fco-15', 'wh-fco-interna',  80, 144);

-- ── FRANCISCO VENTAS ──
INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock) VALUES
  ('med-fco-01', 'wh-fco-ventas', 40,  70),
  ('med-fco-02', 'wh-fco-ventas', 30,  55),
  ('med-fco-03', 'wh-fco-ventas', 20,  32),
  ('med-fco-04', 'wh-fco-ventas', 25,  40),
  ('med-fco-05', 'wh-fco-ventas', 15,  24),
  ('med-fco-06', 'wh-fco-ventas', 14,  26),
  ('med-fco-07', 'wh-fco-ventas', 30,  48),
  ('med-fco-08', 'wh-fco-ventas', 10,  18),
  ('med-fco-09', 'wh-fco-ventas', 12,  20),
  ('med-fco-10', 'wh-fco-ventas', 22,  38),
  ('med-fco-11', 'wh-fco-ventas', 10,  18),
  ('med-fco-12', 'wh-fco-ventas',  8,  14);

-- ── HOSPITAL BLANCO ──
-- Config: min MUY alto respecto al stock actual → todo en rojo
INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock) VALUES
  ('med-bla-01', 'wh-blanco-central', 510, 765),
  ('med-bla-02', 'wh-blanco-central', 310, 464),
  ('med-bla-03', 'wh-blanco-central', 224, 336),
  ('med-bla-04', 'wh-blanco-central', 245, 368),
  ('med-bla-05', 'wh-blanco-central', 187, 280);

INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock) VALUES
  ('med-bla-01', 'wh-blanco-interna', 100, 150),
  ('med-bla-02', 'wh-blanco-interna',  60,  90),
  ('med-bla-03', 'wh-blanco-interna',  44,  66),
  ('med-bla-04', 'wh-blanco-interna',  48,  72),
  ('med-bla-05', 'wh-blanco-interna',  37,  55);

INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock) VALUES
  ('med-bla-01', 'wh-blanco-ventas', 30, 45),
  ('med-bla-02', 'wh-blanco-ventas', 17, 26),
  ('med-bla-03', 'wh-blanco-ventas', 12, 18),
  ('med-bla-04', 'wh-blanco-ventas', 15, 22),
  ('med-bla-05', 'wh-blanco-ventas', 10, 15);

-- ─────────────────────────────────────────────
--  PASO 8: CAPACIDADES DE DEPÓSITOS
--  Ocupación diseñada: Alemán ~85%, Francisco ~65%, Blanco ~4%
-- ─────────────────────────────────────────────
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS volume decimal(10,2) DEFAULT 0;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS max_capacity decimal(10,2) DEFAULT 1000;

UPDATE warehouses SET max_capacity = 28000 WHERE id = 'wh-aleman-central';  -- ~85% ocupación post-redistribución
UPDATE warehouses SET max_capacity =  8000 WHERE id = 'wh-aleman-interna';
UPDATE warehouses SET max_capacity =  2000 WHERE id = 'wh-aleman-ventas';
UPDATE warehouses SET max_capacity =  5000 WHERE id = 'wh-fco-central';
UPDATE warehouses SET max_capacity =  1000 WHERE id = 'wh-fco-interna';
UPDATE warehouses SET max_capacity =   800 WHERE id = 'wh-fco-ventas';
UPDATE warehouses SET max_capacity =  3000 WHERE id = 'wh-blanco-central';
UPDATE warehouses SET max_capacity =  1500 WHERE id = 'wh-blanco-interna';
UPDATE warehouses SET max_capacity =   500 WHERE id = 'wh-blanco-ventas';

-- Recalcular volume = suma de stock actual en cada depósito
UPDATE warehouses w
SET volume = COALESCE((
  SELECT SUM(b.quantity) FROM batches b WHERE b.warehouse_id = w.id
), 0)
WHERE id IN (
  'wh-aleman-central','wh-aleman-interna','wh-aleman-ventas',
  'wh-fco-central','wh-fco-interna','wh-fco-ventas',
  'wh-blanco-central','wh-blanco-interna','wh-blanco-ventas'
);

-- ─────────────────────────────────────────────
--  PASO 9: MOVIMIENTOS históricos Hospital Blanco
--  (para que el consumo histórico tenga datos)
-- ─────────────────────────────────────────────
DELETE FROM movements WHERE workspace_id = 'ws-blanco';

INSERT INTO movements (id, workspace_id, type, medication_id, warehouse_id, quantity, user_name, reason, date)
VALUES
  ('m23-bla-01','ws-blanco','ingreso',      'med-bla-01','wh-blanco-central',  80, 'Admin Blanco', 'Compra OC-0041', NOW()-INTERVAL '28 days'),
  ('m23-bla-02','ws-blanco','egreso',       'med-bla-01','wh-blanco-central', -18, 'Admin Blanco', 'Consumo UCI',    NOW()-INTERVAL '20 days'),
  ('m23-bla-03','ws-blanco','egreso',       'med-bla-01','wh-blanco-central', -12, 'Admin Blanco', 'Consumo UCI',    NOW()-INTERVAL '12 days'),
  ('m23-bla-04','ws-blanco','ingreso',      'med-bla-02','wh-blanco-central',  40, 'Admin Blanco', 'Compra OC-0042', NOW()-INTERVAL '26 days'),
  ('m23-bla-05','ws-blanco','egreso',       'med-bla-02','wh-blanco-central', -10, 'Admin Blanco', 'Consumo',        NOW()-INTERVAL '18 days'),
  ('m23-bla-06','ws-blanco','ingreso',      'med-bla-04','wh-blanco-central',  35, 'Admin Blanco', 'Compra OC-0043', NOW()-INTERVAL '30 days'),
  ('m23-bla-07','ws-blanco','egreso',       'med-bla-04','wh-blanco-central',  -7, 'Téc. Blanco',  'Dispensación',   NOW()-INTERVAL '8 days'),
  ('m23-bla-08','ws-blanco','dispensacion', 'med-bla-01','wh-blanco-interna',  -5, 'Téc. Blanco',  'Paciente #1',    NOW()-INTERVAL '4 days'),
  ('m23-bla-09','ws-blanco','dispensacion', 'med-bla-02','wh-blanco-interna',  -3, 'Téc. Blanco',  'Paciente #2',    NOW()-INTERVAL '2 days'),
  ('m23-bla-10','ws-blanco','dispensacion', 'med-bla-05','wh-blanco-interna',  -2, 'Téc. Blanco',  'Paciente #3',    NOW()-INTERVAL '1 day')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
--  VERIFICACIÓN FINAL
-- ─────────────────────────────────────────────
DO $$
DECLARE
  total_units  bigint;
  ale_units    bigint;
  fco_units    bigint;
  bla_units    bigint;
  cfg_count    int;
BEGIN
  SELECT COALESCE(SUM(b.quantity),0) INTO total_units FROM batches b
    JOIN warehouses w ON w.id = b.warehouse_id
    WHERE w.workspace_id IN ('ws-aleman','ws-francisco','ws-blanco');

  SELECT COALESCE(SUM(b.quantity),0) INTO ale_units FROM batches b
    JOIN warehouses w ON w.id = b.warehouse_id WHERE w.workspace_id = 'ws-aleman';

  SELECT COALESCE(SUM(b.quantity),0) INTO fco_units FROM batches b
    JOIN warehouses w ON w.id = b.warehouse_id WHERE w.workspace_id = 'ws-francisco';

  SELECT COALESCE(SUM(b.quantity),0) INTO bla_units FROM batches b
    JOIN warehouses w ON w.id = b.warehouse_id WHERE w.workspace_id = 'ws-blanco';

  SELECT COUNT(*) INTO cfg_count FROM medication_stock_config;

  RAISE NOTICE '=== DEMO 023 — Resumen ===';
  RAISE NOTICE 'Total unidades sistema: %', total_units;
  RAISE NOTICE '  Hospital Alemán:       % (objetivo: ~31.000)', ale_units;
  RAISE NOTICE '  Hospital Francisco:    % (objetivo: ~5.700 post-redistribución)',  fco_units;
  RAISE NOTICE '  Hospital Blanco:       % (objetivo: ~141)',    bla_units;
  RAISE NOTICE 'Configs stock min/opt:  %', cfg_count;
  RAISE NOTICE 'NaCl Alemán Central: 8.056 + Interna 2.400 = 10.456 total';
  RAISE NOTICE 'Pérdida esperada:  ~$3.5M ARS (surplus reducido por redistribución)';
  RAISE NOTICE 'Ahorro esperado:   ~$2.5M ARS (~70%%)';
  RAISE NOTICE 'Francisco sigue en déficit pero con stock visible para el demo';
END $$;
