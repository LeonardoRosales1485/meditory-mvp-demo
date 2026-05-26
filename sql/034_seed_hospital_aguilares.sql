-- ============================================================
--  MEDITORY — Seed: Hospital Aguilares
--  Escenario: 3 medicamentos con déficit crítico,
--  2 con sobrestock extremo, 2 lotes vencidos,
--  transferencias en distintos estados y licitaciones pendientes.
-- ============================================================

DO $$
DECLARE
  _ws  text := 'ws-aguilares';
  _pfx text := 'agu';
  _name text := 'Hospital Aguilares';
  _slug text := 'HOSPITALAGUILARES';

  _wh_ids text[]; _med_ids text[]; _user_ids text[];
  _tmp_wh RECORD; _tmp_user RECORD; _tmp_med RECORD;
  _wing_id uuid; _room_id uuid; _bed_id uuid; _patient_id uuid;
  _i int; _j int; _k int;
  _wing_idx int; _room_idx int; _med_idx int;
  _counter int := 0;
  _wing_types text[] := ARRAY['urgencias','quirofanos','cuidados_intensivos','hospitalizacion'];
  _wing_names text[] := ARRAY['Emergencias','Quirófanos','UTI','Internación'];
  _med_names text[] := ARRAY['Paracetamol','Ibuprofeno','Amoxicilina','Omeprazol','Salbutamol','Enalapril','Metformina','Diclofenac','Loratadina','Dexametasona','Atorvastatina','Losartán','Ceftriaxona','Heparina','Solución NaCl'];
  _med_ingredients text[] := ARRAY['Paracetamol','Ibuprofeno','Amoxicilina','Omeprazol','Salbutamol','Enalapril','Metformina','Diclofenac','Loratadina','Dexametasona','Atorvastatina','Losartán','Ceftriaxona','Heparina','Cloruro de sodio'];
  _med_concentrations numeric[] := ARRAY[500,400,875,20,100,10,850,75,10,8,20,50,1,5000,500];
  _med_units text[] := ARRAY['mg','mg','mg','mg','mcg','mg','mg','mg','mg','mg','mg','mg','g','unidad','ml'];
  _med_forms text[] := ARRAY['Comprimido','Comprimido','Cápsula','Cápsula','Aerosol','Comprimido','Comprimido','Inyectable','Comprimido','Inyectable','Comprimido','Comprimido','Inyectable','Inyectable','Solución'];
  _med_prices numeric[] := ARRAY[850,1200,2500,1500,3200,900,1100,1800,650,2200,2800,1700,4500,3800,600];
  _med_sale bool[] := ARRAY[true,true,true,true,true,true,true,true,true,true,true,true,true,false,false];

  -- Stock inicial — déficit en aspirina(1), metformina(7) y ceftriaxona(13)
  -- Sobrestock extremo en heparina(14) y loratadina(9)
  _stock_qty int[] := ARRAY[600,  2500, 1400, 1800, 500,  1200, 300,  600,  2000, 500,  1500, 600,  80,   800,  12000];
  _min_central int[] := ARRAY[1200, 1500, 1200, 1200, 600,  800,  1000, 500,  400,  300,  800,  600,  200,  150,  8000];
  _opt_central int[] := ARRAY[2200, 2600, 2000, 2000, 1000, 1400, 1800, 900,  700,  600,  1400, 1000, 380,  280,  15000];

  _min_interna int[] := ARRAY[240, 300, 240, 240, 120, 160, 200, 100, 80,  60, 160, 120, 40,  30, 1600];
  _opt_interna int[] := ARRAY[440, 520, 400, 400, 200, 280, 360, 180, 140, 120, 280, 200, 76,  56, 3000];

  _min_ventas int[] := ARRAY[75, 80, 70, 70, 35, 30, 60, 25, 25, 15, 25, 25, 12, 0, 0];
  _opt_ventas int[] := ARRAY[135, 140, 120, 120, 60, 55, 105, 45, 45, 30, 45, 45, 25, 0, 0];

  -- Pacientes
  _patient_last text[] := ARRAY['Godoy','Méndez','Torres','Castillo','Álvarez','Rojas','Vera','Cabrera','Ibáñez','Moreno'];
  _patient_first text[] := ARRAY['Diego','Camila','Federico','Valentina','Ignacio','Teresa','Martín','Jimena','Alejandro','Liliana'];
  _patient_insurance text[] := ARRAY['OSDE','PAMI','IOMA','Swiss Medical','OSDE','PAMI','IOMA','Swiss Medical','OSDE','PAMI'];
  _patient_diagnosis text[] := ARRAY['Neumonía adquirida','ACV hemorrágico','Fractura de fémur','Insuficiencia renal','Colecistitis aguda','Pancreatitis','Crisis asmática','Deshidratación severa','Infección urinaria','Neumotórax'];
  _patient_doctor text[] := ARRAY['Dr. Godoy','Dra. Rojas','Dr. Cabrera','Dra. Torres','Dr. Godoy','Dra. Rojas','Dr. Cabrera','Dra. Torres','Dr. Godoy','Dra. Rojas'];

  -- Usuarios
  _users_role text[] := ARRAY['admin','ventas','doctor','tecnico'];
  _users_name text[] := ARRAY['Admin Aguilares','Ventas Aguilares','Doctor Aguilares','Técnico Aguilares'];
  _users_email text[] := ARRAY['agu.admin@hospitalaguilares.com','agu.ventas@hospitalaguilares.com','agu.doctor@hospitalaguilares.com','agu.tecnico@hospitalaguilares.com'];

  _random_users text[];
  _room_numbers int[] := ARRAY[1,2,3,4,5,6,7,8,9,10];
  _bed_counts int[] := ARRAY[2,2,3,2,2,3,2,2,3,2];
  _usr_name text; _usr_role text;
  _expiry_date date;
  _trf_statuses text[] := ARRAY['solicitado','solicitado','autorizado','autorizado','despachado','recibido'];
  _trf_from_whs text[] := ARRAY['wh-agu-central','wh-agu-central','wh-agu-central','wh-agu-central','wh-agu-interna','wh-agu-interna'];
  _trf_to_whs text[] := ARRAY['wh-agu-interna','wh-agu-interna','wh-agu-interna','wh-agu-ventas','wh-agu-ventas','wh-agu-ventas'];

