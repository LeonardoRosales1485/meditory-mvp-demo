-- ============================================================
--  MEDITORY — Seed: Maternidad Nuestra Señora de las Mercedes
--  Hospital materno-infantil con perfil obstétrico/pediátrico.
--  Escenario: 5 medicamentos con déficit, 2 con sobrestock,
--  2 lotes vencidos (uno crítico: oxitocina), vencimientos
--  próximos, transferencias activas y licitaciones urgentes.
-- ============================================================

DO $$
DECLARE
  _ws  text := 'ws-mercedes';
  _pfx text := 'mer';
  _name text := 'Maternidad Nuestra Señora de las Mercedes';
  _slug text := 'MATERNIDADMERCEDES';

  _wh_ids text[]; _med_ids text[]; _user_ids text[];
  _tmp_wh RECORD; _tmp_user RECORD; _tmp_med RECORD;
  _wing_id uuid; _room_id uuid; _bed_id uuid; _patient_id uuid;
  _i int; _j int; _k int;
  _wing_idx int; _room_idx int; _med_idx int;
  _counter int := 0;
  _wing_types text[] := ARRAY['urgencias','quirofanos','cuidados_intensivos','hospitalizacion','ambulatoria'];
  _wing_names text[] := ARRAY['Guardia Obstétrica','Quirófanos','UTI Neonatal','Internación','Consultorios'];
  _med_names text[] := ARRAY['Oxitocina','Sulfato de Magnesio','Misoprostol','Hierro+Ácido Fólico','Carbetocina','Paracetamol','Amoxicilina','Ibuprofeno','Dexametasona','Omeprazol','Enoxaparina','Metformina','Nifedipina','Penicilina G','Solución NaCl'];
  _med_ingredients text[] := ARRAY['Oxitocina','Sulfato de magnesio','Misoprostol','Hierro + ácido fólico','Carbetocina','Paracetamol','Amoxicilina','Ibuprofeno','Dexametasona','Omeprazol','Enoxaparina sódica','Metformina','Nifedipina','Penicilina G sódica','Cloruro de sodio'];
  _med_concentrations numeric[] := ARRAY[10,20000,200,60,100,500,875,400,8,20,40,850,10,5,500];
  _med_units text[] := ARRAY['mcg','mg','mcg','mg','mcg','mg','mg','mg','mg','mg','mg','mg','mg','g','ml'];
  _med_forms text[] := ARRAY['Inyectable','Inyectable','Comprimido','Comprimido','Inyectable','Comprimido','Cápsula','Comprimido','Inyectable','Cápsula','Inyectable','Comprimido','Comprimido','Inyectable','Solución'];
  _med_prices numeric[] := ARRAY[5200,1800,3500,900,7200,850,2500,1200,2200,1500,4800,1100,2100,3400,600];
  _med_sale bool[] := ARRAY[false,false,false,true,false,true,true,true,false,true,false,true,false,false,false];

  -- Stock inicial — algunos muy bajos para ser maternidad (déficit simulado)
  _stock_qty int[] := ARRAY[100,  3000, 120,  5000, 80,   800,  200,  1500, 250,  2000, 60,   3000, 50,   200,  10000];
  _min_central int[] := ARRAY[400,  5000, 300,  6000, 200,  1400, 1000, 2000, 500,  2000, 150,  1500, 100,  500,  8000];
  _opt_central int[] := ARRAY[800,  10000,600,  12000,400,  2400, 1600, 3500, 900,  3500, 280,  3000, 200,  1000, 15000];

  _min_interna int[] := ARRAY[80,  1000, 60,  1200, 40,  280, 200, 400, 100, 400, 30,  300, 20,  100, 1600];
  _opt_interna int[] := ARRAY[160, 2000, 120, 2400, 80,  480, 320, 700, 180, 700, 56,  600, 40,  200, 3000];

  _min_ventas int[] := ARRAY[0,0,0,300,0,85,55,80,0,55,0,60,0,0,0];
  _opt_ventas int[] := ARRAY[0,0,0,500,0,145,95,135,0,95,0,105,0,0,0];

  -- Pacientes — todas mujeres (perfil obstétrico)
  _patient_last text[] := ARRAY['Quiroga','Luna','Varela','Cáceres','Brito','Vega','Flores','Sosa','Navarro','Miranda'];
  _patient_first text[] := ARRAY['Rosa','María','Celeste','Ana','Paula','Gabriela','Silvia','Jimena','Valentina','Noelia'];
  _patient_insurance text[] := ARRAY['OSDE','PAMI','Swiss Medical','IOMA','OSDE','PAMI','OSDE','Swiss Medical','IOMA','OSDE'];
  _patient_diagnosis text[] := ARRAY['Parto vaginal espontáneo','Cesárea programada','Preeclampsia severa','Hemorragia postparto','Diabetes gestacional','Embarazo gemelar','RPM','Placenta previa','Parto inducido','Puerperio complicado'];
  _patient_doctor text[] := ARRAY['Dra. Aguirre','Dr. Morales','Dra. Aguirre','Dr. Correa','Dra. Paz','Dr. Morales','Dra. Paz','Dr. Correa','Dra. Aguirre','Dr. Morales'];

  -- Usuarios
  _users_role text[] := ARRAY['admin','ventas','doctor','tecnico'];
  _users_name text[] := ARRAY['Admin Mercedes','Ventas Mercedes','Doctor Mercedes','Técnico Mercedes'];
  _users_email text[] := ARRAY['mer.admin@maternidadmercedes.com','mer.ventas@maternidadmercedes.com','mer.doctor@maternidadmercedes.com','mer.tecnico@maternidadmercedes.com'];

  _random_users text[];
  _room_numbers int[] := ARRAY[1,2,3,4,5,6,7,8,9,10];
  _bed_counts int[] := ARRAY[2,2,3,2,2,3,2,2,3,2];
  _usr_name text; _usr_role text;
  _expiry_date date;
  _trf_statuses text[] := ARRAY['solicitado','solicitado','autorizado','despachado','recibido','solicitado'];
  _trf_from_whs text[] := ARRAY['wh-mer-central','wh-mer-central','wh-mer-central','wh-mer-interna','wh-mer-central','wh-mer-central'];
  _trf_to_whs text[] := ARRAY['wh-mer-interna','wh-mer-interna','wh-mer-interna','wh-mer-ventas','wh-mer-interna','wh-mer-interna'];

