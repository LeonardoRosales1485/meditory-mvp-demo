-- ============================================================
--  MEDITORY — Seed: Centro de Salud Zenón J. Santillán
--  Crea workspace, depósitos, usuarios, medicamentos, lotes,
--  config stock, alas/salas/camas, pacientes, movimientos,
--  transferencias, ventas, dispensaciones, pedidos, auditoría.
--  Idempotente (ON CONFLICT DO NOTHING / verificaciones).
-- ============================================================

DO $$
DECLARE
  _ws  text := 'ws-zenon';
  _pfx text := 'zen';
  _name text := 'Centro de Salud Zenón J. Santillán';
  _slug text := 'ZENONSANTILLAN';

  _wh_ids text[]; _med_ids text[]; _user_ids text[];
  _tmp_wh RECORD; _tmp_user RECORD; _tmp_med RECORD;
  _wing_id uuid; _room_id uuid; _bed_id uuid; _patient_id uuid;
  _i int; _j int; _k int;
  _wing_idx int; _room_idx int; _med_idx int;
  _counter int := 0;
  _wing_types text[] := ARRAY['urgencias','quirofanos','cuidados_intensivos','hospitalizacion'];
  _wing_names text[] := ARRAY['Urgencias','Quirófanos','Cuidados Intensivos','Hospitalización'];
  _med_names text[] := ARRAY['Paracetamol','Ibuprofeno','Amoxicilina','Omeprazol','Salbutamol','Enalapril','Metformina','Diclofenac','Loratadina','Dexametasona','Atorvastatina','Losartán','Ceftriaxona','Heparina','Solución NaCl'];
  _med_ingredients text[] := ARRAY['Paracetamol','Ibuprofeno','Amoxicilina','Omeprazol','Salbutamol','Enalapril','Metformina','Diclofenac','Loratadina','Dexametasona','Atorvastatina','Losartán','Ceftriaxona','Heparina','Cloruro de sodio'];
  _med_concentrations numeric[] := ARRAY[500,400,875,20,100,10,850,75,10,8,20,50,1,5000,500];
  _med_units text[] := ARRAY['mg','mg','mg','mg','mcg','mg','mg','mg','mg','mg','mg','mg','g','unidad','ml'];
  _med_forms text[] := ARRAY['Comprimido','Comprimido','Cápsula','Cápsula','Aerosol','Comprimido','Comprimido','Inyectable','Comprimido','Inyectable','Comprimido','Comprimido','Inyectable','Inyectable','Solución'];
  _med_prices numeric[] := ARRAY[850,1200,2500,1500,3200,900,1100,1800,650,2200,2800,1700,4500,3800,600];
  _med_sale bool[] := ARRAY[true,true,true,true,true,true,true,true,true,true,true,true,true,false,false];

  -- Stock inicial por medicamento (central)
  _stock_qty int[] := ARRAY[3200,2200,1500,1520,770,920,2230,680,820,480,690,760,420,280,8056];
  _min_central int[] := ARRAY[1430,1050,830,830,390,400,960,300,400,200,300,360,150,100,8000];
  _opt_central int[] := ARRAY[2380,1745,1380,1380,645,700,1595,500,650,350,550,600,280,200,15000];
  _min_interna int[] := ARRAY[285,210,165,165,78,80,190,60,75,40,60,70,35,20,1000];
  _opt_interna int[] := ARRAY[475,345,280,280,130,130,320,100,130,70,100,110,60,40,2000];
  _min_ventas int[] := ARRAY[85,67,50,50,25,30,65,25,30,15,25,25,12,0,0];
  _opt_ventas int[] := ARRAY[145,110,90,90,45,50,105,40,50,30,40,45,25,0,0];

  _patient_last text[] := ARRAY['López','Ramírez','Fernández','Morales','Acosta','Villalba','Suárez','Romero','Castro','Gutiérrez'];
  _patient_first text[] := ARRAY['Carlos','Ana','Roberto','Lucía','Hugo','Marta','Pablo','Valeria','Ernesto','Sofía'];
  _patient_insurance text[] := ARRAY['OSDE','Swiss Medical','PAMI','OSDE','IOMA','PAMI','OSDE','Swiss Medical','IOMA','OSDE'];
  _patient_diagnosis text[] := ARRAY['Neumonía bacteriana','Control de dolor post-quirúrgico','Colecistectomía','Gastritis crónica','Hipertensión arterial','Diabetes tipo 2','Traumatismo leve','Crisis asmática','Neumonía bilateral','Apendicitis'];
  _patient_doctor text[] := ARRAY['Dr. García','Dra. Torres','Dr. García','Dra. Ríos','Dr. Mendoza','Dr. Mendoza','Dra. Torres','Dr. García','Dra. Ríos','Dr. García'];

  _users_role text[] := ARRAY['admin','ventas','doctor','tecnico'];
  _users_name text[] := ARRAY['Admin Zenón','Ventas Zenón','Doctor Zenón','Técnico Zenón'];
  _users_email text[] := ARRAY['zenon.admin@zenonsantillan.com','zenon.ventas@zenonsantillan.com','zenon.doctor@zenonsantillan.com','zenon.tecnico@zenonsantillan.com'];

  _random_users text[];
  _room_numbers int[] := ARRAY[1,2,3,4,5,6,7,8,9,10];
  _bed_counts int[] := ARRAY[2,2,3,2,2,3,2,2,3,2];
  _usr_name text; _usr_role text;

