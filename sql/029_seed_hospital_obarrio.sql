-- ============================================================
--  MEDITORY — Migración 029: Hospital Obarrio
--  Solo tablas visibles en backoffice:
--    workspaces · warehouses · workspace_users
--    workspace_user_warehouses · medications · batches
--    medication_stock_config
--
--  Escenario: stock sano en todo (sin déficit ni sobrestock),
--  solo NaCl con leve superávit → aparece en sugerencias
--  como proveedor para hospitales con déficit de solución.
--
--  EJECUTAR DESPUÉS de 028_seed_missing_medications.sql
-- ============================================================

-- ─────────────────────────────────────────────
--  1. WORKSPACE
-- ─────────────────────────────────────────────
INSERT INTO workspaces (id, name, slug)
VALUES ('ws-obarrio', 'Hospital Obarrio', 'HOSPITALOBARRIO')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
--  2. DEPÓSITOS
-- ─────────────────────────────────────────────
INSERT INTO warehouses (id, workspace_id, name, type, unit) VALUES
  ('wh-ws-obarrio-central', 'ws-obarrio', 'Depósito Central', 'central', 'Hospital Obarrio'),
  ('wh-ws-obarrio-interna',  'ws-obarrio', 'Farmacia Interna',  'interna',  'Hospital Obarrio'),
  ('wh-ws-obarrio-ventas',   'ws-obarrio', 'Farmacia Ventas',   'ventas',   'Hospital Obarrio')
ON CONFLICT (id) DO NOTHING;

UPDATE warehouses SET max_capacity = 8000 WHERE id = 'wh-ws-obarrio-central';
UPDATE warehouses SET max_capacity = 3000 WHERE id = 'wh-ws-obarrio-interna';
UPDATE warehouses SET max_capacity = 1500 WHERE id = 'wh-ws-obarrio-ventas';

-- ─────────────────────────────────────────────
--  3. USUARIOS
-- ─────────────────────────────────────────────
INSERT INTO workspace_users (id, workspace_id, name, email, role) VALUES
  ('u-admin-oba', 'ws-obarrio', 'Admin Obarrio',   'admin@hospitalobarrio.gob.ar',   'admin'),
  ('u-ven-oba',   'ws-obarrio', 'Ventas Obarrio',  'ventas@hospitalobarrio.gob.ar',  'ventas'),
  ('u-doc-oba',   'ws-obarrio', 'Dr. Obarrio',     'medico@hospitalobarrio.gob.ar',  'doctor'),
  ('u-tec-oba',   'ws-obarrio', 'Tec. Obarrio',    'tecnico@hospitalobarrio.gob.ar', 'tecnico')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
--  4. ACCESOS USUARIO → DEPÓSITO
-- ─────────────────────────────────────────────
-- Admin: todos los depósitos
INSERT INTO workspace_user_warehouses (user_id, warehouse_id)
SELECT u.id, w.id
FROM workspace_users u
JOIN warehouses w ON w.workspace_id = u.workspace_id
WHERE u.id = 'u-admin-oba'
ON CONFLICT DO NOTHING;

-- Ventas: solo ventas
INSERT INTO workspace_user_warehouses (user_id, warehouse_id)
VALUES ('u-ven-oba', 'wh-ws-obarrio-ventas')
ON CONFLICT DO NOTHING;

-- Doctor: solo interna
INSERT INTO workspace_user_warehouses (user_id, warehouse_id)
VALUES ('u-doc-oba', 'wh-ws-obarrio-interna')
ON CONFLICT DO NOTHING;

-- Técnico: central + interna
INSERT INTO workspace_user_warehouses (user_id, warehouse_id) VALUES
  ('u-tec-oba', 'wh-ws-obarrio-central'),
  ('u-tec-oba', 'wh-ws-obarrio-interna')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
