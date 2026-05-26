-- ============================================================
--  MEDITORY — Migración 027: Lotes Vencidos y Próximos a Vencer
--
--  EJECUTAR DESPUÉS de 023_reset_repopulate.sql y 026_seed_amplify_stock.sql
-- ============================================================

-- ─────────────────────────────────────────────
--  Lotes ya vencidos (expiry < NOW)
-- ─────────────────────────────────────────────

-- Alemán
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b27-ale-v-01', 'med-ale-01', 'wh-aleman-central', 'A-VEN-001', NOW() - INTERVAL '90 days', 120),
  ('b27-ale-v-02', 'med-ale-02', 'wh-aleman-central', 'A-VEN-002', NOW() - INTERVAL '60 days',  85),
  ('b27-ale-v-03', 'med-ale-03', 'wh-aleman-central', 'A-VEN-003', NOW() - INTERVAL '45 days',  60),
  ('b27-ale-v-04', 'med-ale-04', 'wh-aleman-central', 'A-VEN-004', NOW() - INTERVAL '30 days',  95),
  ('b27-ale-v-05', 'med-ale-05', 'wh-aleman-interna', 'A-VEN-005', NOW() - INTERVAL '75 days',  40),
  ('b27-ale-v-06', 'med-ale-06', 'wh-aleman-interna', 'A-VEN-006', NOW() - INTERVAL '55 days',  55),
  ('b27-ale-v-07', 'med-ale-07', 'wh-aleman-interna', 'A-VEN-007', NOW() - INTERVAL '40 days',  70),
  ('b27-ale-v-08', 'med-ale-08', 'wh-aleman-ventas',  'A-VEN-008', NOW() - INTERVAL '120 days', 25),
  ('b27-ale-v-09', 'med-ale-09', 'wh-aleman-ventas',  'A-VEN-009', NOW() - INTERVAL '80 days',  30),
  ('b27-ale-v-10', 'med-ale-10', 'wh-aleman-ventas',  'A-VEN-010', NOW() - INTERVAL '15 days',  18),
  ('b27-ale-v-11', 'med-ale-11', 'wh-aleman-central', 'A-VEN-011', NOW() - INTERVAL '50 days',  45),
  ('b27-ale-v-12', 'med-ale-12', 'wh-aleman-interna', 'A-VEN-012', NOW() - INTERVAL '25 days',  35),
  ('b27-ale-v-13', 'med-ale-13', 'wh-aleman-central', 'A-VEN-013', NOW() - INTERVAL '100 days', 28),
  ('b27-ale-v-14', 'med-ale-14', 'wh-aleman-interna', 'A-VEN-014', NOW() - INTERVAL '35 days',  15),
  ('b27-ale-v-15', 'med-ale-15', 'wh-aleman-central', 'A-VEN-015', NOW() - INTERVAL '10 days', 500)
ON CONFLICT DO NOTHING;

-- Francisco
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b27-fco-v-01', 'med-fco-01', 'wh-fco-central', 'F-VEN-001', NOW() - INTERVAL '85 days',  90),
  ('b27-fco-v-02', 'med-fco-02', 'wh-fco-central', 'F-VEN-002', NOW() - INTERVAL '50 days',  65),
  ('b27-fco-v-03', 'med-fco-03', 'wh-fco-interna', 'F-VEN-003', NOW() - INTERVAL '40 days',  35),
  ('b27-fco-v-04', 'med-fco-04', 'wh-fco-central', 'F-VEN-004', NOW() - INTERVAL '70 days',  50),
  ('b27-fco-v-05', 'med-fco-05', 'wh-fco-interna', 'F-VEN-005', NOW() - INTERVAL '30 days',  22),
  ('b27-fco-v-06', 'med-fco-06', 'wh-fco-ventas',  'F-VEN-006', NOW() - INTERVAL '110 days', 18),
  ('b27-fco-v-07', 'med-fco-07', 'wh-fco-central', 'F-VEN-007', NOW() - INTERVAL '65 days',  55),
  ('b27-fco-v-08', 'med-fco-08', 'wh-fco-ventas',  'F-VEN-008', NOW() - INTERVAL '20 days',  12),
  ('b27-fco-v-09', 'med-fco-09', 'wh-fco-central', 'F-VEN-009', NOW() - INTERVAL '95 days',  40),
  ('b27-fco-v-10', 'med-fco-10', 'wh-fco-interna', 'F-VEN-010', NOW() - INTERVAL '45 days',  20),
  ('b27-fco-v-11', 'med-fco-11', 'wh-fco-ventas',  'F-VEN-011', NOW() - INTERVAL '55 days',  15),
  ('b27-fco-v-12', 'med-fco-12', 'wh-fco-central', 'F-VEN-012', NOW() - INTERVAL '35 days',  28),
  ('b27-fco-v-13', 'med-fco-13', 'wh-fco-interna', 'F-VEN-013', NOW() - INTERVAL '15 days',  10),
  ('b27-fco-v-14', 'med-fco-14', 'wh-fco-central', 'F-VEN-014', NOW() - INTERVAL '60 days',  18),
  ('b27-fco-v-15', 'med-fco-15', 'wh-fco-interna', 'F-VEN-015', NOW() - INTERVAL '8 days',  150)
