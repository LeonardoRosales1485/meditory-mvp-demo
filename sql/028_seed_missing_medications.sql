-- ============================================================
--  MEDITORY — Migración 028: Agregar Azitromicina, Carvedilol,
--  Clonazepam a los 8 hospitales que no los tienen
--  (ws-francisco ya los tiene: med-fco-12, med-fco-11, med-fco-06)
-- ============================================================

-- ─── MAPA DE IDs ────────────────────────────
-- Hospital         │ Prefix  │ Med IDs (new)  │ Warehouses
-- ─────────────────┼─────────┼────────────────┼────────────────────────
-- ws-aleman        │ ale     │ 16/17/18       │ central, interna, ventas
-- ws-blanco        │ bla     │ 06/07/08       │ central, interna, ventas
-- ws-padilla       │ pad     │ 16/17/18       │ central, interna, ventas
-- ws-ninez         │ nin     │ 16/17/18       │ central, interna, ventas
-- ws-mujer         │ muj     │ 16/17/18       │ central, interna, ventas
-- ws-evaperon      │ eva     │ 16/17/18       │ central, interna, ventas
-- ws-concepcion    │ con     │ 16/17/18       │ central, interna, ventas
-- ws-este          │ est     │ 16/17/18       │ central, interna, ventas

-- ─── MEDICATIONS ──────────────────────────────────
INSERT INTO medications (id, workspace_id, name, active_ingredient, concentration_value, concentration_unit, form, sale_price, sale_enabled) VALUES
  -- Alemán
  ('med-ale-16', 'ws-aleman',    'Azitromicina', 'Azitromicina', 500, 'mg', 'Comprimido', 2500, true),
  ('med-ale-17', 'ws-aleman',    'Carvedilol',   'Carvedilol',   25,  'mg', 'Comprimido', 1200, true),
  ('med-ale-18', 'ws-aleman',    'Clonazepam',   'Clonazepam',    2,  'mg', 'Comprimido',  800, true),
  -- Blanco
  ('med-bla-06', 'ws-blanco',    'Azitromicina', 'Azitromicina', 500, 'mg', 'Comprimido', 2500, true),
  ('med-bla-07', 'ws-blanco',    'Carvedilol',   'Carvedilol',   25,  'mg', 'Comprimido', 1200, true),
  ('med-bla-08', 'ws-blanco',    'Clonazepam',   'Clonazepam',    2,  'mg', 'Comprimido',  800, true),
  -- Padilla
  ('med-ws-padilla-16', 'ws-padilla',    'Azitromicina', 'Azitromicina', 500, 'mg', 'Comprimido', 2500, true),
  ('med-ws-padilla-17', 'ws-padilla',    'Carvedilol',   'Carvedilol',   25,  'mg', 'Comprimido', 1200, true),
  ('med-ws-padilla-18', 'ws-padilla',    'Clonazepam',   'Clonazepam',    2,  'mg', 'Comprimido',  800, true),
  -- Niñez
  ('med-ws-ninez-16', 'ws-ninez',      'Azitromicina', 'Azitromicina', 500, 'mg', 'Comprimido', 2500, true),
  ('med-ws-ninez-17', 'ws-ninez',      'Carvedilol',   'Carvedilol',   25,  'mg', 'Comprimido', 1200, true),
  ('med-ws-ninez-18', 'ws-ninez',      'Clonazepam',   'Clonazepam',    2,  'mg', 'Comprimido',  800, true),
  -- Mujer
  ('med-ws-mujer-16', 'ws-mujer',      'Azitromicina', 'Azitromicina', 500, 'mg', 'Comprimido', 2500, true),
  ('med-ws-mujer-17', 'ws-mujer',      'Carvedilol',   'Carvedilol',   25,  'mg', 'Comprimido', 1200, true),
  ('med-ws-mujer-18', 'ws-mujer',      'Clonazepam',   'Clonazepam',    2,  'mg', 'Comprimido',  800, true),
  -- Eva Perón
  ('med-ws-evaperon-16', 'ws-evaperon', 'Azitromicina', 'Azitromicina', 500, 'mg', 'Comprimido', 2500, true),
  ('med-ws-evaperon-17', 'ws-evaperon', 'Carvedilol',   'Carvedilol',   25,  'mg', 'Comprimido', 1200, true),
  ('med-ws-evaperon-18', 'ws-evaperon', 'Clonazepam',   'Clonazepam',    2,  'mg', 'Comprimido',  800, true),
  -- Concepción
  ('med-ws-concepcion-16', 'ws-concepcion', 'Azitromicina', 'Azitromicina', 500, 'mg', 'Comprimido', 2500, true),
  ('med-ws-concepcion-17', 'ws-concepcion', 'Carvedilol',   'Carvedilol',   25,  'mg', 'Comprimido', 1200, true),
  ('med-ws-concepcion-18', 'ws-concepcion', 'Clonazepam',   'Clonazepam',    2,  'mg', 'Comprimido',  800, true),
  -- Este
  ('med-ws-este-16', 'ws-este',       'Azitromicina', 'Azitromicina', 500, 'mg', 'Comprimido', 2500, true),
  ('med-ws-este-17', 'ws-este',       'Carvedilol',   'Carvedilol',   25,  'mg', 'Comprimido', 1200, true),
  ('med-ws-este-18', 'ws-este',       'Clonazepam',   'Clonazepam',    2,  'mg', 'Comprimido',  800, true)