--  5. MEDICAMENTOS (18 — nombres idénticos a Alemán)
--  Nombres exactos necesarios para matching cross-hospital
-- ─────────────────────────────────────────────
INSERT INTO medications (id, workspace_id, name, active_ingredient, concentration_value, concentration_unit, form, sale_price, sale_enabled) VALUES
  ('med-ws-obarrio-01', 'ws-obarrio', 'Paracetamol',   'Paracetamol',      500, 'mg',     'Comprimido',  850, true),
  ('med-ws-obarrio-02', 'ws-obarrio', 'Ibuprofeno',    'Ibuprofeno',       400, 'mg',     'Comprimido', 1200, true),
  ('med-ws-obarrio-03', 'ws-obarrio', 'Amoxicilina',   'Amoxicilina',      500, 'mg',     'Cápsula',    2500, true),
  ('med-ws-obarrio-04', 'ws-obarrio', 'Omeprazol',     'Omeprazol',         20, 'mg',     'Cápsula',    1500, true),
  ('med-ws-obarrio-05', 'ws-obarrio', 'Salbutamol',    'Salbutamol',       100, 'mcg',    'Aerosol',    3200, true),
  ('med-ws-obarrio-06', 'ws-obarrio', 'Enalapril',     'Enalapril',         10, 'mg',     'Comprimido',  900, true),
  ('med-ws-obarrio-07', 'ws-obarrio', 'Metformina',    'Metformina',       850, 'mg',     'Comprimido', 1100, true),
  ('med-ws-obarrio-08', 'ws-obarrio', 'Diclofenac',    'Diclofenac',        75, 'mg',     'Inyectable', 1800, true),
  ('med-ws-obarrio-09', 'ws-obarrio', 'Loratadina',    'Loratadina',        10, 'mg',     'Comprimido',  650, true),
  ('med-ws-obarrio-10', 'ws-obarrio', 'Dexametasona',  'Dexametasona',       8, 'mg',     'Inyectable', 2200, true),
  ('med-ws-obarrio-11', 'ws-obarrio', 'Atorvastatina', 'Atorvastatina',     20, 'mg',     'Comprimido', 2800, true),
  ('med-ws-obarrio-12', 'ws-obarrio', 'Losartán',      'Losartán',          50, 'mg',     'Comprimido', 1700, true),
  ('med-ws-obarrio-13', 'ws-obarrio', 'Ceftriaxona',   'Ceftriaxona',        1, 'g',      'Inyectable', 4500, true),
  ('med-ws-obarrio-14', 'ws-obarrio', 'Heparina',      'Heparina',        5000, 'unidad', 'Inyectable', 3800, false),
  ('med-ws-obarrio-15', 'ws-obarrio', 'Solución NaCl', 'Cloruro de sodio',  500, 'ml',    'Solución',    600, false),
  ('med-ws-obarrio-16', 'ws-obarrio', 'Azitromicina',  'Azitromicina',      500, 'mg',    'Comprimido', 2500, true),
  ('med-ws-obarrio-17', 'ws-obarrio', 'Carvedilol',    'Carvedilol',         25, 'mg',    'Comprimido', 1200, true),
  ('med-ws-obarrio-18', 'ws-obarrio', 'Clonazepam',    'Clonazepam',          2, 'mg',    'Comprimido',  800, true)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