BEGIN

  -- temp tables (ejecución, no declaración)
  DROP TABLE IF EXISTS _twh, _tusr, _tmed, _tpt;
  CREATE TEMP TABLE _twh (id text, type text);
  CREATE TEMP TABLE _tusr (id text, name text, role text);
  CREATE TEMP TABLE _tmed (id text, name text, sale_enabled bool);
  CREATE TEMP TABLE _tpt (id uuid);

  -- Limpiar datos previos de este hospital (para re-ejecución)
  DELETE FROM audit_log WHERE id LIKE 'aud-zen-%';
  DELETE FROM medication_orders WHERE id LIKE 'ord-' || _ws || '-%';
  DELETE FROM dispensations WHERE id LIKE 'disp-' || _ws || '-%';
  DELETE FROM sales WHERE id LIKE 'sale-' || _ws || '-%';
  DELETE FROM transfer_requests WHERE id LIKE 'trf-' || _ws || '-%';
  DELETE FROM movements WHERE id LIKE 'm24-zen-%';
  DELETE FROM medication_stock_config WHERE medication_id LIKE 'med-zen-%';
  DELETE FROM batches WHERE id LIKE 'b24-zen-%';
  DELETE FROM workspace_user_warehouses WHERE user_id LIKE 'u-zen-%';
  DELETE FROM workspace_users WHERE id LIKE 'u-zen-%';
  DELETE FROM patients WHERE workspace_id = _ws;
  DELETE FROM beds WHERE room_id IN (SELECT id FROM rooms WHERE workspace_id = _ws);
  DELETE FROM rooms WHERE workspace_id = _ws;
  DELETE FROM wings WHERE workspace_id = _ws;
  DELETE FROM medications WHERE id LIKE 'med-zen-%';
  DELETE FROM warehouses WHERE id LIKE 'wh-zen-%';
  DELETE FROM workspaces WHERE id = _ws;

  -- ══════════════════════════════════════════
  --  1. WORKSPACE
  -- ══════════════════════════════════════════
  INSERT INTO workspaces (id, name, slug) VALUES (_ws, _name, _slug) ON CONFLICT (id) DO NOTHING;

  -- ══════════════════════════════════════════
  --  2. WAREHOUSES (3)
  -- ══════════════════════════════════════════
  INSERT INTO warehouses (id, workspace_id, name, type, unit) VALUES
    ('wh-zen-central', _ws, 'Depósito Central',    'central', _name),
    ('wh-zen-interna', _ws, 'Farmacia Interna',    'interna', _name),
    ('wh-zen-ventas',  _ws, 'Farmacia Ventas',     'ventas',  _name)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO _twh VALUES ('wh-zen-central','central'), ('wh-zen-interna','interna'), ('wh-zen-ventas','ventas');
  SELECT ARRAY_AGG(id) INTO _wh_ids FROM _twh;

  -- ══════════════════════════════════════════
  --  3. USERS (4)
  -- ══════════════════════════════════════════
  FOR _i IN 1..4 LOOP
    INSERT INTO workspace_users (id, workspace_id, name, email, role)
    VALUES ('u-zen-' || _users_role[_i], _ws, _users_name[_i], _users_email[_i], _users_role[_i])
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO _tusr VALUES ('u-zen-' || _users_role[_i], _users_name[_i], _users_role[_i]);
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
    VALUES ('med-zen-' || LPAD(_i::text,2,'0'), _ws, _med_names[_i], _med_ingredients[_i],
      _med_concentrations[_i], _med_units[_i], _med_forms[_i], _med_prices[_i], _med_sale[_i])
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO _tmed VALUES ('med-zen-' || LPAD(_i::text,2,'0'), _med_names[_i], _med_sale[_i]);
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

  -- Assign patients to beds
  FOR _patient_id IN SELECT id FROM _tpt ORDER BY id LOOP
    SELECT b.id INTO _bed_id FROM beds b JOIN rooms r ON r.id = b.room_id
    WHERE b.patient_id IS NULL ORDER BY b.id LIMIT 1;
    IF _bed_id IS NOT NULL THEN
      UPDATE beds SET patient_id = _patient_id WHERE id = _bed_id;
    END IF;
  END LOOP;
  -- Update room names from bed assignment
  UPDATE patients p SET room = CONCAT('Sala ', r.full_number::text)
  FROM beds b JOIN rooms r ON r.id = b.room_id WHERE b.patient_id = p.id;

  -- ══════════════════════════════════════════
  --  9. BATCHES (stock inicial)
  -- ══════════════════════════════════════════
  -- Central: 15 meds
  FOR _med_idx IN 1..15 LOOP
    INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
    VALUES ('b24-zen-c-' || LPAD(_med_idx::text,2,'0'), _med_ids[_med_idx], 'wh-zen-central',
      'ZEN-C-' || LPAD(_med_idx::text,3,'0'), NOW() + INTERVAL '1 day' * (240 + _med_idx*20), _stock_qty[_med_idx]);
  END LOOP;

  -- Interna: 15 meds (20% de central)
  FOR _med_idx IN 1..15 LOOP
    INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
    VALUES ('b24-zen-i-' || LPAD(_med_idx::text,2,'0'), _med_ids[_med_idx], 'wh-zen-interna',
      'ZEN-I-' || LPAD(_med_idx::text,3,'0'), NOW() + INTERVAL '1 day' * (120 + _med_idx*15), (_stock_qty[_med_idx]*0.2)::int);
  END LOOP;

  -- Ventas: 13 meds (sale_enabled=true, ~6% de central)
  FOR _med_idx IN 1..13 LOOP
    INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
    VALUES ('b24-zen-v-' || LPAD(_med_idx::text,2,'0'), _med_ids[_med_idx], 'wh-zen-ventas',
      'ZEN-V-' || LPAD(_med_idx::text,3,'0'), NOW() + INTERVAL '1 day' * (60 + _med_idx*20), GREATEST((_stock_qty[_med_idx]*0.06)::int,1));
  END LOOP;

  -- ══════════════════════════════════════════
  --  10. STOCK CONFIG (min / optimal)
  -- ══════════════════════════════════════════
  -- Central (15 meds)
  FOR _med_idx IN 1..15 LOOP
    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
    VALUES (_med_ids[_med_idx], 'wh-zen-central', _min_central[_med_idx], _opt_central[_med_idx])
    ON CONFLICT (medication_id, warehouse_id) DO NOTHING;
  END LOOP;
  -- Interna (15 meds)
  FOR _med_idx IN 1..15 LOOP
    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
    VALUES (_med_ids[_med_idx], 'wh-zen-interna', _min_interna[_med_idx], _opt_interna[_med_idx])
    ON CONFLICT (medication_id, warehouse_id) DO NOTHING;
  END LOOP;
  -- Ventas (13 meds)
  FOR _med_idx IN 1..13 LOOP
    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
    VALUES (_med_ids[_med_idx], 'wh-zen-ventas', _min_ventas[_med_idx], _opt_ventas[_med_idx])
    ON CONFLICT (medication_id, warehouse_id) DO NOTHING;
  END LOOP;

  -- ══════════════════════════════════════════
  --  11. WAREHOUSE CAPACITIES
  -- ══════════════════════════════════════════
  UPDATE warehouses SET max_capacity = 28000 WHERE id = 'wh-zen-central';
  UPDATE warehouses SET max_capacity =  8000 WHERE id = 'wh-zen-interna';
  UPDATE warehouses SET max_capacity =  2000 WHERE id = 'wh-zen-ventas';
  UPDATE warehouses w SET volume = COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.warehouse_id = w.id), 0)
  WHERE w.id IN ('wh-zen-central','wh-zen-interna','wh-zen-ventas');

  -- ══════════════════════════════════════════
  --  12. MOVEMENTS (historial)
  -- ══════════════════════════════════════════
  SELECT ARRAY_AGG(DISTINCT name) INTO _random_users FROM _tusr;
  _counter := 0;
  -- Ingresos: 2 × 15 meds
  FOR _med_idx IN 1..15 LOOP
    FOR _j IN 1..2 LOOP
      _counter := _counter + 1;
      INSERT INTO movements (id, workspace_id, type, medication_id, warehouse_id, quantity, user_name, reason, date)
      VALUES ('m24-zen-' || LPAD(_counter::text,3,'0'), _ws, 'ingreso', _med_ids[_med_idx], 'wh-zen-central',
        (_stock_qty[_med_idx]*(0.3+random()*0.4))::int,
        _random_users[1+floor(random()*array_length(_random_users,1))::int],
        'Compra OC-' || LPAD((1000+_counter)::text,4,'0'),
        NOW() - INTERVAL '1 day' * (5+_med_idx*2+_j*10))
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
  -- Egresos: 1 × 15 meds
  FOR _med_idx IN 1..15 LOOP
    _counter := _counter + 1;
    INSERT INTO movements (id, workspace_id, type, medication_id, warehouse_id, quantity, user_name, reason, date)
    VALUES ('m24-zen-' || LPAD(_counter::text,3,'0'), _ws, 'egreso', _med_ids[_med_idx], 'wh-zen-central',
      -((_stock_qty[_med_idx]*0.05)::int),
      _random_users[1+floor(random()*array_length(_random_users,1))::int],
      'Consumo general', NOW() - INTERVAL '1 day' * (3+_med_idx*3))
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- ══════════════════════════════════════════
  --  13. TRANSFER REQUESTS (5)
  -- ══════════════════════════════════════════
  INSERT INTO transfer_code_counters (workspace_id, period_yyyymm, last_value)
  VALUES (_ws, TO_CHAR(NOW(),'YYYYMM'), 0)
  ON CONFLICT (workspace_id, period_yyyymm) DO NOTHING;

  FOR _med_idx IN 1..5 LOOP
    INSERT INTO transfer_requests (id, workspace_id, transfer_code, medication_id, from_warehouse_id, to_warehouse_id, quantity, status, requested_by, date)
    VALUES ('trf-' || _ws || '-' || _med_idx, _ws,
      TO_CHAR(NOW(),'YYYYMM') || '-' || LPAD(_med_idx::text,5,'0'),
      _med_ids[_med_idx], 'wh-zen-central', 'wh-zen-interna',
      20+_med_idx*5,
      (ARRAY['solicitado','autorizado','despachado','recibido','aceptado'])[1+floor(random()*5)::int],
      _random_users[1+floor(random()*array_length(_random_users,1))::int],
      NOW() - INTERVAL '1 day' * (random()*15)::int)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- ══════════════════════════════════════════
  --  14. SALES (10 meds × 2 each)
  -- ══════════════════════════════════════════
  _counter := 0;
  FOR _med_idx IN 1..10 LOOP
    FOR _j IN 1..2 LOOP
      _counter := _counter + 1;
      INSERT INTO sales (id, workspace_id, medication_id, warehouse_id, quantity, price, cashier, date)
      VALUES ('sale-' || _ws || '-' || _counter, _ws, _med_ids[_med_idx], 'wh-zen-ventas',
        1+floor(random()*5)::int, _med_prices[_med_idx]*(1+floor(random()*5)::int),
        _random_users[1+floor(random()*array_length(_random_users,1))::int],
        NOW() - INTERVAL '1 day' * (random()*20)::int)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ══════════════════════════════════════════
  --  15. DISPENSATIONS (5 meds × 3 patients)
  -- ══════════════════════════════════════════
  _counter := 0;
  FOR _med_idx IN 1..5 LOOP
    FOR _patient_id IN SELECT id FROM _tpt ORDER BY id LIMIT 3 LOOP
      _counter := _counter + 1;
      INSERT INTO dispensations (id, workspace_id, medication_id, warehouse_id, quantity, doctor, patient, room, treatment, date)
      VALUES ('disp-' || _ws || '-' || _counter, _ws, _med_ids[_med_idx], 'wh-zen-interna',
        1+floor(random()*10)::int,
        (ARRAY['Dr. García','Dra. Torres','Dra. Ríos','Dr. Mendoza'])[1+floor(random()*4)::int],
        (SELECT _patient_first[1] || ' ' || _patient_last[1]),
        'Sala ' || (1+floor(random()*15)::int),
        (ARRAY['Antibiótico','Analgesia','Antiinflamatorio','Protector gástrico','Broncodilatador'])[1+floor(random()*5)::int],
        NOW() - INTERVAL '1 day' * (random()*15)::int)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ══════════════════════════════════════════
  --  16. MEDICATION ORDERS (5 meds × 2 patients)
  -- ══════════════════════════════════════════
  _counter := 0;
  FOR _med_idx IN 1..5 LOOP
    FOR _patient_id IN SELECT id FROM _tpt ORDER BY id LIMIT 2 LOOP
      _counter := _counter + 1;
      INSERT INTO medication_orders (id, workspace_id, medication_id, warehouse_id, quantity, doctor, patient, room, reason, status, requested_at)
      VALUES ('ord-' || _ws || '-' || _counter, _ws, _med_ids[_med_idx], 'wh-zen-interna',
        5+floor(random()*30)::int,
        (ARRAY['Dr. García','Dra. Torres','Dra. Ríos','Dr. Mendoza'])[1+floor(random()*4)::int],
        (SELECT _patient_first[1] || ' ' || _patient_last[1]),
        'Sala ' || (1+floor(random()*15)::int),
        (ARRAY['Tratamiento antibiótico','Control de dolor','Protección gástrica','Crisis asmática','Analgesia postquirúrgica'])[1+floor(random()*5)::int],
        (ARRAY['pendiente','aprobado','despachado','recibido'])[1+floor(random()*4)::int],
        NOW() - INTERVAL '1 day' * (5+floor(random()*15)::int))
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ══════════════════════════════════════════
  --  17. AUDIT LOG (20 entries)
  -- ══════════════════════════════════════════
  FOR _i IN 1..20 LOOP
    INSERT INTO audit_log (id, workspace_id, user_name, action, entity, date)
    VALUES ('aud-zen-' || LPAD(_i::text,3,'0'), _ws,
      _random_users[1+floor(random()*array_length(_random_users,1))::int],
      (ARRAY['Ingreso de mercadería','Venta registrada','Dispensación','Transferencia solicitada','Alta de medicamento','Ajuste de stock','Alta de paciente','Pedido médico creado'])[1+floor(random()*8)::int],
      (ARRAY['Paracetamol 500mg','Ibuprofeno 400mg','Lote','Transferencia','Venta','Paciente','Depósito Central','Pedido médico'])[1+floor(random()*8)::int],
      NOW() - INTERVAL '1 day' * (random()*30)::int)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- ══════════════════════════════════════════
  --  FIN — Limpieza y notificación
  -- ══════════════════════════════════════════
  DROP TABLE IF EXISTS _twh, _tusr, _tmed, _tpt;

  RAISE NOTICE '✅ % creado con éxito (ws: %, slug: %)', _name, _ws, _slug;
END $$;