ON CONFLICT DO NOTHING;

-- ─── STOCK CONFIG ──────────────────────────────────
-- Azitromicina=16(17), Carvedilol=17(18), Clonazepam=18(19)
-- Para Alemán: ale-16/17/18; Blanco: bla-06/07/08

-- Alemán
INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock) VALUES
  ('med-ale-16', 'wh-aleman-central', 200, 320),
  ('med-ale-16', 'wh-aleman-interna',  30,  50),
  ('med-ale-16', 'wh-aleman-ventas',   15,  25),
  ('med-ale-17', 'wh-aleman-central', 100, 160),
  ('med-ale-17', 'wh-aleman-interna',  20,  35),
  ('med-ale-17', 'wh-aleman-ventas',   10,  18),
  ('med-ale-18', 'wh-aleman-central',  80, 130),
  ('med-ale-18', 'wh-aleman-interna',  15,  25),
  ('med-ale-18', 'wh-aleman-ventas',    8,  14)
ON CONFLICT DO NOTHING;

-- Blanco
INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock) VALUES
  ('med-bla-06', 'wh-blanco-central', 80,  130),
  ('med-bla-06', 'wh-blanco-interna', 12,   20),
  ('med-bla-06', 'wh-blanco-ventas',   5,    8),
  ('med-bla-07', 'wh-blanco-central', 50,   80),
  ('med-bla-07', 'wh-blanco-interna',  8,   14),
  ('med-bla-07', 'wh-blanco-ventas',   3,    6),
  ('med-bla-08', 'wh-blanco-central', 40,   65),
  ('med-bla-08', 'wh-blanco-interna',  6,   10),
  ('med-bla-08', 'wh-blanco-ventas',   2,    5)
ON CONFLICT DO NOTHING;

-- Nuevos workspaces (Padilla, Niñez, Mujer, Eva Perón, Concepción, Este)
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
      ( 'med-' || ws_id || '-16', wh_c, 160, 260),
      ( 'med-' || ws_id || '-16', wh_i,  28,  45),
      ( 'med-' || ws_id || '-16', wh_v,  12,  20),
      ( 'med-' || ws_id || '-17', wh_c,  90, 140),
      ( 'med-' || ws_id || '-17', wh_i,  16,  28),
      ( 'med-' || ws_id || '-17', wh_v,   8,  14),
      ( 'med-' || ws_id || '-18', wh_c,  70, 110),
      ( 'med-' || ws_id || '-18', wh_i,  12,  20),
      ( 'med-' || ws_id || '-18', wh_v,   6,  10)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ─── BATCHES ──────────────────────────────────

-- Alemán — Central
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b23-ale-c-16', 'med-ale-16', 'wh-aleman-central', 'A26-C-016', NOW() + INTERVAL '300 days', 450),
  ('b23-ale-c-17', 'med-ale-17', 'wh-aleman-central', 'A26-C-017', NOW() + INTERVAL '280 days', 220),
  ('b23-ale-c-18', 'med-ale-18', 'wh-aleman-central', 'A26-C-018', NOW() + INTERVAL '240 days', 180)
ON CONFLICT DO NOTHING;

-- Alemán — Interna
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b23-ale-i-16', 'med-ale-16', 'wh-aleman-interna', 'A26-I-016', NOW() + INTERVAL '160 days', 60),
  ('b23-ale-i-17', 'med-ale-17', 'wh-aleman-interna', 'A26-I-017', NOW() + INTERVAL '140 days', 30),
  ('b23-ale-i-18', 'med-ale-18', 'wh-aleman-interna', 'A26-I-018', NOW() + INTERVAL '120 days', 25)