--  6. LOTES — Depósito Central
--  Stock normal: todo entre min y óptimo
--  Excepción: NaCl (15) levemente sobre óptimo → fuente de sugerencias
-- ─────────────────────────────────────────────
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b29-oba-c-01', 'med-ws-obarrio-01', 'wh-ws-obarrio-central', 'OBA-C-001', NOW() + INTERVAL '360 days',  750),
  ('b29-oba-c-02', 'med-ws-obarrio-02', 'wh-ws-obarrio-central', 'OBA-C-002', NOW() + INTERVAL '300 days',  580),
  ('b29-oba-c-03', 'med-ws-obarrio-03', 'wh-ws-obarrio-central', 'OBA-C-003', NOW() + INTERVAL '240 days',  420),
  ('b29-oba-c-04', 'med-ws-obarrio-04', 'wh-ws-obarrio-central', 'OBA-C-004', NOW() + INTERVAL '420 days',  580),
  ('b29-oba-c-05', 'med-ws-obarrio-05', 'wh-ws-obarrio-central', 'OBA-C-005', NOW() + INTERVAL '180 days',  300),
  ('b29-oba-c-06', 'med-ws-obarrio-06', 'wh-ws-obarrio-central', 'OBA-C-006', NOW() + INTERVAL '360 days',  175),
  ('b29-oba-c-07', 'med-ws-obarrio-07', 'wh-ws-obarrio-central', 'OBA-C-007', NOW() + INTERVAL '300 days',  700),
  ('b29-oba-c-08', 'med-ws-obarrio-08', 'wh-ws-obarrio-central', 'OBA-C-008', NOW() + INTERVAL '200 days',  110),
  ('b29-oba-c-09', 'med-ws-obarrio-09', 'wh-ws-obarrio-central', 'OBA-C-009', NOW() + INTERVAL '270 days',  140),
  ('b29-oba-c-10', 'med-ws-obarrio-10', 'wh-ws-obarrio-central', 'OBA-C-010', NOW() + INTERVAL '160 days',  230),
  ('b29-oba-c-11', 'med-ws-obarrio-11', 'wh-ws-obarrio-central', 'OBA-C-011', NOW() + INTERVAL '310 days',  130),
  ('b29-oba-c-12', 'med-ws-obarrio-12', 'wh-ws-obarrio-central', 'OBA-C-012', NOW() + INTERVAL '280 days',  100),
  ('b29-oba-c-13', 'med-ws-obarrio-13', 'wh-ws-obarrio-central', 'OBA-C-013', NOW() + INTERVAL '130 days',   60),
  ('b29-oba-c-14', 'med-ws-obarrio-14', 'wh-ws-obarrio-central', 'OBA-C-014', NOW() + INTERVAL '80 days',    30),
  ('b29-oba-c-15', 'med-ws-obarrio-15', 'wh-ws-obarrio-central', 'OBA-C-015', NOW() + INTERVAL '45 days',  1200),  -- sobre óptimo (900)
  ('b29-oba-c-16', 'med-ws-obarrio-16', 'wh-ws-obarrio-central', 'OBA-C-016', NOW() + INTERVAL '250 days',  200),
  ('b29-oba-c-17', 'med-ws-obarrio-17', 'wh-ws-obarrio-central', 'OBA-C-017', NOW() + INTERVAL '200 days',  125),
  ('b29-oba-c-18', 'med-ws-obarrio-18', 'wh-ws-obarrio-central', 'OBA-C-018', NOW() + INTERVAL '220 days',  100)
ON CONFLICT DO NOTHING;

-- Lote con vencimiento próximo (para sección Vencimientos)
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b29-oba-c-x1', 'med-ws-obarrio-13', 'wh-ws-obarrio-central', 'OBA-C-013B', NOW() + INTERVAL '12 days',  18),
  ('b29-oba-c-x2', 'med-ws-obarrio-14', 'wh-ws-obarrio-central', 'OBA-C-014B', NOW() - INTERVAL '4 days',    6)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