ON CONFLICT DO NOTHING;

-- Blanco
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b27-bla-v-01', 'med-bla-01', 'wh-blanco-central', 'B-VEN-001', NOW() - INTERVAL '40 days',  30),
  ('b27-bla-v-02', 'med-bla-02', 'wh-blanco-interna', 'B-VEN-002', NOW() - INTERVAL '25 days',  15),
  ('b27-bla-v-03', 'med-bla-03', 'wh-blanco-central', 'B-VEN-003', NOW() - INTERVAL '60 days',  12),
  ('b27-bla-v-04', 'med-bla-04', 'wh-blanco-ventas',  'B-VEN-004', NOW() - INTERVAL '15 days',   8),
  ('b27-bla-v-05', 'med-bla-05', 'wh-blanco-interna', 'B-VEN-005', NOW() - INTERVAL '30 days',   6)
ON CONFLICT DO NOTHING;

-- Nuevos hospitales — vencidos
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b27-pad-v-01', 'med-ws-padilla-01', 'wh-ws-padilla-central', 'PAD-VEN-01', NOW() - INTERVAL '50 days', 45),
  ('b27-pad-v-02', 'med-ws-padilla-03', 'wh-ws-padilla-interna', 'PAD-VEN-02', NOW() - INTERVAL '30 days', 18),
  ('b27-nin-v-01', 'med-ws-ninez-02', 'wh-ws-ninez-central', 'NIN-VEN-01', NOW() - INTERVAL '70 days', 35),
  ('b27-nin-v-02', 'med-ws-ninez-05', 'wh-ws-ninez-interna', 'NIN-VEN-02', NOW() - INTERVAL '20 days', 10),
  ('b27-muj-v-01', 'med-ws-mujer-01', 'wh-ws-mujer-central', 'MUJ-VEN-01', NOW() - INTERVAL '45 days', 40),
  ('b27-muj-v-02', 'med-ws-mujer-04', 'wh-ws-mujer-ventas',  'MUJ-VEN-02', NOW() - INTERVAL '15 days',  8),
  ('b27-eva-v-01', 'med-ws-evaperon-03', 'wh-ws-evaperon-central', 'EVA-VEN-01', NOW() - INTERVAL '55 days', 25),
  ('b27-eva-v-02', 'med-ws-evaperon-07', 'wh-ws-evaperon-interna', 'EVA-VEN-02', NOW() - INTERVAL '25 days', 15),
  ('b27-con-v-01', 'med-ws-concepcion-02', 'wh-ws-concepcion-central', 'CON-VEN-01', NOW() - INTERVAL '65 days', 30),
  ('b27-con-v-02', 'med-ws-concepcion-06', 'wh-ws-concepcion-interna', 'CON-VEN-02', NOW() - INTERVAL '10 days', 12),
  ('b27-est-v-01', 'med-ws-este-01', 'wh-ws-este-central', 'EST-VEN-01', NOW() - INTERVAL '35 days', 35),
  ('b27-est-v-02', 'med-ws-este-08', 'wh-ws-este-ventas',  'EST-VEN-02', NOW() - INTERVAL '12 days',  5)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
--  Lotes próximos a vencer (expiry en 1-30 días)
-- ─────────────────────────────────────────────