ON CONFLICT DO NOTHING;

-- Alemán — Ventas
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b23-ale-v-16', 'med-ale-16', 'wh-aleman-ventas',  'A26-V-016', NOW() + INTERVAL '180 days', 20),
  ('b23-ale-v-17', 'med-ale-17', 'wh-aleman-ventas',  'A26-V-017', NOW() + INTERVAL '160 days', 12),
  ('b23-ale-v-18', 'med-ale-18', 'wh-aleman-ventas',  'A26-V-018', NOW() + INTERVAL '140 days', 10)
ON CONFLICT DO NOTHING;

-- Blanco — Central
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b23-bla-c-06', 'med-bla-06', 'wh-blanco-central', 'B26-C-006', NOW() + INTERVAL '240 days', 200),
  ('b23-bla-c-07', 'med-bla-07', 'wh-blanco-central', 'B26-C-007', NOW() + INTERVAL '220 days', 100),
  ('b23-bla-c-08', 'med-bla-08', 'wh-blanco-central', 'B26-C-008', NOW() + INTERVAL '200 days',  80)
ON CONFLICT DO NOTHING;

-- Blanco — Interna
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b23-bla-i-06', 'med-bla-06', 'wh-blanco-interna', 'B26-I-006', NOW() + INTERVAL '90 days', 18),
  ('b23-bla-i-07', 'med-bla-07', 'wh-blanco-interna', 'B26-I-007', NOW() + INTERVAL '80 days', 10),
  ('b23-bla-i-08', 'med-bla-08', 'wh-blanco-interna', 'B26-I-008', NOW() + INTERVAL '70 days',  8)
ON CONFLICT DO NOTHING;

-- Blanco — Ventas
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b23-bla-v-06', 'med-bla-06', 'wh-blanco-ventas',  'B26-V-006', NOW() + INTERVAL '150 days',  6),
  ('b23-bla-v-07', 'med-bla-07', 'wh-blanco-ventas',  'B26-V-007', NOW() + INTERVAL '130 days',  4),
  ('b23-bla-v-08', 'med-bla-08', 'wh-blanco-ventas',  'B26-V-008', NOW() + INTERVAL '110 days',  3)
ON CONFLICT DO NOTHING;

-- Padilla — Central
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b28-pad-c-16', 'med-ws-padilla-16', 'wh-ws-padilla-central', 'PAD-C-016', NOW() + INTERVAL '260 days', 380),
  ('b28-pad-c-17', 'med-ws-padilla-17', 'wh-ws-padilla-central', 'PAD-C-017', NOW() + INTERVAL '240 days', 190),
  ('b28-pad-c-18', 'med-ws-padilla-18', 'wh-ws-padilla-central', 'PAD-C-018', NOW() + INTERVAL '220 days', 150)
ON CONFLICT DO NOTHING;

-- Padilla — Interna
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b28-pad-i-16', 'med-ws-padilla-16', 'wh-ws-padilla-interna', 'PAD-I-016', NOW() + INTERVAL '130 days', 50),
  ('b28-pad-i-17', 'med-ws-padilla-17', 'wh-ws-padilla-interna', 'PAD-I-017', NOW() + INTERVAL '110 days', 25),
  ('b28-pad-i-18', 'med-ws-padilla-18', 'wh-ws-padilla-interna', 'PAD-I-018', NOW() + INTERVAL '100 days', 20)
ON CONFLICT DO NOTHING;

-- Padilla — Ventas
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b28-pad-v-16', 'med-ws-padilla-16', 'wh-ws-padilla-ventas', 'PAD-V-016', NOW() + INTERVAL '140 days', 16),
  ('b28-pad-v-17', 'med-ws-padilla-17', 'wh-ws-padilla-ventas', 'PAD-V-017', NOW() + INTERVAL '120 days',  9),
  ('b28-pad-v-18', 'med-ws-padilla-18', 'wh-ws-padilla-ventas', 'PAD-V-018', NOW() + INTERVAL '100 days',  7)
ON CONFLICT DO NOTHING;

