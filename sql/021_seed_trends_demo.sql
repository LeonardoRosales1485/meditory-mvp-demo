-- ============================================================
--  MEDITORY — Seed de datos de consumo para Tendencias
--  Genera movimientos históricos diarios (30 días) para que
--  el panel de Tendencias muestre las 5 categorías de riesgo.
--  Idempotente: elimina datos previos del mismo seed antes
--  de insertar.
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
--  0. Limpieza de datos previos de este seed
-- ─────────────────────────────────────────────────────────────
DELETE FROM movements WHERE id LIKE 'demo-trend-%';
DELETE FROM sales WHERE id LIKE 'demo-trend-%';
DELETE FROM dispensations WHERE id LIKE 'demo-trend-%';
DELETE FROM medication_orders WHERE id LIKE 'demo-trend-%';

-- ─────────────────────────────────────────────────────────────
--  1. Definición de categorías por medicamento
--     (por nombre y workspace)
-- ─────────────────────────────────────────────────────────────
-- Cada fila: workspace, nombre_med, categoría, stock_objetivo,
--            consumo_diario, ventas_diarias (promedio)
-- Categorías: critico, bajo, optimo, superavit, sin_stock, sin_consumo
CREATE TEMP TABLE IF NOT EXISTS tmp_trend_cat (
  ws_id text, med_name text, cat text,
  target_stock int, daily_consumption int, daily_sales numeric
);
TRUNCATE tmp_trend_cat;

INSERT INTO tmp_trend_cat VALUES
  -- ── Hospital Alemán ──
  ('ws-aleman', 'Paracetamol',   'critico',     80,  10, 0.2),
  ('ws-aleman', 'Salbutamol',    'critico',    100,   8, 0.1),
  ('ws-aleman', 'Amoxicilina',   'bajo',       200,   6, 0.2),
  ('ws-aleman', 'Losartán',      'bajo',       300,   6, 0.1),
  ('ws-aleman', 'Ibuprofeno',    'optimo',     500,   6, 0.3),
  ('ws-aleman', 'Omeprazol',     'optimo',     600,   6, 0.2),
  ('ws-aleman', 'Enalapril',     'optimo',     450,   5, 0.1),
  ('ws-aleman', 'Metformina',    'superavit', 1500,   3, 0.2),
  ('ws-aleman', 'Atorvastatina', 'superavit', 1200,   2, 0.1),
  ('ws-aleman', 'Dexametasona',  'superavit', 1000,   1, 0.1),
  ('ws-aleman', 'Solución NaCl', 'superavit', 2000,   1, 0.0),
  ('ws-aleman', 'Diclofenac',    'sin_consumo', 800,  0, 0.0),
  ('ws-aleman', 'Ceftriaxona',   'sin_consumo', 600,  0, 0.0),
  ('ws-aleman', 'Loratadina',    'sin_stock',     0,  0, 0.0),
  ('ws-aleman', 'Heparina',      'sin_consumo', 500,  0, 0.0),
  -- ── Hospital Francisco ──
  ('ws-francisco', 'Tramadol',     'critico',     70,   9, 0.1),
  ('ws-francisco', 'Furosemida',   'critico',     90,   7, 0.1),
  ('ws-francisco', 'Amoxicilina',  'bajo',       180,   5, 0.2),
  ('ws-francisco', 'Azitromicina', 'bajo',       220,   5, 0.2),
  ('ws-francisco', 'Ibuprofeno',   'bajo',       120,   4, 0.3),
  ('ws-francisco', 'Omeprazol',    'optimo',     500,   5, 0.2),
  ('ws-francisco', 'Clonazepam',   'optimo',     400,   5, 0.1),
  ('ws-francisco', 'Carvedilol',   'optimo',     450,   5, 0.1),
  ('ws-francisco', 'Paracetamol',  'optimo',     400,   4, 0.2),
  ('ws-francisco', 'Metformina',   'superavit', 1200,   2, 0.2),
  ('ws-francisco', 'Ringer Lactato','superavit', 2000,   2, 0.0),
  ('ws-francisco', 'Insulina NPH', 'superavit', 1500,   1, 0.0),
  ('ws-francisco', 'Salbutamol',   'sin_consumo', 300,  0, 0.0),
  ('ws-francisco', 'Montelukast',  'sin_consumo', 200,  0, 0.0),
  ('ws-francisco', 'Morfina',      'sin_stock',     0,  0, 0.0);

-- ─────────────────────────────────────────────────────────────
--  2. Ajustar stock de batches según target_stock
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v record;
  v_med_id text;
  v_total_batches int;