-- Alemán
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b27-ale-p-01', 'med-ale-01', 'wh-aleman-central', 'A-PRO-001', NOW() + INTERVAL '5 days',   200),
  ('b27-ale-p-02', 'med-ale-02', 'wh-aleman-central', 'A-PRO-002', NOW() + INTERVAL '10 days',  150),
  ('b27-ale-p-03', 'med-ale-03', 'wh-aleman-interna', 'A-PRO-003', NOW() + INTERVAL '3 days',    80),
  ('b27-ale-p-04', 'med-ale-04', 'wh-aleman-ventas',  'A-PRO-004', NOW() + INTERVAL '14 days',   60),
  ('b27-ale-p-05', 'med-ale-05', 'wh-aleman-central', 'A-PRO-005', NOW() + INTERVAL '7 days',    90),
  ('b27-ale-p-06', 'med-ale-06', 'wh-aleman-interna', 'A-PRO-006', NOW() + INTERVAL '20 days',   70),
  ('b27-ale-p-07', 'med-ale-07', 'wh-aleman-central', 'A-PRO-007', NOW() + INTERVAL '12 days',  120),
  ('b27-ale-p-08', 'med-ale-08', 'wh-aleman-ventas',  'A-PRO-008', NOW() + INTERVAL '18 days',   35),
  ('b27-ale-p-09', 'med-ale-09', 'wh-aleman-interna', 'A-PRO-009', NOW() + INTERVAL '25 days',   45),
  ('b27-ale-p-10', 'med-ale-10', 'wh-aleman-central', 'A-PRO-010', NOW() + INTERVAL '2 days',    30),
  ('b27-ale-p-11', 'med-ale-11', 'wh-aleman-central', 'A-PRO-011', NOW() + INTERVAL '8 days',    55),
  ('b27-ale-p-12', 'med-ale-12', 'wh-aleman-interna', 'A-PRO-012', NOW() + INTERVAL '22 days',   40),
  ('b27-ale-p-13', 'med-ale-13', 'wh-aleman-ventas',  'A-PRO-013', NOW() + INTERVAL '6 days',    25),
  ('b27-ale-p-14', 'med-ale-14', 'wh-aleman-central', 'A-PRO-014', NOW() + INTERVAL '15 days',   20),
  ('b27-ale-p-15', 'med-ale-15', 'wh-aleman-interna', 'A-PRO-015', NOW() + INTERVAL '28 days',  350)
ON CONFLICT DO NOTHING;

-- Francisco
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b27-fco-p-01', 'med-fco-01', 'wh-fco-central', 'F-PRO-001', NOW() + INTERVAL '4 days',   100),
  ('b27-fco-p-02', 'med-fco-02', 'wh-fco-interna', 'F-PRO-002', NOW() + INTERVAL '9 days',    45),
  ('b27-fco-p-03', 'med-fco-03', 'wh-fco-ventas',  'F-PRO-003', NOW() + INTERVAL '16 days',   25),
  ('b27-fco-p-04', 'med-fco-04', 'wh-fco-central', 'F-PRO-004', NOW() + INTERVAL '11 days',   60),
  ('b27-fco-p-05', 'med-fco-05', 'wh-fco-interna', 'F-PRO-005', NOW() + INTERVAL '6 days',    20),
  ('b27-fco-p-06', 'med-fco-06', 'wh-fco-central', 'F-PRO-006', NOW() + INTERVAL '19 days',   35),
  ('b27-fco-p-07', 'med-fco-07', 'wh-fco-ventas',  'F-PRO-007', NOW() + INTERVAL '13 days',   30),
  ('b27-fco-p-08', 'med-fco-08', 'wh-fco-interna', 'F-PRO-008', NOW() + INTERVAL '3 days',    18),
  ('b27-fco-p-09', 'med-fco-09', 'wh-fco-central', 'F-PRO-009', NOW() + INTERVAL '24 days',   30),
  ('b27-fco-p-10', 'med-fco-10', 'wh-fco-ventas',  'F-PRO-010', NOW() + INTERVAL '8 days',    15),
  ('b27-fco-p-11', 'med-fco-11', 'wh-fco-interna', 'F-PRO-011', NOW() + INTERVAL '17 days',   20),
  ('b27-fco-p-12', 'med-fco-12', 'wh-fco-central', 'F-PRO-012', NOW() + INTERVAL '5 days',    25),
  ('b27-fco-p-13', 'med-fco-13', 'wh-fco-ventas',  'F-PRO-013', NOW() + INTERVAL '21 days',   12),
  ('b27-fco-p-14', 'med-fco-14', 'wh-fco-interna', 'F-PRO-014', NOW() + INTERVAL '2 days',    10),
  ('b27-fco-p-15', 'med-fco-15', 'wh-fco-central', 'F-PRO-015', NOW() + INTERVAL '26 days',   200)
ON CONFLICT DO NOTHING;