-- Niñez — Central
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b28-nin-c-16', 'med-ws-ninez-16', 'wh-ws-ninez-central', 'NIN-C-016', NOW() + INTERVAL '240 days', 340),
  ('b28-nin-c-17', 'med-ws-ninez-17', 'wh-ws-ninez-central', 'NIN-C-017', NOW() + INTERVAL '220 days', 170),
  ('b28-nin-c-18', 'med-ws-ninez-18', 'wh-ws-ninez-central', 'NIN-C-018', NOW() + INTERVAL '200 days', 130)
ON CONFLICT DO NOTHING;

-- Niñez — Interna
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b28-nin-i-16', 'med-ws-ninez-16', 'wh-ws-ninez-interna', 'NIN-I-016', NOW() + INTERVAL '110 days', 45),
  ('b28-nin-i-17', 'med-ws-ninez-17', 'wh-ws-ninez-interna', 'NIN-I-017', NOW() + INTERVAL '100 days', 22),
  ('b28-nin-i-18', 'med-ws-ninez-18', 'wh-ws-ninez-interna', 'NIN-I-018', NOW() + INTERVAL '90 days',  17)
ON CONFLICT DO NOTHING;

-- Niñez — Ventas
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b28-nin-v-16', 'med-ws-ninez-16', 'wh-ws-ninez-ventas', 'NIN-V-016', NOW() + INTERVAL '130 days', 14),
  ('b28-nin-v-17', 'med-ws-ninez-17', 'wh-ws-ninez-ventas', 'NIN-V-017', NOW() + INTERVAL '110 days',  8),
  ('b28-nin-v-18', 'med-ws-ninez-18', 'wh-ws-ninez-ventas', 'NIN-V-018', NOW() + INTERVAL '100 days',  6)
ON CONFLICT DO NOTHING;

-- Mujer — Central
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b28-muj-c-16', 'med-ws-mujer-16', 'wh-ws-mujer-central', 'MUJ-C-016', NOW() + INTERVAL '250 days', 360),
  ('b28-muj-c-17', 'med-ws-mujer-17', 'wh-ws-mujer-central', 'MUJ-C-017', NOW() + INTERVAL '230 days', 180),
  ('b28-muj-c-18', 'med-ws-mujer-18', 'wh-ws-mujer-central', 'MUJ-C-018', NOW() + INTERVAL '210 days', 140)
ON CONFLICT DO NOTHING;

-- Mujer — Interna
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b28-muj-i-16', 'med-ws-mujer-16', 'wh-ws-mujer-interna', 'MUJ-I-016', NOW() + INTERVAL '120 days', 48),
  ('b28-muj-i-17', 'med-ws-mujer-17', 'wh-ws-mujer-interna', 'MUJ-I-017', NOW() + INTERVAL '105 days', 24),
  ('b28-muj-i-18', 'med-ws-mujer-18', 'wh-ws-mujer-interna', 'MUJ-I-018', NOW() + INTERVAL '95 days',  18)
ON CONFLICT DO NOTHING;

-- Mujer — Ventas
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b28-muj-v-16', 'med-ws-mujer-16', 'wh-ws-mujer-ventas', 'MUJ-V-016', NOW() + INTERVAL '140 days', 15),
  ('b28-muj-v-17', 'med-ws-mujer-17', 'wh-ws-mujer-ventas', 'MUJ-V-017', NOW() + INTERVAL '120 days',  8),
  ('b28-muj-v-18', 'med-ws-mujer-18', 'wh-ws-mujer-ventas', 'MUJ-V-018', NOW() + INTERVAL '100 days',  6)
ON CONFLICT DO NOTHING;

-- Eva Perón — Central
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b28-eva-c-16', 'med-ws-evaperon-16', 'wh-ws-evaperon-central', 'EVA-C-016', NOW() + INTERVAL '230 days', 320),
  ('b28-eva-c-17', 'med-ws-evaperon-17', 'wh-ws-evaperon-central', 'EVA-C-017', NOW() + INTERVAL '210 days', 160),
  ('b28-eva-c-18', 'med-ws-evaperon-18', 'wh-ws-evaperon-central', 'EVA-C-018', NOW() + INTERVAL '190 days', 120)
ON CONFLICT DO NOTHING;

-- Eva Perón — Interna
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b28-eva-i-16', 'med-ws-evaperon-16', 'wh-ws-evaperon-interna', 'EVA-I-016', NOW() + INTERVAL '110 days', 42),
  ('b28-eva-i-17', 'med-ws-evaperon-17', 'wh-ws-evaperon-interna', 'EVA-I-017', NOW() + INTERVAL '95 days',  20),
  ('b28-eva-i-18', 'med-ws-evaperon-18', 'wh-ws-evaperon-interna', 'EVA-I-018', NOW() + INTERVAL '85 days',  15)
