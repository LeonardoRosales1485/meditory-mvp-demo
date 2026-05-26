-- ============================================================
--  MEDITORY — Seed: Hospital Néstor Kirchner
--  Escenario: 2 medicamentos con déficit crítico,
--  3 con sobrestock, 2 lotes vencidos,
--  vencimientos próximos, 8 transferencias,
--  licitaciones urgentes y paciente crítico.
-- ============================================================

DO $$
DECLARE
  _ws  text := 'ws-kirchner';
  _pfx text := 'kir';
  _name text := 'Hospital Néstor Kirchner';
  _slug text := 'HOSPITALKIRCHNER';

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

  -- Stock inicial — déficit en salbutamol(5) y losartán(12)
  -- Sobrestock en ibuprofeno(2), atorvastatina(11) y heparina(14)
  _stock_qty int[] := ARRAY[2500, 6000, 1600, 2000, 120,  1500, 3000, 700,  500,  600,  3500, 200,  300,  1200, 14000];
  _min_central int[] := ARRAY[1400, 2000, 1200, 1300, 500,  900,  2000, 600,  500,  400,  1000, 600,  250,  200,  9000];
  _opt_central int[] := ARRAY[2400, 3500, 2000, 2200, 900,  1500, 3500, 1000, 900,  700,  1800, 1000, 450,  350,  16000];

  _min_interna int[] := ARRAY[280, 400, 240, 260, 100, 180, 400, 120, 100, 80, 200, 120, 50, 40, 1800];
  _opt_interna int[] := ARRAY[480, 700, 400, 440, 180, 300, 700, 200, 180, 140, 360, 200, 90, 70, 3200];

  _min_ventas int[] := ARRAY[85, 100, 70, 75, 30, 35, 70, 30, 25, 20, 35, 25, 15, 0, 0];
  _opt_ventas int[] := ARRAY[145, 180, 120, 125, 55, 60, 120, 55, 45, 35, 65, 45, 25, 0, 0];

  -- Pacientes
  _patient_last text[] := ARRAY['Santos','Pereira','Acosta','Olivera','Bravo','Duarte','Ferrari','Mansilla','Ledesma','Arias'];
  _patient_first text[] := ARRAY['Ricardo','Beatriz','Emilio','Claudia','Alberto','Andrea','Martín','Paulina','Héctor','Lorena'];
  _patient_insurance text[] := ARRAY['OSDE','PAMI','IOMA','Swiss Medical','OSDE','PAMI','IOMA','Swiss Medical','OSDE','PAMI'];
  _patient_diagnosis text[] := ARRAY['PCR parado','Shock séptico','IAM con elevación ST','Insuficiencia respiratoria','Hemorragia digestiva','Neumotórax hipertensivo','TCE grave','Quemadura 2do grado','Fractura expuesta','Peritonitis'];
  _patient_doctor text[] := ARRAY['Dr. Ferrari','Dra. Duarte','Dr. Santos','Dra. Bravo','Dr. Ferrari','Dra. Duarte','Dr. Santos','Dra. Bravo','Dr. Ferrari','Dra. Duarte'];

  -- Usuarios
  _users_role text[] := ARRAY['admin','ventas','doctor','tecnico'];
  _users_name text[] := ARRAY['Admin Kirchner','Ventas Kirchner','Doctor Kirchner','Técnico Kirchner'];
  _users_email text[] := ARRAY['kir.admin@hospitalkirchner.com','kir.ventas@hospitalkirchner.com','kir.doctor@hospitalkirchner.com','kir.tecnico@hospitalkirchner.com'];

  _random_users text[];
  _room_numbers int[] := ARRAY[1,2,3,4,5,6,7,8,9,10];
  _bed_counts int[] := ARRAY[3,3,2,3,2,3,2,3,2,2];
  _usr_name text; _usr_role text;
  _expiry_date date;
  _trf_statuses text[] := ARRAY['solicitado','solicitado','solicitado','autorizado','autorizado','despachado','despachado','recibido'];
  _trf_from_whs text[] := ARRAY['wh-kir-central','wh-kir-central','wh-kir-central','wh-kir-central','wh-kir-interna','wh-kir-central','wh-kir-interna','wh-kir-central'];
  _trf_to_whs text[] := ARRAY['wh-kir-interna','wh-kir-interna','wh-kir-ventas','wh-kir-interna','wh-kir-ventas','wh-kir-interna','wh-kir-ventas','wh-kir-interna'];

