-- ============================================================
--  MEDITORY — Seed: Hospital Nicolás Avellaneda
--  Escenario: 3 medicamentos con déficit, 2 con sobrestock,
--  2 lotes vencidos, vencimientos próximos, transferencias
--  y licitaciones pendientes.
-- ============================================================

DO $$
DECLARE
  _ws  text := 'ws-nicolasave';
  _pfx text := 'nav';
  _name text := 'Hospital Nicolás Avellaneda';
  _slug text := 'HOSPITALNICOLASAVELLANEDA';

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

  _stock_qty int[] := ARRAY[3500,1500,2000,1000,700,600,1500,400,300,350,1000,300,100,150,9000];
  _min_central int[] := ARRAY[1500,1000,1200,900,500,600,1000,400,300,250,700,400,180,100,7000];
  _opt_central int[] := ARRAY[2600,1800,2000,1600,900,1000,1800,700,550,450,1200,700,330,200,13000];
  _min_interna int[] := ARRAY[300,200,240,180,100,120,200,80,60,50,140,80,36,20,1400];
  _opt_interna int[] := ARRAY[520,360,400,320,180,200,360,140,110,90,240,140,66,40,2600];
  _min_ventas int[] := ARRAY[90,60,75,55,30,35,60,25,20,15,45,25,12,0,0];
  _opt_ventas int[] := ARRAY[155,110,125,100,55,60,110,45,35,25,75,45,25,0,0];

  _patient_last text[] := ARRAY['Benavídez','Cruz','Domínguez','Escobar','Flores','Gómez','Hidalgo','Juárez','Kravetz','Lombardi'];
  _patient_first text[] := ARRAY['Ángel','Brenda','Carmen','David','Estela','Facundo','Graciela','Humberto','Irene','Joaquín'];
  _patient_insurance text[] := ARRAY['OSDE','PAMI','IOMA','Swiss Medical','OSDE','PAMI','IOMA','Swiss Medical','OSDE','PAMI'];
  _patient_diagnosis text[] := ARRAY['Cardiopatía isquémica','Neumonía aspirativa','Insuficiencia hepática','Pancreatitis aguda','Tromboembolismo','Estatus asmático','Peritonitis','Aneurisma aórtico','Insuficiencia suprarrenal','Hematemesis'];
  _patient_doctor text[] := ARRAY['Dr. Benavídez','Dra. Cruz','Dr. Domínguez','Dra. Escobar','Dr. Benavídez','Dra. Cruz','Dr. Domínguez','Dra. Escobar','Dr. Benavídez','Dra. Cruz'];

  _users_role text[] := ARRAY['admin','ventas','doctor','tecnico'];
  _users_name text[] := ARRAY['Admin Nicolás','Ventas Nicolás','Doctor Nicolás','Técnico Nicolás'];
  _users_email text[] := ARRAY['nav.admin@nicolasavellaneda.com','nav.ventas@nicolasavellaneda.com','nav.doctor@nicolasavellaneda.com','nav.tecnico@nicolasavellaneda.com'];

  _random_users text[];
  _room_numbers int[] := ARRAY[1,2,3,4,5,6,7,8,9,10];
  _bed_counts int[] := ARRAY[2,3,2,3,2,3,2,2,3,2];
  _usr_name text; _usr_role text;
  _expiry_date date;
  _trf_statuses text[] := ARRAY['solicitado','solicitado','autorizado','autorizado','despachado','recibido'];
  _trf_from_whs text[] := ARRAY['wh-nav-central','wh-nav-central','wh-nav-central','wh-nav-interna','wh-nav-interna','wh-nav-central'];
  _trf_to_whs text[] := ARRAY['wh-nav-interna','wh-nav-interna','wh-nav-ventas','wh-nav-ventas','wh-nav-ventas','wh-nav-interna'];