BEGIN
  FOR v IN SELECT * FROM tmp_trend_cat WHERE cat = 'sin_stock' LOOP
    SELECT id::text INTO v_med_id FROM medications
    WHERE name = v.med_name AND workspace_id = v.ws_id AND deleted_at IS NULL;
    IF v_med_id IS NOT NULL THEN
      UPDATE batches SET quantity = 0 WHERE medication_id = v_med_id;
    END IF;
  END LOOP;

  FOR v IN SELECT * FROM tmp_trend_cat WHERE cat IN ('critico','bajo','optimo','superavit') LOOP
    SELECT id::text INTO v_med_id FROM medications
    WHERE name = v.med_name AND workspace_id = v.ws_id AND deleted_at IS NULL;
    IF v_med_id IS NULL THEN CONTINUE; END IF;

    SELECT count(*) INTO v_total_batches FROM batches
    WHERE medication_id = v_med_id AND quantity > 0;

    IF v_total_batches > 0 THEN
      UPDATE batches
      SET quantity = GREATEST(v.target_stock / v_total_batches, 1)
      WHERE medication_id = v_med_id AND quantity > 0;
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
--  3. Generar movimientos de consumo diarios (últimos 30 días)
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v record;
  v_med_id text;
  v_wh_interna_id text;
  v_wh_ventas_id text;
  v_day int;
  v_date timestamptz;
  v_qty int;
  v_doctors text[] := ARRAY['Dr. García', 'Dra. Torres', 'Dra. Ríos', 'Dr. Mendoza', 'Dr. Gómez'];
  v_users text[] := ARRAY['M. Pérez', 'C. Ruiz', 'R. Díaz', 'V. Ortiz', 'Admin Demo'];
  v_reasons text[] := ARRAY[
    'Dispensación diaria', 'Consumo interno',
    'Administración a paciente', 'Tratamiento programado'
  ];
  v_patients_aleman text[] := ARRAY[
    'López, Carlos', 'Ramírez, Ana', 'Fernández, Roberto',
    'Morales, Lucía', 'Acosta, Hugo', 'Villalba, Marta'
  ];
  v_patients_francisco text[] := ARRAY[
    'Ibáñez, Carmen', 'Quispe, Andrés', 'Mamani, Rosa',
    'Condori, Pedro', 'Flores, Beatriz', 'Torrico, Juan'
  ];
  v_patients text[];
  v_doctor text;
  v_user text;
  v_reason text;
  v_patient text;
  v_mov_id text;