--  7. LOTES — Farmacia Interna
-- ─────────────────────────────────────────────
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b29-oba-i-01', 'med-ws-obarrio-01', 'wh-ws-obarrio-interna', 'OBA-I-001', NOW() + INTERVAL '180 days', 188),
  ('b29-oba-i-02', 'med-ws-obarrio-02', 'wh-ws-obarrio-interna', 'OBA-I-002', NOW() + INTERVAL '150 days', 145),
  ('b29-oba-i-03', 'med-ws-obarrio-03', 'wh-ws-obarrio-interna', 'OBA-I-003', NOW() + INTERVAL '120 days', 105),
  ('b29-oba-i-04', 'med-ws-obarrio-04', 'wh-ws-obarrio-interna', 'OBA-I-004', NOW() + INTERVAL '210 days', 145),
  ('b29-oba-i-05', 'med-ws-obarrio-05', 'wh-ws-obarrio-interna', 'OBA-I-005', NOW() + INTERVAL '90 days',   75),
  ('b29-oba-i-06', 'med-ws-obarrio-06', 'wh-ws-obarrio-interna', 'OBA-I-006', NOW() + INTERVAL '180 days',  44),
  ('b29-oba-i-07', 'med-ws-obarrio-07', 'wh-ws-obarrio-interna', 'OBA-I-007', NOW() + INTERVAL '150 days', 175),
  ('b29-oba-i-08', 'med-ws-obarrio-08', 'wh-ws-obarrio-interna', 'OBA-I-008', NOW() + INTERVAL '100 days',  28),
  ('b29-oba-i-09', 'med-ws-obarrio-09', 'wh-ws-obarrio-interna', 'OBA-I-009', NOW() + INTERVAL '135 days',  35),
  ('b29-oba-i-10', 'med-ws-obarrio-10', 'wh-ws-obarrio-interna', 'OBA-I-010', NOW() + INTERVAL '80 days',   58),
  ('b29-oba-i-11', 'med-ws-obarrio-11', 'wh-ws-obarrio-interna', 'OBA-I-011', NOW() + INTERVAL '155 days',  33),
  ('b29-oba-i-12', 'med-ws-obarrio-12', 'wh-ws-obarrio-interna', 'OBA-I-012', NOW() + INTERVAL '140 days',  25),
  ('b29-oba-i-13', 'med-ws-obarrio-13', 'wh-ws-obarrio-interna', 'OBA-I-013', NOW() + INTERVAL '65 days',   15),
  ('b29-oba-i-14', 'med-ws-obarrio-14', 'wh-ws-obarrio-interna', 'OBA-I-014', NOW() + INTERVAL '40 days',    8),
  ('b29-oba-i-15', 'med-ws-obarrio-15', 'wh-ws-obarrio-interna', 'OBA-I-015', NOW() + INTERVAL '22 days',  300),
  ('b29-oba-i-16', 'med-ws-obarrio-16', 'wh-ws-obarrio-interna', 'OBA-I-016', NOW() + INTERVAL '125 days',  50),
  ('b29-oba-i-17', 'med-ws-obarrio-17', 'wh-ws-obarrio-interna', 'OBA-I-017', NOW() + INTERVAL '100 days',  31),
  ('b29-oba-i-18', 'med-ws-obarrio-18', 'wh-ws-obarrio-interna', 'OBA-I-018', NOW() + INTERVAL '110 days',  25)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
--  8. LOTES — Farmacia Ventas (sale_enabled: 01-13, 16-18)
-- ─────────────────────────────────────────────
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b29-oba-v-01', 'med-ws-obarrio-01', 'wh-ws-obarrio-ventas', 'OBA-V-001', NOW() + INTERVAL '150 days',  75),
  ('b29-oba-v-02', 'med-ws-obarrio-02', 'wh-ws-obarrio-ventas', 'OBA-V-002', NOW() + INTERVAL '120 days',  58),
  ('b29-oba-v-03', 'med-ws-obarrio-03', 'wh-ws-obarrio-ventas', 'OBA-V-003', NOW() + INTERVAL '90 days',   42),
  ('b29-oba-v-04', 'med-ws-obarrio-04', 'wh-ws-obarrio-ventas', 'OBA-V-004', NOW() + INTERVAL '180 days',  58),
  ('b29-oba-v-05', 'med-ws-obarrio-05', 'wh-ws-obarrio-ventas', 'OBA-V-005', NOW() + INTERVAL '60 days',   30),
  ('b29-oba-v-06', 'med-ws-obarrio-06', 'wh-ws-obarrio-ventas', 'OBA-V-006', NOW() + INTERVAL '150 days',  18),
  ('b29-oba-v-07', 'med-ws-obarrio-07', 'wh-ws-obarrio-ventas', 'OBA-V-007', NOW() + INTERVAL '120 days',  70),
  ('b29-oba-v-08', 'med-ws-obarrio-08', 'wh-ws-obarrio-ventas', 'OBA-V-008', NOW() + INTERVAL '80 days',   11),
  ('b29-oba-v-09', 'med-ws-obarrio-09', 'wh-ws-obarrio-ventas', 'OBA-V-009', NOW() + INTERVAL '110 days',  14),
  ('b29-oba-v-10', 'med-ws-obarrio-10', 'wh-ws-obarrio-ventas', 'OBA-V-010', NOW() + INTERVAL '65 days',   23),
  ('b29-oba-v-11', 'med-ws-obarrio-11', 'wh-ws-obarrio-ventas', 'OBA-V-011', NOW() + INTERVAL '125 days',  13),
  ('b29-oba-v-12', 'med-ws-obarrio-12', 'wh-ws-obarrio-ventas', 'OBA-V-012', NOW() + INTERVAL '115 days',  10),
  ('b29-oba-v-13', 'med-ws-obarrio-13', 'wh-ws-obarrio-ventas', 'OBA-V-013', NOW() + INTERVAL '50 days',    6),
  ('b29-oba-v-16', 'med-ws-obarrio-16', 'wh-ws-obarrio-ventas', 'OBA-V-016', NOW() + INTERVAL '100 days',  10),
  ('b29-oba-v-17', 'med-ws-obarrio-17', 'wh-ws-obarrio-ventas', 'OBA-V-017', NOW() + INTERVAL '80 days',    6),
  ('b29-oba-v-18', 'med-ws-obarrio-18', 'wh-ws-obarrio-ventas', 'OBA-V-018', NOW() + INTERVAL '90 days',    5)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