BEGIN

  DROP TABLE IF EXISTS _twh, _tusr, _tmed, _tpt;
  CREATE TEMP TABLE _twh (id text, type text);
  CREATE TEMP TABLE _tusr (id text, name text, role text);
  CREATE TEMP TABLE _tmed (id text, name text, sale_enabled bool);
  CREATE TEMP TABLE _tpt (id uuid);

  DELETE FROM audit_log WHERE id LIKE 'aud-kir-%';
  DELETE FROM medication_orders WHERE id LIKE 'ord-' || _ws || '-%';
  DELETE FROM dispensations WHERE id LIKE 'disp-' || _ws || '-%';
  DELETE FROM sales WHERE id LIKE 'sale-' || _ws || '-%';
  DELETE FROM transfer_requests WHERE id LIKE 'trf-' || _ws || '-%';
  DELETE FROM movements WHERE id LIKE 'm24-kir-%';
  DELETE FROM medication_stock_config WHERE medication_id LIKE 'med-kir-%';
  DELETE FROM batches WHERE id LIKE 'b24-kir-%';
  DELETE FROM workspace_user_warehouses WHERE user_id LIKE 'u-kir-%';
  DELETE FROM workspace_users WHERE id LIKE 'u-kir-%';
  DELETE FROM patients WHERE workspace_id = _ws;
  DELETE FROM beds WHERE room_id IN (SELECT id FROM rooms WHERE workspace_id = _ws);
  DELETE FROM rooms WHERE workspace_id = _ws;
  DELETE FROM wings WHERE workspace_id = _ws;
  DELETE FROM medications WHERE id LIKE 'med-kir-%';
  DELETE FROM warehouses WHERE id LIKE 'wh-kir-%';
  DELETE FROM workspaces WHERE id = _ws;

  -- ══════════════════════════════════════════
  --  1. WORKSPACE
  -- ══════════════════════════════════════════
  INSERT INTO workspaces (id, name, slug) VALUES (_ws, _name, _slug) ON CONFLICT (id) DO NOTHING;

  -- ══════════════════════════════════════════
  --  2. WAREHOUSES (3)
  -- ══════════════════════════════════════════
  INSERT INTO warehouses (id, workspace_id, name, type, unit) VALUES
    ('wh-kir-central', _ws, 'Depósito Central',    'central', _name),
    ('wh-kir-interna', _ws, 'Farmacia Interna',    'interna', _name),
    ('wh-kir-ventas',  _ws, 'Farmacia Ventas',     'ventas',  _name)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO _twh VALUES ('wh-kir-central','central'), ('wh-kir-interna','interna'), ('wh-kir-ventas','ventas');
  SELECT ARRAY_AGG(id) INTO _wh_ids FROM _twh;

  -- ══════════════════════════════════════════
  --  3. USERS (4)
  -- ══════════════════════════════════════════
  FOR _i IN 1..4 LOOP
    INSERT INTO workspace_users (id, workspace_id, name, email, role)
    VALUES ('u-kir-' || _users_role[_i], _ws, _users_name[_i], _users_email[_i], _users_role[_i])
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO _tusr VALUES ('u-kir-' || _users_role[_i], _users_name[_i], _users_role[_i]);
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
    VALUES ('med-kir-' || LPAD(_i::text,2,'0'), _ws, _med_names[_i], _med_ingredients[_i],
      _med_concentrations[_i], _med_units[_i], _med_forms[_i], _med_prices[_i], _med_sale[_i])
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO _tmed VALUES ('med-kir-' || LPAD(_i::text,2,'0'), _med_names[_i], _med_sale[_i]);
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
  --  8. PATIENTS (10 críticos)
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
  --   meds 5,12      → DÉFICIT CRÍTICO (salbutamol, losartán)
  --   meds 2,11,14   → SOBRESTOCK (ibuprofeno, atorvastatina, heparina)
  --   resto          → stock normal
  --   2 lotes vencidos, 2 próximos a vencer

  -- Central: 15 meds
  FOR _med_idx IN 1..15 LOOP
    _expiry_date := CASE
      WHEN _med_idx IN (5,12) THEN NOW()::date + 20     -- déficit + muy próximos
      WHEN _med_idx IN (2,11,14) THEN NOW()::date + 280 -- sobrestock
      ELSE NOW()::date + (130 + _med_idx*10)
    END;
    INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
    VALUES ('b24-kir-c-' || LPAD(_med_idx::text,2,'0'), _med_ids[_med_idx], 'wh-kir-central',
      'KIR-C-' || LPAD(_med_idx::text,3,'0'), _expiry_date, _stock_qty[_med_idx]);
  END LOOP;

  -- Interna: 15 meds
  FOR _med_idx IN 1..15 LOOP
    _expiry_date := NOW()::date + (60 + _med_idx*15);
    INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
    VALUES ('b24-kir-i-' || LPAD(_med_idx::text,2,'0'), _med_ids[_med_idx], 'wh-kir-interna',
      'KIR-I-' || LPAD(_med_idx::text,3,'0'), _expiry_date,
      CASE WHEN _med_idx IN (2,11,14) THEN (_stock_qty[_med_idx]*0.35)::int
           ELSE GREATEST((_stock_qty[_med_idx]*0.18)::int, 2)
      END);
  END LOOP;

  -- Ventas: 13 meds
  FOR _med_idx IN 1..13 LOOP
    _expiry_date := NOW()::date + (50 + _med_idx*15);
    INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
    VALUES ('b24-kir-v-' || LPAD(_med_idx::text,2,'0'), _med_ids[_med_idx], 'wh-kir-ventas',
      'KIR-V-' || LPAD(_med_idx::text,3,'0'), _expiry_date,
      GREATEST((_stock_qty[_med_idx]*0.05)::int, 1));
  END LOOP;

  -- ═══════════════════════════════════════════
  --  LOTES VENCIDOS (2) y PRÓXIMOS A VENCER (2)
  -- ═══════════════════════════════════════════
  -- 2 vencidos: Omeprazol (med 4) y Enalapril (med 6) en central
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-kir-c-04-exp', _med_ids[4], 'wh-kir-central', 'KIR-C-004-EXP', NOW()::date - 25, 400);
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-kir-c-06-exp', _med_ids[6], 'wh-kir-central', 'KIR-C-006-EXP', NOW()::date - 10, 250);

  -- 2 próximos a vencer: Salbutamol (med 5) y Ceftriaxona (med 13)
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-kir-c-05-prox', _med_ids[5], 'wh-kir-central', 'KIR-C-005-PROX', NOW()::date + 6, 60);
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-kir-c-13-prox', _med_ids[13], 'wh-kir-central', 'KIR-C-013-PROX', NOW()::date + 9, 120);

  -- ══════════════════════════════════════════
  --  10. STOCK CONFIG
  -- ══════════════════════════════════════════
  FOR _med_idx IN 1..15 LOOP
    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
    VALUES (_med_ids[_med_idx], 'wh-kir-central', _min_central[_med_idx], _opt_central[_med_idx])
    ON CONFLICT (medication_id, warehouse_id) DO NOTHING;
  END LOOP;
  FOR _med_idx IN 1..15 LOOP
    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
    VALUES (_med_ids[_med_idx], 'wh-kir-interna', _min_interna[_med_idx], _opt_interna[_med_idx])
    ON CONFLICT (medication_id, warehouse_id) DO NOTHING;
  END LOOP;
  FOR _med_idx IN 1..13 LOOP
    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
    VALUES (_med_ids[_med_idx], 'wh-kir-ventas', _min_ventas[_med_idx], _opt_ventas[_med_idx])
    ON CONFLICT (medication_id, warehouse_id) DO NOTHING;
  END LOOP;

  -- ══════════════════════════════════════════
  --  11. CAPACIDAD / VOLUMEN
  -- ══════════════════════════════════════════
  UPDATE warehouses SET max_capacity = 35000 WHERE id = 'wh-kir-central';
  UPDATE warehouses SET max_capacity =  8500 WHERE id = 'wh-kir-interna';
  UPDATE warehouses SET max_capacity =  3000 WHERE id = 'wh-kir-ventas';
  UPDATE warehouses w SET volume = COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.warehouse_id = w.id), 0)
  WHERE w.id IN ('wh-kir-central','wh-kir-interna','wh-kir-ventas');

  -- ══════════════════════════════════════════
  --  12. MOVEMENTS
  -- ══════════════════════════════════════════
  SELECT ARRAY_AGG(DISTINCT name) INTO _random_users FROM _tusr;
  _counter := 0;
  -- Ingresos: 3 × 15 meds
  FOR _med_idx IN 1..15 LOOP
    FOR _j IN 1..3 LOOP
      _counter := _counter + 1;
      INSERT INTO movements (id, workspace_id, type, medication_id, warehouse_id, quantity, user_name, reason, date)
      VALUES ('m24-kir-' || LPAD(_counter::text,3,'0'), _ws, 'ingreso', _med_ids[_med_idx], 'wh-kir-central',
        (_stock_qty[_med_idx]*(0.2+random()*0.3))::int,
        _random_users[1+floor(random()*array_length(_random_users,1))::int],
        'OC-KIR-' || LPAD((5000+_counter)::text,4,'0'),
        NOW() - INTERVAL '1 day' * (7+_med_idx+_j*8))
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
  -- Egresos: 2 × 15 meds
  FOR _med_idx IN 1..15 LOOP
    FOR _j IN 1..2 LOOP
      _counter := _counter + 1;
      INSERT INTO movements (id, workspace_id, type, medication_id, warehouse_id, quantity, user_name, reason, date)
      VALUES ('m24-kir-' || LPAD(_counter::text,3,'0'), _ws, 'egreso', _med_ids[_med_idx], 'wh-kir-central',
        -((_stock_qty[_med_idx]*(0.03+random()*0.04))::int),
        _random_users[1+floor(random()*array_length(_random_users,1))::int],
        'Consumo general',
        NOW() - INTERVAL '1 day' * (3+_med_idx*2+_j*6))
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ══════════════════════════════════════════
  --  13. TRANSFER REQUESTS (8, varios estados)
  -- ══════════════════════════════════════════
  INSERT INTO transfer_code_counters (workspace_id, period_yyyymm, last_value)
  VALUES (_ws, TO_CHAR(NOW(),'YYYYMM'), 0)
  ON CONFLICT (workspace_id, period_yyyymm) DO NOTHING;

  FOR _med_idx IN 1..8 LOOP
    INSERT INTO transfer_requests (id, workspace_id, transfer_code, medication_id, from_warehouse_id, to_warehouse_id, quantity, status, requested_by, date)
    VALUES ('trf-' || _ws || '-' || _med_idx, _ws,
      TO_CHAR(NOW(),'YYYYMM') || '-' || LPAD(_med_idx::text,5,'0'),
      _med_ids[_med_idx], _trf_from_whs[_med_idx], _trf_to_whs[_med_idx],
      30+_med_idx*15,
      _trf_statuses[_med_idx],
      _random_users[1+floor(random()*array_length(_random_users,1))::int],
      NOW() - INTERVAL '1 day' * (random()*20)::int)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- ══════════════════════════════════════════
  --  14. SALES (14 meds × 2 each)
  -- ══════════════════════════════════════════
  _counter := 0;
  FOR _med_idx IN 1..14 LOOP
    FOR _j IN 1..2 LOOP
      _counter := _counter + 1;
      INSERT INTO sales (id, workspace_id, medication_id, warehouse_id, quantity, price, cashier, date)
      VALUES ('sale-' || _ws || '-' || _counter, _ws, _med_ids[_med_idx], 'wh-kir-ventas',
        1+floor(random()*6)::int, _med_prices[_med_idx]*(1+floor(random()*6)::int),
        _random_users[1+floor(random()*array_length(_random_users,1))::int],
        NOW() - INTERVAL '1 day' * (random()*25)::int)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ══════════════════════════════════════════
  --  15. DISPENSATIONS (8 meds × 3 patients)
  -- ══════════════════════════════════════════
  _counter := 0;
  FOR _med_idx IN 1..8 LOOP
    FOR _patient_id IN SELECT id FROM _tpt ORDER BY id LIMIT 3 LOOP
      _counter := _counter + 1;
      INSERT INTO dispensations (id, workspace_id, medication_id, warehouse_id, quantity, doctor, patient, room, treatment, date)
      VALUES ('disp-' || _ws || '-' || _counter, _ws, _med_ids[_med_idx], 'wh-kir-interna',
        1+floor(random()*12)::int,
        (ARRAY['Dr. Ferrari','Dra. Duarte','Dr. Santos','Dra. Bravo'])[1+floor(random()*4)::int],
        (SELECT _patient_first[1] || ' ' || _patient_last[1]),
        'Sala ' || (1+floor(random()*20)::int),
        (ARRAY['Antibiótico','Analgesia','Cardiotónico','Vasopresor','Broncodilatador','Sedante','Diurético','Anticoagulante'])[1+floor(random()*8)::int],
        NOW() - INTERVAL '1 day' * (random()*10)::int)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ══════════════════════════════════════════
  --  16. MEDICATION ORDERS (10, 5 urgentes)
  -- ══════════════════════════════════════════
  _counter := 0;
  FOR _med_idx IN 1..10 LOOP
    FOR _patient_id IN SELECT id FROM _tpt ORDER BY id LIMIT 1 LOOP
      _counter := _counter + 1;
      INSERT INTO medication_orders (id, workspace_id, medication_id, warehouse_id, quantity, doctor, patient, room, reason, status, requested_at)
      VALUES ('ord-' || _ws || '-' || _counter, _ws, _med_ids[_med_idx], 'wh-kir-interna',
        CASE WHEN _med_idx IN (5,12) THEN 200+floor(random()*300)::int
             ELSE 10+floor(random()*50)::int
        END,
        (ARRAY['Dr. Ferrari','Dra. Duarte','Dr. Santos','Dra. Bravo'])[1+floor(random()*4)::int],
        (SELECT _patient_first[1] || ' ' || _patient_last[1]),
        'Sala ' || (1+floor(random()*20)::int),
        (ARRAY['Déficit crítico de stock','Reposición urgente','UTI: paciente crítico','Cirugía de emergencia','Paro cardiorrespiratorio','Stock insuficiente','Paciente en shock'])[1+floor(random()*7)::int],
        (ARRAY['pendiente','pendiente','pendiente','pendiente','pendiente','aprobado','despachado','recibido','aprobado','despachado'])[_counter],
        NOW() - INTERVAL '1 day' * (2+floor(random()*12)::int))
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ══════════════════════════════════════════
  --  17. AUDIT LOG (30 entradas)
  -- ══════════════════════════════════════════
  FOR _i IN 1..30 LOOP
    INSERT INTO audit_log (id, workspace_id, user_name, action, entity, date)
    VALUES ('aud-kir-' || LPAD(_i::text,3,'0'), _ws,
      _random_users[1+floor(random()*array_length(_random_users,1))::int],
      (ARRAY['Lote vencido retirado','Ingreso de mercadería','Venta registrada','Dispensación','Transferencia solicitada','Transferencia recibida','Alta de medicamento','Ajuste de stock','Alta de paciente','Pedido médico urgente','Licitación creada','Stock crítico reportado'])[1+floor(random()*12)::int],
      (ARRAY['Omeprazol','Enalapril','Salbutamol','Losartán','Ceftriaxona','Lote KIR-C-004-EXP','Transferencia KIR','Venta','Paciente crítico','Pedido médico'])[1+floor(random()*10)::int],
      NOW() - INTERVAL '1 day' * (random()*35)::int)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  DROP TABLE IF EXISTS _twh, _tusr, _tmed, _tpt;

  RAISE NOTICE '✅ % creado con éxito (ws: %, slug: %)', _name, _ws, _slug;
END $$;