BEGIN

  DROP TABLE IF EXISTS _twh, _tusr, _tmed, _tpt;
  CREATE TEMP TABLE _twh (id text, type text);
  CREATE TEMP TABLE _tusr (id text, name text, role text);
  CREATE TEMP TABLE _tmed (id text, name text, sale_enabled bool);
  CREATE TEMP TABLE _tpt (id uuid);

  DELETE FROM audit_log WHERE id LIKE 'aud-agu-%';
  DELETE FROM medication_orders WHERE id LIKE 'ord-' || _ws || '-%';
  DELETE FROM dispensations WHERE id LIKE 'disp-' || _ws || '-%';
  DELETE FROM sales WHERE id LIKE 'sale-' || _ws || '-%';
  DELETE FROM transfer_requests WHERE id LIKE 'trf-' || _ws || '-%';
  DELETE FROM movements WHERE id LIKE 'm24-agu-%';
  DELETE FROM medication_stock_config WHERE medication_id LIKE 'med-agu-%';
  DELETE FROM batches WHERE id LIKE 'b24-agu-%';
  DELETE FROM workspace_user_warehouses WHERE user_id LIKE 'u-agu-%';
  DELETE FROM workspace_users WHERE id LIKE 'u-agu-%';
  DELETE FROM patients WHERE workspace_id = _ws;
  DELETE FROM beds WHERE room_id IN (SELECT id FROM rooms WHERE workspace_id = _ws);
  DELETE FROM rooms WHERE workspace_id = _ws;
  DELETE FROM wings WHERE workspace_id = _ws;
  DELETE FROM medications WHERE id LIKE 'med-agu-%';
  DELETE FROM warehouses WHERE id LIKE 'wh-agu-%';
  DELETE FROM workspaces WHERE id = _ws;

  -- ══════════════════════════════════════════
  --  1. WORKSPACE
  -- ══════════════════════════════════════════
  INSERT INTO workspaces (id, name, slug) VALUES (_ws, _name, _slug) ON CONFLICT (id) DO NOTHING;

  -- ══════════════════════════════════════════
  --  2. WAREHOUSES (3)
  -- ══════════════════════════════════════════
  INSERT INTO warehouses (id, workspace_id, name, type, unit) VALUES
    ('wh-agu-central', _ws, 'Depósito Central',    'central', _name),
    ('wh-agu-interna', _ws, 'Farmacia Interna',    'interna', _name),
    ('wh-agu-ventas',  _ws, 'Farmacia Ventas',     'ventas',  _name)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO _twh VALUES ('wh-agu-central','central'), ('wh-agu-interna','interna'), ('wh-agu-ventas','ventas');
  SELECT ARRAY_AGG(id) INTO _wh_ids FROM _twh;

  -- ══════════════════════════════════════════
  --  3. USERS (4)
  -- ══════════════════════════════════════════
  FOR _i IN 1..4 LOOP
    INSERT INTO workspace_users (id, workspace_id, name, email, role)
    VALUES ('u-agu-' || _users_role[_i], _ws, _users_name[_i], _users_email[_i], _users_role[_i])
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO _tusr VALUES ('u-agu-' || _users_role[_i], _users_name[_i], _users_role[_i]);
  END LOOP;
  SELECT ARRAY_AGG(id) INTO _user_ids FROM _tusr;

  -- ══════════════════════════════════════════
  --  4. WAREHOUSE ACCESS
  -- ══════════════════════════════════════════
  FOR _i IN 1..array_length(_user_ids,1) LOOP
    SELECT role INTO _usr_role FROM _tusr WHERE id = _user_ids[_i];
    IF _usr_role = 'admin' THEN
      INSERT INTO workspace_user_warehouses (user_id, warehouse_id) SELECT _user_ids[_i], id FROM _twh;
    ELSIF _usr_role = 'ventas' THEN
      INSERT INTO workspace_user_warehouses (user_id, warehouse_id) SELECT _user_ids[_i], id FROM _twh WHERE type = 'ventas';
    ELSIF _usr_role = 'doctor' THEN
      INSERT INTO workspace_user_warehouses (user_id, warehouse_id) SELECT _user_ids[_i], id FROM _twh WHERE type = 'interna';
    ELSIF _usr_role = 'tecnico' THEN
      INSERT INTO workspace_user_warehouses (user_id, warehouse_id) SELECT _user_ids[_i], id FROM _twh WHERE type IN ('central','interna');
    END IF;
  END LOOP;

  -- ══════════════════════════════════════════
  --  5. MEDICATIONS (15)
  -- ══════════════════════════════════════════
  FOR _i IN 1..15 LOOP
    INSERT INTO medications (id, workspace_id, name, active_ingredient, concentration_value, concentration_unit, form, sale_price, sale_enabled)
    VALUES ('med-agu-' || LPAD(_i::text,2,'0'), _ws, _med_names[_i], _med_ingredients[_i],
      _med_concentrations[_i], _med_units[_i], _med_forms[_i], _med_prices[_i], _med_sale[_i])
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO _tmed VALUES ('med-agu-' || LPAD(_i::text,2,'0'), _med_names[_i], _med_sale[_i]);
  END LOOP;
  SELECT ARRAY_AGG(id) INTO _med_ids FROM _tmed;

  -- ══════════════════════════════════════════
  --  6. WINGS (4)
  -- ══════════════════════════════════════════
  FOR _i IN 1..4 LOOP
    INSERT INTO wings (workspace_id, name, type, prefix)
    VALUES (_ws, _wing_names[_i], _wing_types[_i], _i)
    ON CONFLICT (workspace_id, name) DO NOTHING;
  END LOOP;

  -- ══════════════════════════════════════════
  --  7. ROOMS & BEDS (10 rooms × 4 wings)
  -- ══════════════════════════════════════════
  FOR _wing_idx IN 1..4 LOOP
    SELECT id INTO _wing_id FROM wings WHERE workspace_id = _ws AND prefix = _wing_idx;
    FOR _room_idx IN 1..10 LOOP
      INSERT INTO rooms (workspace_id, wing_id, number, bed_count)
      VALUES (_ws, _wing_id, _room_numbers[_room_idx], _bed_counts[_room_idx])
      ON CONFLICT (workspace_id, wing_id, number) DO NOTHING
      RETURNING id INTO _room_id;
      IF _room_id IS NULL THEN
        SELECT id INTO _room_id FROM rooms WHERE workspace_id = _ws AND wing_id = _wing_id AND number = _room_numbers[_room_idx];
      END IF;
      FOR _i IN 1.._bed_counts[_room_idx] LOOP
        INSERT INTO beds (room_id, position) VALUES (_room_id, _i) ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;

  -- ══════════════════════════════════════════
  --  8. PATIENTS (10)
  -- ══════════════════════════════════════════
  FOR _i IN 1..10 LOOP
    INSERT INTO patients (workspace_id, first_name, last_name, insurance, diagnosis, assigned_doctor, room)
    VALUES (_ws, _patient_first[_i], _patient_last[_i], _patient_insurance[_i], _patient_diagnosis[_i], _patient_doctor[_i], 'Sala ' || _i)
    RETURNING id INTO _patient_id;
    INSERT INTO _tpt VALUES (_patient_id);
  END LOOP;

  FOR _patient_id IN SELECT id FROM _tpt ORDER BY id LOOP
    SELECT b.id INTO _bed_id FROM beds b JOIN rooms r ON r.id = b.room_id
    WHERE b.patient_id IS NULL ORDER BY b.id LIMIT 1;
    IF _bed_id IS NOT NULL THEN
      UPDATE beds SET patient_id = _patient_id WHERE id = _bed_id;
    END IF;
  END LOOP;
  UPDATE patients p SET room = CONCAT('Sala ', r.full_number::text)
  FROM beds b JOIN rooms r ON r.id = b.room_id WHERE b.patient_id = p.id;

  -- ══════════════════════════════════════════
  --  9. BATCHES (stock variado)
  -- ══════════════════════════════════════════
  -- Escenario:
  --   meds 1,7,13    → DÉFICIT CRÍTICO
  --   meds 9,14      → SOBRESTOCK extremo
  --   resto          → stock normal
  --   2 lotes vencidos, 2 próximos a vencer

  -- Central: 15 meds
  FOR _med_idx IN 1..15 LOOP
    _expiry_date := CASE
      WHEN _med_idx IN (1,7,13) THEN NOW()::date + 30    -- déficit + próximos a vencer
      WHEN _med_idx IN (9,14) THEN NOW()::date + 330     -- sobrestock
      ELSE NOW()::date + (100 + _med_idx*25)
    END;
    INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
    VALUES ('b24-agu-c-' || LPAD(_med_idx::text,2,'0'), _med_ids[_med_idx], 'wh-agu-central',
      'AGU-C-' || LPAD(_med_idx::text,3,'0'), _expiry_date, _stock_qty[_med_idx]);
  END LOOP;

  -- Interna: 15 meds
  FOR _med_idx IN 1..15 LOOP
    _expiry_date := NOW()::date + (70 + _med_idx*12);
    INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
    VALUES ('b24-agu-i-' || LPAD(_med_idx::text,2,'0'), _med_ids[_med_idx], 'wh-agu-interna',
      'AGU-I-' || LPAD(_med_idx::text,3,'0'), _expiry_date,
      CASE WHEN _med_idx IN (9,14) THEN (_stock_qty[_med_idx]*0.5)::int
           ELSE GREATEST((_stock_qty[_med_idx]*0.2)::int, 2)
      END);
  END LOOP;

  -- Ventas: 13 meds
  FOR _med_idx IN 1..13 LOOP
    _expiry_date := NOW()::date + (40 + _med_idx*20);
    INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
    VALUES ('b24-agu-v-' || LPAD(_med_idx::text,2,'0'), _med_ids[_med_idx], 'wh-agu-ventas',
      'AGU-V-' || LPAD(_med_idx::text,3,'0'), _expiry_date,
      GREATEST((_stock_qty[_med_idx]*0.06)::int, 1));
  END LOOP;

  -- ═══════════════════════════════════════════
  --  LOTES VENCIDOS (2) y PRÓXIMOS A VENCER (2)
  -- ═══════════════════════════════════════════
  -- 2 vencidos: Paracetamol (med 1) y Diclofenac (med 8) en central
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-agu-c-01-exp', _med_ids[1], 'wh-agu-central', 'AGU-C-001-EXP', NOW()::date - 20, 300);
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-agu-c-08-exp', _med_ids[8], 'wh-agu-central', 'AGU-C-008-EXP', NOW()::date - 8, 150);

  -- 2 próximos a vencer: Amoxicilina (med 3) y Loratadina (med 9)
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-agu-c-03-prox', _med_ids[3], 'wh-agu-central', 'AGU-C-003-PROX', NOW()::date + 10, 500);
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-agu-c-09-prox', _med_ids[9], 'wh-agu-central', 'AGU-C-009-PROX', NOW()::date + 4, 800);

  -- ══════════════════════════════════════════
  --  10. STOCK CONFIG
  -- ══════════════════════════════════════════
  FOR _med_idx IN 1..15 LOOP
    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
    VALUES (_med_ids[_med_idx], 'wh-agu-central', _min_central[_med_idx], _opt_central[_med_idx])
    ON CONFLICT (medication_id, warehouse_id) DO NOTHING;
  END LOOP;
  FOR _med_idx IN 1..15 LOOP
    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
    VALUES (_med_ids[_med_idx], 'wh-agu-interna', _min_interna[_med_idx], _opt_interna[_med_idx])
    ON CONFLICT (medication_id, warehouse_id) DO NOTHING;
  END LOOP;
  FOR _med_idx IN 1..13 LOOP
    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
    VALUES (_med_ids[_med_idx], 'wh-agu-ventas', _min_ventas[_med_idx], _opt_ventas[_med_idx])
    ON CONFLICT (medication_id, warehouse_id) DO NOTHING;
  END LOOP;

  -- ══════════════════════════════════════════
  --  11. CAPACIDAD / VOLUMEN
  -- ══════════════════════════════════════════
  UPDATE warehouses SET max_capacity = 26000 WHERE id = 'wh-agu-central';
  UPDATE warehouses SET max_capacity =  7500 WHERE id = 'wh-agu-interna';
  UPDATE warehouses SET max_capacity =  2200 WHERE id = 'wh-agu-ventas';
  UPDATE warehouses w SET volume = COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.warehouse_id = w.id), 0)
  WHERE w.id IN ('wh-agu-central','wh-agu-interna','wh-agu-ventas');

  -- ══════════════════════════════════════════
  --  12. MOVEMENTS
  -- ══════════════════════════════════════════
  SELECT ARRAY_AGG(DISTINCT name) INTO _random_users FROM _tusr;
  _counter := 0;
  -- Ingresos: 2 × 15 meds
  FOR _med_idx IN 1..15 LOOP
    FOR _j IN 1..2 LOOP
      _counter := _counter + 1;
      INSERT INTO movements (id, workspace_id, type, medication_id, warehouse_id, quantity, user_name, reason, date)
      VALUES ('m24-agu-' || LPAD(_counter::text,3,'0'), _ws, 'ingreso', _med_ids[_med_idx], 'wh-agu-central',
        (_stock_qty[_med_idx]*(0.2+random()*0.4))::int,
        _random_users[1+floor(random()*array_length(_random_users,1))::int],
        'OC-AGU-' || LPAD((4000+_counter)::text,4,'0'),
        NOW() - INTERVAL '1 day' * (8+_med_idx*2+_j*6))
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
  -- Egresos: 2 × 15 meds
  FOR _med_idx IN 1..15 LOOP
    FOR _j IN 1..2 LOOP
      _counter := _counter + 1;
      INSERT INTO movements (id, workspace_id, type, medication_id, warehouse_id, quantity, user_name, reason, date)
      VALUES ('m24-agu-' || LPAD(_counter::text,3,'0'), _ws, 'egreso', _med_ids[_med_idx], 'wh-agu-central',
        -((_stock_qty[_med_idx]*(0.02+random()*0.03))::int),
        _random_users[1+floor(random()*array_length(_random_users,1))::int],
        'Consumo general',
        NOW() - INTERVAL '1 day' * (4+_med_idx*2+_j*5))
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ══════════════════════════════════════════
  --  13. TRANSFER REQUESTS (6, varios estados)
  -- ══════════════════════════════════════════
  INSERT INTO transfer_code_counters (workspace_id, period_yyyymm, last_value)
  VALUES (_ws, TO_CHAR(NOW(),'YYYYMM'), 0)
  ON CONFLICT (workspace_id, period_yyyymm) DO NOTHING;

  FOR _med_idx IN 1..6 LOOP
    INSERT INTO transfer_requests (id, workspace_id, transfer_code, medication_id, from_warehouse_id, to_warehouse_id, quantity, status, requested_by, date)
    VALUES ('trf-' || _ws || '-' || _med_idx, _ws,
      TO_CHAR(NOW(),'YYYYMM') || '-' || LPAD(_med_idx::text,5,'0'),
      _med_ids[_med_idx], _trf_from_whs[_med_idx], _trf_to_whs[_med_idx],
      20+_med_idx*12,
      _trf_statuses[_med_idx],
      _random_users[1+floor(random()*array_length(_random_users,1))::int],
      NOW() - INTERVAL '1 day' * (random()*18)::int)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- ══════════════════════════════════════════
  --  14. SALES (15 meds × 2 each)
  -- ══════════════════════════════════════════
  _counter := 0;
  FOR _med_idx IN 1..15 LOOP
    FOR _j IN 1..2 LOOP
      _counter := _counter + 1;
      INSERT INTO sales (id, workspace_id, medication_id, warehouse_id, quantity, price, cashier, date)
      VALUES ('sale-' || _ws || '-' || _counter, _ws, _med_ids[_med_idx], 'wh-agu-ventas',
        1+floor(random()*5)::int, _med_prices[_med_idx]*(1+floor(random()*5)::int),
        _random_users[1+floor(random()*array_length(_random_users,1))::int],
        NOW() - INTERVAL '1 day' * (random()*28)::int)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ══════════════════════════════════════════
  --  15. DISPENSATIONS (10 meds × 4 patients)
  -- ══════════════════════════════════════════
  _counter := 0;
  FOR _med_idx IN 1..10 LOOP
    FOR _patient_id IN SELECT id FROM _tpt ORDER BY id LIMIT 4 LOOP
      _counter := _counter + 1;
      INSERT INTO dispensations (id, workspace_id, medication_id, warehouse_id, quantity, doctor, patient, room, treatment, date)
      VALUES ('disp-' || _ws || '-' || _counter, _ws, _med_ids[_med_idx], 'wh-agu-interna',
        1+floor(random()*10)::int,
        (ARRAY['Dr. Godoy','Dra. Rojas','Dr. Cabrera','Dra. Torres'])[1+floor(random()*4)::int],
        (SELECT _patient_first[1] || ' ' || _patient_last[1]),
        'Sala ' || (1+floor(random()*18)::int),
        (ARRAY['Antibiótico','Analgesia','Antihipertensivo','Antiinflamatorio','Broncodilatador','Hidratación','Insulina','Anticoagulante'])[1+floor(random()*8)::int],
        NOW() - INTERVAL '1 day' * (random()*12)::int)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ══════════════════════════════════════════
  --  16. MEDICATION ORDERS / LICITACIONES (10)
  --  Incluye 4 pendientes (visibles en backoffice)
  -- ══════════════════════════════════════════
  _counter := 0;
  FOR _med_idx IN 1..10 LOOP
    FOR _patient_id IN SELECT id FROM _tpt ORDER BY id LIMIT 1 LOOP
      _counter := _counter + 1;
      INSERT INTO medication_orders (id, workspace_id, medication_id, warehouse_id, quantity, doctor, patient, room, reason, status, requested_at)
      VALUES ('ord-' || _ws || '-' || _counter, _ws, _med_ids[_med_idx], 'wh-agu-interna',
        CASE WHEN _med_idx IN (1,7,13) THEN 150+floor(random()*250)::int
             ELSE 10+floor(random()*50)::int
        END,
        (ARRAY['Dr. Godoy','Dra. Rojas','Dr. Cabrera','Dra. Torres'])[1+floor(random()*4)::int],
        (SELECT _patient_first[1] || ' ' || _patient_last[1]),
        'Sala ' || (1+floor(random()*18)::int),
        (ARRAY['Déficit crítico de stock','Reposición urgente','Cirugía programada','Tratamiento intensivo','Emergencia','Stock insuficiente','Paciente crítico'])[1+floor(random()*7)::int],
        (ARRAY['pendiente','pendiente','pendiente','pendiente','aprobado','despachado','recibido','aprobado','despachado','recibido'])[_counter],
        NOW() - INTERVAL '1 day' * (3+floor(random()*15)::int))
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ══════════════════════════════════════════
  --  17. AUDIT LOG (20 entradas)
  -- ══════════════════════════════════════════
  FOR _i IN 1..20 LOOP
    INSERT INTO audit_log (id, workspace_id, user_name, action, entity, date)
    VALUES ('aud-agu-' || LPAD(_i::text,3,'0'), _ws,
      _random_users[1+floor(random()*array_length(_random_users,1))::int],
      (ARRAY['Lote vencido retirado','Ingreso de mercadería','Venta registrada','Dispensación','Transferencia solicitada','Transferencia recibida','Alta de medicamento','Ajuste de stock','Alta de paciente','Pedido médico urgente','Licitación creada','Stock crítico reportado'])[1+floor(random()*12)::int],
      (ARRAY['Paracetamol','Diclofenac','Loratadina','Ceftriaxona','Lote AGU-C-001-EXP','Transferencia AGU','Venta','Paciente','Depósito Central','Pedido médico'])[1+floor(random()*10)::int],
      NOW() - INTERVAL '1 day' * (random()*30)::int)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  DROP TABLE IF EXISTS _twh, _tusr, _tmed, _tpt;

  RAISE NOTICE '✅ % creado con éxito (ws: %, slug: %)', _name, _ws, _slug;
END $$;