--  9. STOCK CONFIG (mín / óptimo por depósito)
--  Valores estándar idénticos a los 6 hospitales de 026/028
-- ─────────────────────────────────────────────
INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock) VALUES
  -- Central — meds 01-15
  ('med-ws-obarrio-01', 'wh-ws-obarrio-central',  640, 1020),
  ('med-ws-obarrio-02', 'wh-ws-obarrio-central',  510,  815),
  ('med-ws-obarrio-03', 'wh-ws-obarrio-central',  320,  512),
  ('med-ws-obarrio-04', 'wh-ws-obarrio-central',  440,  704),
  ('med-ws-obarrio-05', 'wh-ws-obarrio-central',  240,  384),
  ('med-ws-obarrio-06', 'wh-ws-obarrio-central',  120,  220),
  ('med-ws-obarrio-07', 'wh-ws-obarrio-central',  600,  960),
  ('med-ws-obarrio-08', 'wh-ws-obarrio-central',   80,  140),
  ('med-ws-obarrio-09', 'wh-ws-obarrio-central',   90,  160),
  ('med-ws-obarrio-10', 'wh-ws-obarrio-central',  150,  260),
  ('med-ws-obarrio-11', 'wh-ws-obarrio-central',   80,  140),
  ('med-ws-obarrio-12', 'wh-ws-obarrio-central',   70,  120),
  ('med-ws-obarrio-13', 'wh-ws-obarrio-central',   40,   70),
  ('med-ws-obarrio-14', 'wh-ws-obarrio-central',   25,   45),
  ('med-ws-obarrio-15', 'wh-ws-obarrio-central',  500,  900),
  -- Central — meds 16-18
  ('med-ws-obarrio-16', 'wh-ws-obarrio-central',  160,  260),
  ('med-ws-obarrio-17', 'wh-ws-obarrio-central',   90,  140),
  ('med-ws-obarrio-18', 'wh-ws-obarrio-central',   70,  110),
  -- Interna — meds 01-15
  ('med-ws-obarrio-01', 'wh-ws-obarrio-interna',  120,  190),
  ('med-ws-obarrio-02', 'wh-ws-obarrio-interna',  100,  160),
  ('med-ws-obarrio-03', 'wh-ws-obarrio-interna',   60,   98),
  ('med-ws-obarrio-04', 'wh-ws-obarrio-interna',   85,  136),
  ('med-ws-obarrio-05', 'wh-ws-obarrio-interna',   45,   72),
  ('med-ws-obarrio-06', 'wh-ws-obarrio-interna',   22,   40),
  ('med-ws-obarrio-07', 'wh-ws-obarrio-interna',  120,  192),
  ('med-ws-obarrio-08', 'wh-ws-obarrio-interna',   16,   28),
  ('med-ws-obarrio-09', 'wh-ws-obarrio-interna',   18,   30),
  ('med-ws-obarrio-10', 'wh-ws-obarrio-interna',   28,   50),
  ('med-ws-obarrio-11', 'wh-ws-obarrio-interna',   16,   28),
  ('med-ws-obarrio-12', 'wh-ws-obarrio-interna',   14,   24),
  ('med-ws-obarrio-13', 'wh-ws-obarrio-interna',    8,   14),
  ('med-ws-obarrio-14', 'wh-ws-obarrio-interna',    5,    9),
  ('med-ws-obarrio-15', 'wh-ws-obarrio-interna',   80,  144),
  -- Interna — meds 16-18
  ('med-ws-obarrio-16', 'wh-ws-obarrio-interna',   28,   45),
  ('med-ws-obarrio-17', 'wh-ws-obarrio-interna',   16,   28),
  ('med-ws-obarrio-18', 'wh-ws-obarrio-interna',   12,   20),
  -- Ventas — meds 01-12
  ('med-ws-obarrio-01', 'wh-ws-obarrio-ventas',   40,   70),
  ('med-ws-obarrio-02', 'wh-ws-obarrio-ventas',   30,   55),
  ('med-ws-obarrio-03', 'wh-ws-obarrio-ventas',   20,   32),
  ('med-ws-obarrio-04', 'wh-ws-obarrio-ventas',   25,   40),
  ('med-ws-obarrio-05', 'wh-ws-obarrio-ventas',   15,   24),
  ('med-ws-obarrio-06', 'wh-ws-obarrio-ventas',   14,   26),
  ('med-ws-obarrio-07', 'wh-ws-obarrio-ventas',   30,   48),
  ('med-ws-obarrio-08', 'wh-ws-obarrio-ventas',   10,   18),
  ('med-ws-obarrio-09', 'wh-ws-obarrio-ventas',   12,   20),
  ('med-ws-obarrio-10', 'wh-ws-obarrio-ventas',   22,   38),
  ('med-ws-obarrio-11', 'wh-ws-obarrio-ventas',   10,   18),
  ('med-ws-obarrio-12', 'wh-ws-obarrio-ventas',    8,   14),
  -- Ventas — meds 16-18
  ('med-ws-obarrio-16', 'wh-ws-obarrio-ventas',   12,   20),
  ('med-ws-obarrio-17', 'wh-ws-obarrio-ventas',    8,   14),
  ('med-ws-obarrio-18', 'wh-ws-obarrio-ventas',    6,   10)