ON CONFLICT DO NOTHING;

-- Eva Perón — Ventas
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b28-eva-v-16', 'med-ws-evaperon-16', 'wh-ws-evaperon-ventas', 'EVA-V-016', NOW() + INTERVAL '130 days', 13),
  ('b28-eva-v-17', 'med-ws-evaperon-17', 'wh-ws-evaperon-ventas', 'EVA-V-017', NOW() + INTERVAL '110 days',  7),
  ('b28-eva-v-18', 'med-ws-evaperon-18', 'wh-ws-evaperon-ventas', 'EVA-V-018', NOW() + INTERVAL '90 days',   5)
ON CONFLICT DO NOTHING;

-- Concepción — Central
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b28-con-c-16', 'med-ws-concepcion-16', 'wh-ws-concepcion-central', 'CON-C-016', NOW() + INTERVAL '220 days', 310),
  ('b28-con-c-17', 'med-ws-concepcion-17', 'wh-ws-concepcion-central', 'CON-C-017', NOW() + INTERVAL '200 days', 155),
  ('b28-con-c-18', 'med-ws-concepcion-18', 'wh-ws-concepcion-central', 'CON-C-018', NOW() + INTERVAL '180 days', 115)
ON CONFLICT DO NOTHING;

-- Concepción — Interna
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b28-con-i-16', 'med-ws-concepcion-16', 'wh-ws-concepcion-interna', 'CON-I-016', NOW() + INTERVAL '105 days', 40),
  ('b28-con-i-17', 'med-ws-concepcion-17', 'wh-ws-concepcion-interna', 'CON-I-017', NOW() + INTERVAL '90 days',  18),
  ('b28-con-i-18', 'med-ws-concepcion-18', 'wh-ws-concepcion-interna', 'CON-I-018', NOW() + INTERVAL '80 days',  14)
ON CONFLICT DO NOTHING;

-- Concepción — Ventas
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b28-con-v-16', 'med-ws-concepcion-16', 'wh-ws-concepcion-ventas', 'CON-V-016', NOW() + INTERVAL '120 days', 12),
  ('b28-con-v-17', 'med-ws-concepcion-17', 'wh-ws-concepcion-ventas', 'CON-V-017', NOW() + INTERVAL '100 days',  6),
  ('b28-con-v-18', 'med-ws-concepcion-18', 'wh-ws-concepcion-ventas', 'CON-V-018', NOW() + INTERVAL '80 days',   5)
ON CONFLICT DO NOTHING;

-- Este — Central
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b28-est-c-16', 'med-ws-este-16', 'wh-ws-este-central', 'EST-C-016', NOW() + INTERVAL '280 days', 350),
  ('b28-est-c-17', 'med-ws-este-17', 'wh-ws-este-central', 'EST-C-017', NOW() + INTERVAL '250 days', 175),
  ('b28-est-c-18', 'med-ws-este-18', 'wh-ws-este-central', 'EST-C-018', NOW() + INTERVAL '230 days', 135)
ON CONFLICT DO NOTHING;

-- Este — Interna
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b28-est-i-16', 'med-ws-este-16', 'wh-ws-este-interna', 'EST-I-016', NOW() + INTERVAL '120 days', 44),
  ('b28-est-i-17', 'med-ws-este-17', 'wh-ws-este-interna', 'EST-I-017', NOW() + INTERVAL '100 days', 22),
  ('b28-est-i-18', 'med-ws-este-18', 'wh-ws-este-interna', 'EST-I-018', NOW() + INTERVAL '90 days',  16)
ON CONFLICT DO NOTHING;

-- Este — Ventas
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity) VALUES
  ('b28-est-v-16', 'med-ws-este-16', 'wh-ws-este-ventas', 'EST-V-016', NOW() + INTERVAL '140 days',  14),
  ('b28-est-v-17', 'med-ws-este-17', 'wh-ws-este-ventas', 'EST-V-017', NOW() + INTERVAL '120 days',   7),
  ('b28-est-v-18', 'med-ws-este-18', 'wh-ws-este-ventas', 'EST-V-018', NOW() + INTERVAL '100 days',   6)
ON CONFLICT DO NOTHING;