BEGIN

  DROP TABLE IF EXISTS _twh, _tusr, _tmed, _tpt;
  CREATE TEMP TABLE _twh (id text, type text);
  CREATE TEMP TABLE _tusr (id text, name text, role text);
  CREATE TEMP TABLE _tmed (id text, name text, sale_enabled bool);
  CREATE TEMP TABLE _tpt (id uuid);

  DELETE FROM audit_log WHERE id LIKE 'aud-mer-%';
  DELETE FROM medication_orders WHERE id LIKE 'ord-' || _ws || '-%';
  DELETE FROM dispensations WHERE id LIKE 'disp-' || _ws || '-%';
  DELETE FROM sales WHERE id LIKE 'sale-' || _ws || '-%';
  DELETE FROM transfer_requests WHERE id LIKE 'trf-' || _ws || '-%';
  DELETE FROM movements WHERE id LIKE 'm24-mer-%';
  DELETE FROM medication_stock_config WHERE medication_id LIKE 'med-mer-%';
  DELETE FROM batches WHERE id LIKE 'b24-mer-%';
  DELETE FROM workspace_user_warehouses WHERE user_id LIKE 'u-mer-%';
  DELETE FROM workspace_users WHERE id LIKE 'u-mer-%';
  DELETE FROM patients WHERE workspace_id = _ws;
  DELETE FROM beds WHERE room_id IN (SELECT id FROM rooms WHERE workspace_id = _ws);
  DELETE FROM rooms WHERE workspace_id = _ws;
  DELETE FROM wings WHERE workspace_id = _ws;
  DELETE FROM medications WHERE id LIKE 'med-mer-%';
  DELETE FROM warehouses WHERE id LIKE 'wh-mer-%';
  DELETE FROM workspaces WHERE id = _ws;

  -- ══════════════════════════════════════════
  --  1. WORKSPACE
  -- ══════════════════════════════════════════
  INSERT INTO workspaces (id, name, slug) VALUES (_ws, _name, _slug) ON CONFLICT (id) DO NOTHING;

  -- ══════════════════════════════════════════
  --  2. WAREHOUSES (3)
  -- ══════════════════════════════════════════
  INSERT INTO warehouses (id, workspace_id, name, type, unit) VALUES
    ('wh-mer-central', _ws, 'Depósito Central',      'central', _name),
    ('wh-mer-interna', _ws, 'Farmacia Obstetricia',  'interna', _name),
    ('wh-mer-ventas',  _ws, 'Farmacia Ventas',       'ventas',  _name)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO _twh VALUES ('wh-mer-central','central'), ('wh-mer-interna','interna'), ('wh-mer-ventas','ventas');
  SELECT ARRAY_AGG(id) INTO _wh_ids FROM _twh;

  -- ══════════════════════════════════════════
  --  3. USERS (4)
  -- ══════════════════════════════════════════
  FOR _i IN 1..4 LOOP
    INSERT INTO workspace_users (id, workspace_id, name, email, role)
    VALUES ('u-mer-' || _users_role[_i], _ws, _users_name[_i], _users_email[_i], _users_role[_i])
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO _tusr VALUES ('u-mer-' || _users_role[_i], _users_name[_i], _users_role[_i]);
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
  --  5. MEDICATIONS (15 materno-infantiles)
  -- ══════════════════════════════════════════
  FOR _i IN 1..15 LOOP
    INSERT INTO medications (id, workspace_id, name, active_ingredient, concentration_value, concentration_unit, form, sale_price, sale_enabled)
    VALUES ('med-mer-' || LPAD(_i::text,2,'0'), _ws, _med_names[_i], _med_ingredients[_i],
      _med_concentrations[_i], _med_units[_i], _med_forms[_i], _med_prices[_i], _med_sale[_i])
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO _tmed VALUES ('med-mer-' || LPAD(_i::text,2,'0'), _med_names[_i], _med_sale[_i]);
  END LOOP;
  SELECT ARRAY_AGG(id) INTO _med_ids FROM _tmed;

  -- ══════════════════════════════════════════
  --  6. WINGS (5)
  -- ══════════════════════════════════════════
  FOR _i IN 1..5 LOOP
    INSERT INTO wings (workspace_id, name, type, prefix)
    VALUES (_ws, _wing_names[_i], _wing_types[_i], _i)
    ON CONFLICT (workspace_id, name) DO NOTHING;
  END LOOP;

  -- ══════════════════════════════════════════
  --  7. ROOMS & BEDS (10 rooms × 5 wings)
  -- ══════════════════════════════════════════
  FOR _wing_idx IN 1..5 LOOP
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
  --  8. PATIENTS (10 obstétricas)
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
  --   meds 1,5,11,13 → DÉFICIT CRÍTICO (oxitocina, carbetocina, enoxaparina, nifedipina)
  --   meds 6,7       → SOBRESTOCK (paracetamol, amoxicilina)
  --   med 3          → lote vencido (misoprostol)
  --   med 1          → lote próximo a vencer (oxitocina)
  --   resto          → stock normal

  -- Central: 15 meds
  FOR _med_idx IN 1..15 LOOP
    _expiry_date := CASE
      WHEN _med_idx = 1 THEN NOW()::date + 10       -- oxitocina próxima a vencer
      WHEN _med_idx = 3 THEN NOW()::date - 30        -- misoprostol ya vencido
      WHEN _med_idx IN (5,11,13) THEN NOW()::date + 45
      WHEN _med_idx IN (6,7) THEN NOW()::date + 360  -- sobrestock, lejano
      ELSE NOW()::date + (150 + _med_idx*15)
    END;
    INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
    VALUES ('b24-mer-c-' || LPAD(_med_idx::text,2,'0'), _med_ids[_med_idx], 'wh-mer-central',
      'MER-C-' || LPAD(_med_idx::text,3,'0'), _expiry_date, _stock_qty[_med_idx]);
  END LOOP;

  -- Interna: 15 meds
  FOR _med_idx IN 1..15 LOOP
    _expiry_date := NOW()::date + (80 + _med_idx*12);
    INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
    VALUES ('b24-mer-i-' || LPAD(_med_idx::text,2,'0'), _med_ids[_med_idx], 'wh-mer-interna',
      'MER-I-' || LPAD(_med_idx::text,3,'0'), _expiry_date,
      CASE WHEN _med_idx IN (6,7) THEN (_stock_qty[_med_idx]*0.4)::int
           ELSE GREATEST((_stock_qty[_med_idx]*0.15)::int, 2)
      END);
  END LOOP;

  -- Ventas: 6 meds (solo los sale_enabled)
  FOR _med_idx IN 1..6 LOOP
    _expiry_date := NOW()::date + (45 + _med_idx*30);
    INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
    VALUES ('b24-mer-v-' || LPAD(_med_idx::text,2,'0'), _med_ids[_med_idx], 'wh-mer-ventas',
      'MER-V-' || LPAD(_med_idx::text,3,'0'), _expiry_date,
      GREATEST((_stock_qty[_med_idx]*0.05)::int, 1));
  END LOOP;

  -- ═══════════════════════════════════════════
  --  LOTES VENCIDOS (2) y PRÓXIMOS A VENCER (2)
  -- ═══════════════════════════════════════════
  -- Misoprostol vencido en central (med 3)
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-mer-c-03-exp', _med_ids[3], 'wh-mer-central', 'MER-C-003-EXP', NOW()::date - 30, 60);
  -- Oxitocina vencida en interna (med 1)
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-mer-i-01-exp', _med_ids[1], 'wh-mer-interna', 'MER-I-001-EXP', NOW()::date - 2, 20);

  -- 2 próximos a vencer: Enoxaparina (med 11) y Nifedipina (med 13)
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-mer-c-11-prox', _med_ids[11], 'wh-mer-central', 'MER-C-011-PROX', NOW()::date + 7, 30);
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-mer-c-13-prox', _med_ids[13], 'wh-mer-central', 'MER-C-013-PROX', NOW()::date + 3, 25);

  -- ══════════════════════════════════════════
  --  10. STOCK CONFIG
  -- ══════════════════════════════════════════
  FOR _med_idx IN 1..15 LOOP
    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
    VALUES (_med_ids[_med_idx], 'wh-mer-central', _min_central[_med_idx], _opt_central[_med_idx])
    ON CONFLICT (medication_id, warehouse_id) DO NOTHING;
  END LOOP;
  FOR _med_idx IN 1..15 LOOP
    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
    VALUES (_med_ids[_med_idx], 'wh-mer-interna', _min_interna[_med_idx], _opt_interna[_med_idx])
    ON CONFLICT (medication_id, warehouse_id) DO NOTHING;
  END LOOP;
  FOR _med_idx IN 1..6 LOOP
    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
    VALUES (_med_ids[_med_idx], 'wh-mer-ventas', _min_ventas[_med_idx], _opt_ventas[_med_idx])
    ON CONFLICT (medication_id, warehouse_id) DO NOTHING;
  END LOOP;

  -- ══════════════════════════════════════════
  --  11. CAPACIDAD / VOLUMEN
  -- ══════════════════════════════════════════
  UPDATE warehouses SET max_capacity = 22000 WHERE id = 'wh-mer-central';
  UPDATE warehouses SET max_capacity =  7000 WHERE id = 'wh-mer-interna';
  UPDATE warehouses SET max_capacity =  1500 WHERE id = 'wh-mer-ventas';
  UPDATE warehouses w SET volume = COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.warehouse_id = w.id), 0)
  WHERE w.id IN ('wh-mer-central','wh-mer-interna','wh-mer-ventas');

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
      VALUES ('m24-mer-' || LPAD(_counter::text,3,'0'), _ws, 'ingreso', _med_ids[_med_idx], 'wh-mer-central',
        (_stock_qty[_med_idx]*(0.25+random()*0.35))::int,
        _random_users[1+floor(random()*array_length(_random_users,1))::int],
        'OC-MER-' || LPAD((3000+_counter)::text,4,'0'),
        NOW() - INTERVAL '1 day' * (12+_med_idx*2+_j*8))
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
  -- Egresos: 1 × 15 meds
  FOR _med_idx IN 1..15 LOOP
    _counter := _counter + 1;
    INSERT INTO movements (id, workspace_id, type, medication_id, warehouse_id, quantity, user_name, reason, date)
    VALUES ('m24-mer-' || LPAD(_counter::text,3,'0'), _ws, 'egreso', _med_ids[_med_idx], 'wh-mer-central',
      -((_stock_qty[_med_idx]*0.06)::int),
      _random_users[1+floor(random()*array_length(_random_users,1))::int],
      'Consumo obstetricia',
      NOW() - INTERVAL '1 day' * (6+_med_idx*2))
    ON CONFLICT (id) DO NOTHING;
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
      25+_med_idx*15,
      _trf_statuses[_med_idx],
      _random_users[1+floor(random()*array_length(_random_users,1))::int],
      NOW() - INTERVAL '1 day' * (random()*15)::int)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- ══════════════════════════════════════════
  --  14. SALES (6 meds × 3 each)
  -- ══════════════════════════════════════════
  _counter := 0;
  FOR _med_idx IN 1..6 LOOP
    FOR _j IN 1..3 LOOP
      _counter := _counter + 1;
      INSERT INTO sales (id, workspace_id, medication_id, warehouse_id, quantity, price, cashier, date)
      VALUES ('sale-' || _ws || '-' || _counter, _ws, _med_ids[_med_idx], 'wh-mer-ventas',
        1+floor(random()*4)::int, _med_prices[_med_idx]*(1+floor(random()*4)::int),
        _random_users[1+floor(random()*array_length(_random_users,1))::int],
        NOW() - INTERVAL '1 day' * (random()*25)::int)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ══════════════════════════════════════════
  --  15. DISPENSATIONS (8 meds × 4 patients)
  -- ══════════════════════════════════════════
  _counter := 0;
  FOR _med_idx IN 1..8 LOOP
    FOR _patient_id IN SELECT id FROM _tpt ORDER BY id LIMIT 4 LOOP
      _counter := _counter + 1;
      INSERT INTO dispensations (id, workspace_id, medication_id, warehouse_id, quantity, doctor, patient, room, treatment, date)
      VALUES ('disp-' || _ws || '-' || _counter, _ws, _med_ids[_med_idx], 'wh-mer-interna',
        1+floor(random()*8)::int,
        (ARRAY['Dra. Aguirre','Dr. Morales','Dr. Correa','Dra. Paz'])[1+floor(random()*4)::int],
        (SELECT _patient_first[1] || ' ' || _patient_last[1]),
        'Sala ' || (1+floor(random()*15)::int),
        (ARRAY['Inducción al parto','Prevención de hemorragia','Tocólisis','Antibiótico profiláctico','Suplemento de hierro','Analgesia epidural','Tratamiento de preeclampsia','Contracción uterina'])[1+floor(random()*8)::int],
        NOW() - INTERVAL '1 day' * (random()*12)::int)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ══════════════════════════════════════════
  --  16. MEDICATION ORDERS (8, 4 urgentes)
  -- ══════════════════════════════════════════
  _counter := 0;
  FOR _med_idx IN 1..8 LOOP
    FOR _patient_id IN SELECT id FROM _tpt ORDER BY id LIMIT 1 LOOP
      _counter := _counter + 1;
      INSERT INTO medication_orders (id, workspace_id, medication_id, warehouse_id, quantity, doctor, patient, room, reason, status, requested_at)
      VALUES ('ord-' || _ws || '-' || _counter, _ws, _med_ids[_med_idx], 'wh-mer-interna',
        CASE WHEN _med_idx IN (1,5,11,13) THEN 100+floor(random()*200)::int
             ELSE 10+floor(random()*30)::int
        END,
        (ARRAY['Dra. Aguirre','Dr. Morales','Dr. Correa','Dra. Paz'])[1+floor(random()*4)::int],
        (SELECT _patient_first[1] || ' ' || _patient_last[1]),
        'Sala ' || (1+floor(random()*15)::int),
        (ARRAY['Urgente: déficit de oxitocina','Reposición post-cirugía','Stock crítico','Parto inminente','Emergencia obstétrica','Preeclampsia severa','Hemorragia activa','Inducción programada'])[_counter],
        (ARRAY['pendiente','aprobado','pendiente','despachado','pendiente','recibido','aprobado','recibido'])[_counter],
        NOW() - INTERVAL '1 day' * (3+floor(random()*10)::int))
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ══════════════════════════════════════════
  --  17. AUDIT LOG (30 entradas)
  -- ══════════════════════════════════════════
  FOR _i IN 1..30 LOOP
    INSERT INTO audit_log (id, workspace_id, user_name, action, entity, date)
    VALUES ('aud-mer-' || LPAD(_i::text,3,'0'), _ws,
      _random_users[1+floor(random()*array_length(_random_users,1))::int],
      (ARRAY['Lote vencido retirado','Ingreso de mercadería','Venta registrada','Dispensación','Transferencia solicitada','Parto asistido','Alta de medicamento','Ajuste de stock','Alta de paciente','Pedido médico urgente','Stock crítico reportado','Oxitocina re-stock'])[1+floor(random()*12)::int],
      (ARRAY['Oxitocina','Misoprostol','Carbetocina','Enoxaparina','Sulfato de Magnesio','Lote vencido','Transferencia','Paciente','Depósito Central','Pedido médico'])[1+floor(random()*10)::int],
      NOW() - INTERVAL '1 day' * (random()*35)::int)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  DROP TABLE IF EXISTS _twh, _tusr, _tmed, _tpt;

  RAISE NOTICE '✅ % creado con éxito (ws: %, slug: %)', _name, _ws, _slug;
END $$;