ON CONFLICT (medication_id, warehouse_id) DO NOTHING;

-- ─────────────────────────────────────────────
--  10. ACTUALIZAR VOLUMEN
-- ─────────────────────────────────────────────
UPDATE warehouses w
SET volume = COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.warehouse_id = w.id), 0)
WHERE w.id IN (
  'wh-ws-obarrio-central',
  'wh-ws-obarrio-interna',
  'wh-ws-obarrio-ventas'
);

-- ─────────────────────────────────────────────
--  VERIFICACIÓN
-- ─────────────────────────────────────────────
DO $$
DECLARE
  total_units   bigint;
  med_count     int;
  cfg_count     int;
  deficit_count int;
BEGIN
  SELECT COALESCE(SUM(b.quantity), 0) INTO total_units
  FROM batches b WHERE b.warehouse_id LIKE 'wh-ws-obarrio-%';

  SELECT COUNT(*) INTO med_count
  FROM medications WHERE workspace_id = 'ws-obarrio';

  SELECT COUNT(*) INTO cfg_count
  FROM medication_stock_config c
  JOIN medications m ON m.id = c.medication_id
  WHERE m.workspace_id = 'ws-obarrio';

  -- Medicamentos con déficit (sum qty < sum min) por depósito
  SELECT COUNT(*) INTO deficit_count FROM (
    SELECT c.medication_id
    FROM medication_stock_config c
    JOIN medications m ON m.id = c.medication_id
    JOIN (SELECT medication_id, warehouse_id, SUM(quantity) AS qty FROM batches GROUP BY 1,2) s
      ON s.medication_id = c.medication_id AND s.warehouse_id = c.warehouse_id
    WHERE m.workspace_id = 'ws-obarrio' AND s.qty < c.min_stock
  ) sub;

  RAISE NOTICE '=== 029 Hospital Obarrio ===';
  RAISE NOTICE 'Total unidades: %', total_units;
  RAISE NOTICE 'Medicamentos:   %', med_count;
  RAISE NOTICE 'Configs stock:  %', cfg_count;
  RAISE NOTICE 'Entradas en déficit: % (esperado: 0)', deficit_count;
END $$;