BEGIN

  DROP TABLE IF EXISTS _twh, _tusr, _tmed, _tpt;
  CREATE TEMP TABLE _twh (id text, type text);
  CREATE TEMP TABLE _tusr (id text, name text, role text);
  CREATE TEMP TABLE _tmed (id text, name text, sale_enabled bool);
  CREATE TEMP TABLE _tpt (id uuid);

  DELETE FROM audit_log WHERE id LIKE 'aud-nav-%';
  DELETE FROM medication_orders WHERE id LIKE 'ord-' || _ws || '-%';
  DELETE FROM dispensations WHERE id LIKE 'disp-' || _ws || '-%';
  DELETE FROM sales WHERE id LIKE 'sale-' || _ws || '-%';
  DELETE FROM transfer_requests WHERE id LIKE 'trf-' || _ws || '-%';
  DELETE FROM movements WHERE id LIKE 'm24-nav-%';
  DELETE FROM medication_stock_config WHERE medication_id LIKE 'med-nav-%';
  DELETE FROM batches WHERE id LIKE 'b24-nav-%';
  DELETE FROM workspace_user_warehouses WHERE user_id LIKE 'u-nav-%';
  DELETE FROM workspace_users WHERE id LIKE 'u-nav-%';
  DELETE FROM patients WHERE workspace_id = _ws;
  DELETE FROM beds WHERE room_id IN (SELECT id FROM rooms WHERE workspace_id = _ws);
  DELETE FROM rooms WHERE workspace_id = _ws;
  DELETE FROM wings WHERE workspace_id = _ws;
  DELETE FROM medications WHERE id LIKE 'med-nav-%';
  DELETE FROM warehouses WHERE id LIKE 'wh-nav-%';
  DELETE FROM workspaces WHERE id = _ws;

  INSERT INTO workspaces (id, name, slug) VALUES (_ws, _name, _slug) ON CONFLICT (id) DO NOTHING;

  INSERT INTO warehouses (id, workspace_id, name, type, unit) VALUES
    ('wh-nav-central', _ws, 'Depósito Central',    'central', _name),
    ('wh-nav-interna', _ws, 'Farmacia Interna',    'interna', _name),
    ('wh-nav-ventas',  _ws, 'Farmacia Ventas',     'ventas',  _name)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO _twh VALUES ('wh-nav-central','central'), ('wh-nav-interna','interna'), ('wh-nav-ventas','ventas');
  SELECT ARRAY_AGG(id) INTO _wh_ids FROM _twh;

  FOR _i IN 1..4 LOOP
    INSERT INTO workspace_users (id, workspace_id, name, email, role)
    VALUES ('u-nav-' || _users_role[_i], _ws, _users_name[_i], _users_email[_i], _users_role[_i])
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO _tusr VALUES ('u-nav-' || _users_role[_i], _users_name[_i], _users_role[_i]);
  END LOOP;
  SELECT ARRAY_AGG(id) INTO _user_ids FROM _tusr;

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

  FOR _i IN 1..15 LOOP
    INSERT INTO medications (id, workspace_id, name, active_ingredient, concentration_value, concentration_unit, form, sale_price, sale_enabled)
    VALUES ('med-nav-' || LPAD(_i::text,2,'0'), _ws, _med_names[_i], _med_ingredients[_i],
      _med_concentrations[_i], _med_units[_i], _med_forms[_i], _med_prices[_i], _med_sale[_i])
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO _tmed VALUES ('med-nav-' || LPAD(_i::text,2,'0'), _med_names[_i], _med_sale[_i]);
  END LOOP;
  SELECT ARRAY_AGG(id) INTO _med_ids FROM _tmed;

  FOR _i IN 1..4 LOOP
    INSERT INTO wings (workspace_id, name, type, prefix)
    VALUES (_ws, _wing_names[_i], _wing_types[_i], _i)
    ON CONFLICT (workspace_id, name) DO NOTHING;
  END LOOP;

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

  -- BATCHES
  -- Déficit: ibuprofeno(2), losartán(12), ceftriaxona(13)
  -- Sobrestock: paracetamol(1), heparina(14)
  FOR _med_idx IN 1..15 LOOP
    _expiry_date := CASE
      WHEN _med_idx IN (2,12,13) THEN NOW()::date + 35
      WHEN _med_idx IN (1,14) THEN NOW()::date + 310
      ELSE NOW()::date + (110 + _med_idx*20)
    END;
    INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
    VALUES ('b24-nav-c-' || LPAD(_med_idx::text,2,'0'), _med_ids[_med_idx], 'wh-nav-central',
      'NAV-C-' || LPAD(_med_idx::text,3,'0'), _expiry_date, _stock_qty[_med_idx]);
  END LOOP;

  FOR _med_idx IN 1..15 LOOP
    _expiry_date := NOW()::date + (80 + _med_idx*12);
    INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
    VALUES ('b24-nav-i-' || LPAD(_med_idx::text,2,'0'), _med_ids[_med_idx], 'wh-nav-interna',
      'NAV-I-' || LPAD(_med_idx::text,3,'0'), _expiry_date,
      GREATEST((_stock_qty[_med_idx]*0.2)::int, 2));
  END LOOP;

  FOR _med_idx IN 1..13 LOOP
    _expiry_date := NOW()::date + (40 + _med_idx*20);
    INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
    VALUES ('b24-nav-v-' || LPAD(_med_idx::text,2,'0'), _med_ids[_med_idx], 'wh-nav-ventas',
      'NAV-V-' || LPAD(_med_idx::text,3,'0'), _expiry_date,
      GREATEST((_stock_qty[_med_idx]*0.06)::int, 1));
  END LOOP;

  -- 2 vencidos: Salbutamol(5) y Enalapril(6)
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-nav-c-05-exp', _med_ids[5], 'wh-nav-central', 'NAV-C-005-EXP', NOW()::date - 20, 200);
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-nav-c-06-exp', _med_ids[6], 'wh-nav-central', 'NAV-C-006-EXP', NOW()::date - 4, 120);

  -- 2 próximos: Ibuprofeno(2) y Ceftriaxona(13)
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-nav-c-02-prox', _med_ids[2], 'wh-nav-central', 'NAV-C-002-PROX', NOW()::date + 9, 400);
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-nav-c-13-prox', _med_ids[13], 'wh-nav-central', 'NAV-C-013-PROX', NOW()::date + 5, 50);

  -- STOCK CONFIG
  FOR _med_idx IN 1..15 LOOP
    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
    VALUES (_med_ids[_med_idx], 'wh-nav-central', _min_central[_med_idx], _opt_central[_med_idx])
    ON CONFLICT (medication_id, warehouse_id) DO NOTHING;
  END LOOP;
  FOR _med_idx IN 1..15 LOOP
    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
    VALUES (_med_ids[_med_idx], 'wh-nav-interna', _min_interna[_med_idx], _opt_interna[_med_idx])
    ON CONFLICT (medication_id, warehouse_id) DO NOTHING;
  END LOOP;
  FOR _med_idx IN 1..13 LOOP
    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
    VALUES (_med_ids[_med_idx], 'wh-nav-ventas', _min_ventas[_med_idx], _opt_ventas[_med_idx])
    ON CONFLICT (medication_id, warehouse_id) DO NOTHING;
  END LOOP;

  UPDATE warehouses SET max_capacity = 27000 WHERE id = 'wh-nav-central';
  UPDATE warehouses SET max_capacity =  7500 WHERE id = 'wh-nav-interna';
  UPDATE warehouses SET max_capacity =  2200 WHERE id = 'wh-nav-ventas';

  -- MOVEMENTS
  SELECT ARRAY_AGG(DISTINCT name) INTO _random_users FROM _tusr;
  _counter := 0;
  FOR _med_idx IN 1..15 LOOP
    FOR _j IN 1..2 LOOP
      _counter := _counter + 1;
      INSERT INTO movements (id, workspace_id, type, medication_id, warehouse_id, quantity, user_name, reason, date)
      VALUES ('m24-nav-' || LPAD(_counter::text,3,'0'), _ws, 'ingreso', _med_ids[_med_idx], 'wh-nav-central',
        (_stock_qty[_med_idx]*(0.2+random()*0.3))::int,
        _random_users[1+floor(random()*array_length(_random_users,1))::int],
        'OC-NAV-' || LPAD((4000+_counter)::text,4,'0'),
        NOW() - INTERVAL '1 day' * (9+_med_idx*2+_j*5))
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
  FOR _med_idx IN 1..15 LOOP
    _counter := _counter + 1;
    INSERT INTO movements (id, workspace_id, type, medication_id, warehouse_id, quantity, user_name, reason, date)
    VALUES ('m24-nav-' || LPAD(_counter::text,3,'0'), _ws, 'egreso', _med_ids[_med_idx], 'wh-nav-central',
      -((_stock_qty[_med_idx]*0.05)::int),
      _random_users[1+floor(random()*array_length(_random_users,1))::int],
      'Consumo general', NOW() - INTERVAL '1 day' * (5+_med_idx*2))
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- TRANSFERS (6)
  INSERT INTO transfer_code_counters (workspace_id, period_yyyymm, last_value)
  VALUES (_ws, TO_CHAR(NOW(),'YYYYMM'), 0)
  ON CONFLICT (workspace_id, period_yyyymm) DO NOTHING;

  FOR _med_idx IN 1..6 LOOP
    INSERT INTO transfer_requests (id, workspace_id, transfer_code, medication_id, from_warehouse_id, to_warehouse_id, quantity, status, requested_by, date)
    VALUES ('trf-' || _ws || '-' || _med_idx, _ws,
      TO_CHAR(NOW(),'YYYYMM') || '-' || LPAD(_med_idx::text,5,'0'),
      _med_ids[_med_idx], _trf_from_whs[_med_idx], _trf_to_whs[_med_idx],
      20+_med_idx*10,
      _trf_statuses[_med_idx],
      _random_users[1+floor(random()*array_length(_random_users,1))::int],
      NOW() - INTERVAL '1 day' * (random()*18)::int)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- SALES (13 meds × 2)
  _counter := 0;
  FOR _med_idx IN 1..13 LOOP
    FOR _j IN 1..2 LOOP
      _counter := _counter + 1;
      INSERT INTO sales (id, workspace_id, medication_id, warehouse_id, quantity, price, cashier, date)
      VALUES ('sale-' || _ws || '-' || _counter, _ws, _med_ids[_med_idx], 'wh-nav-ventas',
        1+floor(random()*5)::int, _med_prices[_med_idx]*(1+floor(random()*5)::int),
        _random_users[1+floor(random()*array_length(_random_users,1))::int],
        NOW() - INTERVAL '1 day' * (random()*30)::int)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- DISPENSATIONS (8 meds × 3)
  _counter := 0;
  FOR _med_idx IN 1..8 LOOP
    FOR _patient_id IN SELECT id FROM _tpt ORDER BY id LIMIT 3 LOOP
      _counter := _counter + 1;
      INSERT INTO dispensations (id, workspace_id, medication_id, warehouse_id, quantity, doctor, patient, room, treatment, date)
      VALUES ('disp-' || _ws || '-' || _counter, _ws, _med_ids[_med_idx], 'wh-nav-interna',
        1+floor(random()*10)::int,
        (ARRAY['Dr. Benavídez','Dra. Cruz','Dr. Domínguez','Dra. Escobar'])[1+floor(random()*4)::int],
        (SELECT _patient_first[1] || ' ' || _patient_last[1]),
        'Sala ' || (1+floor(random()*18)::int),
        (ARRAY['Antibiótico','Analgesia','Anticoagulante','Cardiotónico','Antiinflamatorio','Broncodilatador'])[1+floor(random()*6)::int],
        NOW() - INTERVAL '1 day' * (random()*12)::int)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ORDERS (10)
  _counter := 0;
  FOR _med_idx IN 1..10 LOOP
    FOR _patient_id IN SELECT id FROM _tpt ORDER BY id LIMIT 1 LOOP
      _counter := _counter + 1;
      INSERT INTO medication_orders (id, workspace_id, medication_id, warehouse_id, quantity, doctor, patient, room, reason, status, requested_at)
      VALUES ('ord-' || _ws || '-' || _counter, _ws, _med_ids[_med_idx], 'wh-nav-interna',
        CASE WHEN _med_idx IN (2,12,13) THEN 150+floor(random()*250)::int ELSE 10+floor(random()*40)::int END,
        (ARRAY['Dr. Benavídez','Dra. Cruz','Dr. Domínguez','Dra. Escobar'])[1+floor(random()*4)::int],
        (SELECT _patient_first[1] || ' ' || _patient_last[1]),
        'Sala ' || (1+floor(random()*18)::int),
        (ARRAY['Déficit crítico','Reposición urgente','Cirugía','Emergencia','Stock insuficiente'])[1+floor(random()*5)::int],
        (ARRAY['pendiente','pendiente','pendiente','aprobado','despachado','recibido','aprobado','despachado','recibido','recibido'])[_counter],
        NOW() - INTERVAL '1 day' * (4+floor(random()*15)::int))
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- AUDIT (25)
  FOR _i IN 1..25 LOOP
    INSERT INTO audit_log (id, workspace_id, user_name, action, entity, date)
    VALUES ('aud-nav-' || LPAD(_i::text,3,'0'), _ws,
      _random_users[1+floor(random()*array_length(_random_users,1))::int],
      (ARRAY['Lote vencido retirado','Ingreso','Venta','Dispensación','Transferencia solicitada','Transferencia recibida','Alta de medicamento','Ajuste','Alta de paciente','Pedido médico urgente','Licitación creada','Stock crítico'])[1+floor(random()*12)::int],
      (ARRAY['Ibuprofeno','Salbutamol','Enalapril','Ceftriaxona','Losartán','Lote NAV-C-005-EXP','Transferencia NAV','Venta','Paciente','Depósito Central'])[1+floor(random()*10)::int],
      NOW() - INTERVAL '1 day' * (random()*30)::int)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  DROP TABLE IF EXISTS _twh, _tusr, _tmed, _tpt;

  RAISE NOTICE '✅ % creado con éxito (ws: %, slug: %)', _name, _ws, _slug;
END $$;