BEGIN
  FOR v IN SELECT * FROM tmp_trend_cat WHERE cat IN ('critico','bajo','optimo','superavit') LOOP
    SELECT id::text INTO v_med_id FROM medications
    WHERE name = v.med_name AND workspace_id = v.ws_id AND deleted_at IS NULL;
    IF v_med_id IS NULL THEN CONTINUE; END IF;

    SELECT id::text INTO v_wh_interna_id FROM warehouses
    WHERE workspace_id = v.ws_id AND type = 'interna' AND deleted_at IS NULL
    LIMIT 1;

    SELECT id::text INTO v_wh_ventas_id FROM warehouses
    WHERE workspace_id = v.ws_id AND type = 'ventas' AND deleted_at IS NULL
    LIMIT 1;

    v_patients := CASE WHEN v.ws_id = 'ws-aleman' THEN v_patients_aleman ELSE v_patients_francisco END;

    FOR v_day IN 0..29 LOOP
      v_date := NOW() - (v_day || ' days')::interval
                - INTERVAL '1 hour' * (6 + (random() * 12)::int);

      -- Movimiento de egreso/dispensación (consumo interno / paciente)
      IF v.daily_consumption > 0 AND v_wh_interna_id IS NOT NULL THEN
        v_qty := v.daily_consumption + (random() * 3)::int;
        v_doctor := v_doctors[1 + (random() * 4)::int];
        v_reason := v_reasons[1 + (random() * 3)::int];
        v_mov_id := 'demo-trend-mov-int-' || v.med_name || '-' || v.ws_id || '-' || v_day;

        INSERT INTO movements (id, workspace_id, type, medication_id, warehouse_id, quantity, user_name, reason, lot, date)
        VALUES (
          v_mov_id, v.ws_id,
          CASE WHEN random() < 0.3 THEN 'dispensacion' ELSE 'egreso' END,
          v_med_id, v_wh_interna_id, -v_qty,
          v_doctor, v_reason, NULL, v_date
        );

        -- Dispensación asociada
        INSERT INTO dispensations (id, workspace_id, medication_id, warehouse_id, quantity, doctor, patient, room, treatment, date)
        VALUES (
          'demo-trend-disp-' || v.med_name || '-' || v.ws_id || '-' || v_day,
          v.ws_id, v_med_id, v_wh_interna_id, v_qty,
          v_doctor,
          v_patients[1 + (random() * 5)::int],
          'Sala ' || (1 + (random() * 15)::int),
          v_reason,
          v_date
        );
      END IF;

      -- Venta ocasional
      IF v.daily_sales > 0 AND v_wh_ventas_id IS NOT NULL AND random() < v.daily_sales THEN
        v_qty := 1 + (random() * 2)::int;
        v_user := v_users[1 + (random() * 4)::int];
        v_mov_id := 'demo-trend-mov-ven-' || v.med_name || '-' || v.ws_id || '-' || v_day;

        INSERT INTO movements (id, workspace_id, type, medication_id, warehouse_id, quantity, user_name, reason, lot, date)
        VALUES (
          v_mov_id, v.ws_id, 'venta',
          v_med_id, v_wh_ventas_id, -v_qty,
          v_user, 'Venta mostrador', NULL, v_date
        );

        INSERT INTO sales (id, workspace_id, medication_id, warehouse_id, quantity, price, doctor, cashier, date)
        VALUES (
          'demo-trend-sale-' || v.med_name || '-' || v.ws_id || '-' || v_day,
          v.ws_id, v_med_id, v_wh_ventas_id, v_qty,
          v_qty * (1000 + (random() * 1500)::int),
          CASE WHEN random() < 0.3 THEN v_doctors[1 + (random() * 4)::int] ELSE NULL END,
          v_user, v_date
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
--  4. Pedidos médicos históricos
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v record;
  v_med_id text;
  v_wh_interna_id text;
  v_idx int;
  v_qty int;
  v_date timestamptz;
  v_doctors text[] := ARRAY['Dr. García', 'Dra. Torres', 'Dra. Ríos', 'Dr. Mendoza', 'Dr. Gómez'];
  v_reasons text[] := ARRAY[
    'Tratamiento antibiótico post-operatorio', 'Control de dolor agudo',
    'Protección gástrica', 'Hipertensión descompensada',
    'Control glucémico', 'Crisis asmática', 'Infección urinaria',
    'Neumonía bacteriana', 'Manejo de dolor crónico'
  ];
  v_patients_aleman text[] := ARRAY[
    'López, Carlos', 'Ramírez, Ana', 'Fernández, Roberto',
    'Morales, Lucía', 'Acosta, Hugo', 'Villalba, Marta',
    'Suárez, Pablo', 'Romero, Valeria', 'Castro, Ernesto'
  ];
  v_patients_francisco text[] := ARRAY[
    'Ibáñez, Carmen', 'Quispe, Andrés', 'Mamani, Rosa',
    'Condori, Pedro', 'Flores, Beatriz', 'Torrico, Juan',
    'Chávez, María', 'Rocha, David', 'Ortiz, Elena'
  ];
  v_statuses text[] := ARRAY['pendiente', 'aprobado', 'despachado', 'recibido', 'administrado', 'rechazado'];
  v_patients text[];
  v_proc_date timestamptz;
BEGIN
  v_idx := 0;

  FOR v IN SELECT * FROM tmp_trend_cat WHERE cat IN ('critico','bajo','optimo') LOOP
    SELECT id::text INTO v_med_id FROM medications
    WHERE name = v.med_name AND workspace_id = v.ws_id AND deleted_at IS NULL;
    IF v_med_id IS NULL THEN CONTINUE; END IF;

    SELECT id::text INTO v_wh_interna_id FROM warehouses
    WHERE workspace_id = v.ws_id AND type = 'interna' AND deleted_at IS NULL
    LIMIT 1;

    v_patients := CASE WHEN v.ws_id = 'ws-aleman' THEN v_patients_aleman ELSE v_patients_francisco END;

    FOR v_idx IN 0..14 LOOP
      v_date := NOW() - (v_idx || ' days')::interval
                - INTERVAL '1 hour' * (8 + (random() * 8)::int);
      v_qty := 5 + (random() * 25)::int;
      v_proc_date := CASE WHEN random() < 0.7
        THEN v_date + INTERVAL '1 hour' * (1 + (random() * 4)::int)
        ELSE NULL END;

      INSERT INTO medication_orders (
        id, workspace_id, medication_id, warehouse_id,
        quantity, doctor, patient, room, reason, status,
        requested_at, processed_at, processed_by
      ) VALUES (
        'demo-trend-ord-' || v.med_name || '-' || v.ws_id || '-' || v_idx,
        v.ws_id, v_med_id, v_wh_interna_id,
        v_qty,
        v_doctors[1 + (random() * 4)::int],
        v_patients[1 + (random() * 8)::int],
        'Sala ' || (1 + (random() * 20)::int),
        v_reasons[1 + (random() * 8)::int],
        v_statuses[1 + (random() * 4)::int],
        v_date, v_proc_date,
        CASE WHEN v_proc_date IS NOT NULL THEN 'Admin Demo' ELSE NULL END
      );
    END LOOP;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
--  5. Limpieza
-- ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS tmp_trend_cat;

COMMIT;