-- Blanco
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b27-bla-p-01', 'med-bla-01', 'wh-blanco-central', 'B-PRO-001', NOW() + INTERVAL '7 days',   25),
  ('b27-bla-p-02', 'med-bla-02', 'wh-blanco-interna', 'B-PRO-002', NOW() + INTERVAL '12 days',  12),
  ('b27-bla-p-03', 'med-bla-03', 'wh-blanco-ventas',  'B-PRO-003', NOW() + INTERVAL '4 days',    5),
  ('b27-bla-p-04', 'med-bla-04', 'wh-blanco-central', 'B-PRO-004', NOW() + INTERVAL '18 days',  15),
  ('b27-bla-p-05', 'med-bla-05', 'wh-blanco-interna', 'B-PRO-005', NOW() + INTERVAL '9 days',    8)
ON CONFLICT DO NOTHING;

-- Nuevos hospitales — próximos
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b27-pad-p-01', 'med-ws-padilla-02', 'wh-ws-padilla-central', 'PAD-PRO-01', NOW() + INTERVAL '6 days',   50),
  ('b27-pad-p-02', 'med-ws-padilla-05', 'wh-ws-padilla-interna', 'PAD-PRO-02', NOW() + INTERVAL '14 days',  20),
  ('b27-pad-p-03', 'med-ws-padilla-08', 'wh-ws-padilla-ventas',  'PAD-PRO-03', NOW() + INTERVAL '10 days',  12),
  ('b27-nin-p-01', 'med-ws-ninez-01', 'wh-ws-ninez-central', 'NIN-PRO-01', NOW() + INTERVAL '8 days',   40),
  ('b27-nin-p-02', 'med-ws-ninez-04', 'wh-ws-ninez-interna', 'NIN-PRO-02', NOW() + INTERVAL '22 days',  18),
  ('b27-nin-p-03', 'med-ws-ninez-07', 'wh-ws-ninez-ventas',  'NIN-PRO-03', NOW() + INTERVAL '5 days',   10),
  ('b27-muj-p-01', 'med-ws-mujer-02', 'wh-ws-mujer-central', 'MUJ-PRO-01', NOW() + INTERVAL '11 days',  35),
  ('b27-muj-p-02', 'med-ws-mujer-05', 'wh-ws-mujer-interna', 'MUJ-PRO-02', NOW() + INTERVAL '19 days',  15),
  ('b27-muj-p-03', 'med-ws-mujer-08', 'wh-ws-mujer-ventas',  'MUJ-PRO-03', NOW() + INTERVAL '7 days',    8),
  ('b27-eva-p-01', 'med-ws-evaperon-02', 'wh-ws-evaperon-central', 'EVA-PRO-01', NOW() + INTERVAL '13 days',  30),
  ('b27-eva-p-02', 'med-ws-evaperon-06', 'wh-ws-evaperon-interna', 'EVA-PRO-02', NOW() + INTERVAL '9 days',   12),
  ('b27-eva-p-03', 'med-ws-evaperon-09', 'wh-ws-evaperon-ventas',  'EVA-PRO-03', NOW() + INTERVAL '17 days',   8),
  ('b27-con-p-01', 'med-ws-concepcion-01', 'wh-ws-concepcion-central', 'CON-PRO-01', NOW() + INTERVAL '6 days',   35),
  ('b27-con-p-02', 'med-ws-concepcion-04', 'wh-ws-concepcion-interna', 'CON-PRO-02', NOW() + INTERVAL '23 days',  15),
  ('b27-con-p-03', 'med-ws-concepcion-09', 'wh-ws-concepcion-ventas',  'CON-PRO-03', NOW() + INTERVAL '11 days',  10),
  ('b27-est-p-01', 'med-ws-este-03', 'wh-ws-este-central', 'EST-PRO-01', NOW() + INTERVAL '15 days',  25),
  ('b27-est-p-02', 'med-ws-este-06', 'wh-ws-este-interna', 'EST-PRO-02', NOW() + INTERVAL '8 days',   10),
  ('b27-est-p-03', 'med-ws-este-10', 'wh-ws-este-ventas',  'EST-PRO-03', NOW() + INTERVAL '20 days',   6)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
--  VERIFICACIÓN
-- ─────────────────────────────────────────────
DO $$
DECLARE
  vencidos  bigint;
  proximos  bigint;
BEGIN
  SELECT COUNT(*) INTO vencidos FROM batches WHERE expiry < NOW();
  SELECT COUNT(*) INTO proximos FROM batches WHERE expiry >= NOW() AND expiry <= NOW() + INTERVAL '30 days';

  RAISE NOTICE '=== Migración 027 — Resumen ===';
  RAISE NOTICE 'Lotes vencidos:          %', vencidos;
  RAISE NOTICE 'Lotes próximos a vencer: %', proximos;
END $$;
