-- ============================================================
--  MEDITORY — Seed: Stock + datos para Hospital del Niño Jesús
--  Perfil pediátrico. Déficit en amoxicilina(3) y
--  salbutamol(5), sobrestock en paracetamol(1) y
--  loratadina(9), 2 lotes vencidos, 2 próximos a vencer.
-- ============================================================

DO $$
DECLARE
  _ws text := 'ws-ninez';
  _wh_ids text[] := ARRAY['wh-ws-ninez-central','wh-ws-ninez-interna','wh-ws-ninez-ventas'];
  _med_ids text[];
  _user_ids text[];
  _med_names text[] := ARRAY['Paracetamol','Ibuprofeno','Amoxicilina','Omeprazol','Salbutamol','Enalapril','Metformina','Diclofenac','Loratadina','Dexametasona','Atorvastatina','Losartán','Ceftriaxona','Heparina','Solución NaCl','Azitromicina','Carvedilol','Clonazepam'];
  _med_sale bool[] := ARRAY[true,true,true,true,true,true,true,true,true,true,true,true,true,false,false,true,true,true];
  _med_prices numeric[] := ARRAY[850,1200,2500,1500,3200,600,900,1800,720,2100,1500,890,3500,4200,400,2500,1200,800];

  _stock_qty int[] := ARRAY[5000,2500,400,1800,200,1200,2500,600,3500,700,1600,700,350,250,11000,900,500,450];
  _min_central int[] := ARRAY[1500,1200,1200,1000,600,700,1400,500,600,400,900,600,250,200,9000,500,350,250];
  _opt_central int[] := ARRAY[2800,2200,2000,1800,1000,1200,2500,900,1100,700,1600,1000,450,380,16000,900,600,450];
  _min_interna int[] := ARRAY[300,240,240,200,120,140,280,100,120,80,180,120,50,40,1800,100,70,50];
  _opt_interna int[] := ARRAY[560,440,400,360,200,240,500,180,220,140,320,200,90,76,3200,180,120,90];
  _min_ventas int[] := ARRAY[90,75,75,60,35,45,85,30,35,25,55,35,15,0,0,30,20,15];
  _opt_ventas int[] := ARRAY[160,135,120,110,60,75,150,55,65,45,100,60,25,0,0,55,35,25];

  _wing_id uuid; _room_id uuid; _bed_id uuid; _patient_id uuid;
  _i int; _j int; _med_idx int; _wing_idx int; _room_idx int;
  _counter int := 0;
  _room_numbers int[] := ARRAY[1,2,3,4,5,6,7,8,9,10];
  _bed_counts int[] := ARRAY[2,2,2,3,2,3,2,2,3,3];

  _patient_last text[] := ARRAY['Álvarez','Blanco','Córdoba','Delgado','Espinoza','Franco','Guerra','Herrera','Luna','Mendoza'];
  _patient_first text[] := ARRAY['Pedro','Sofía','Mateo','Valentina','Benjamín','Camila','Lautaro','Isabella','Thiago','Emma'];
  _patient_insurance text[] := ARRAY['OSDE','PAMI','IOMA','Swiss Medical','PAMI','OSDE','IOMA','Swiss Medical','OSDE','PAMI'];
  _patient_diagnosis text[] := ARRAY['Bronquiolitis','Neumonía infantil','Asma agudo','Infección urinaria','Faringitis bacteriana','Otitis media','Deshidratación','Gastroenteritis','Fiebre alta','Dolor abdominal'];
  _patient_doctor text[] := ARRAY['Dra. Álvarez','Dr. Blanco','Dra. Córdoba','Dr. Delgado','Dra. Álvarez','Dr. Blanco','Dra. Córdoba','Dr. Delgado','Dra. Álvarez','Dr. Blanco'];

  _random_users text[];
  _expiry_date date;

BEGIN
  SELECT ARRAY_AGG(id ORDER BY id) INTO _med_ids FROM medications WHERE workspace_id = _ws;
  SELECT ARRAY_AGG(id) INTO _user_ids FROM workspace_users WHERE workspace_id = _ws;

  DELETE FROM audit_log WHERE workspace_id = _ws;
  DELETE FROM medication_orders WHERE workspace_id = _ws;
  DELETE FROM dispensations WHERE workspace_id = _ws;
  DELETE FROM sales WHERE workspace_id = _ws;
  DELETE FROM transfer_requests WHERE workspace_id = _ws;
  DELETE FROM movements WHERE workspace_id = _ws;
  DELETE FROM medication_stock_config WHERE medication_id = ANY(_med_ids);
  DELETE FROM batches WHERE warehouse_id = ANY(_wh_ids);
  DELETE FROM patients WHERE workspace_id = _ws;
  DELETE FROM beds WHERE room_id IN (SELECT id FROM rooms WHERE workspace_id = _ws);
  DELETE FROM rooms WHERE workspace_id = _ws;
  DELETE FROM wings WHERE workspace_id = _ws;

  INSERT INTO wings (workspace_id, name, type, prefix) VALUES
    (_ws, 'Emergencias Pediátrica', 'urgencias', 1),
    (_ws, 'Quirófanos Infantil',    'quirofanos', 2),
    (_ws, 'UTI Pediátrica',         'cuidados_intensivos', 3),
    (_ws, 'Internación Pediatría',  'hospitalizacion', 4)
  ON CONFLICT (workspace_id, name) DO NOTHING;

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
    VALUES (_ws, _patient_first[_i], _patient_last[_i], _patient_insurance[_i], _patient_diagnosis[_i], _patient_doctor[_i], 'Sala ' || _i);
  END LOOP;

  -- BATCHES
  -- Déficit: amoxicilina(3), salbutamol(5)
  -- Sobrestock: paracetamol(1), loratadina(9)

  FOR _med_idx IN 1..18 LOOP
    _expiry_date := CASE
      WHEN _med_idx IN (3,5) THEN NOW()::date + 25
      WHEN _med_idx IN (1,9) THEN NOW()::date + 340
      ELSE NOW()::date + (120 + _med_idx*12)
    END;
    INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
    VALUES ('b24-nin-c-' || LPAD(_med_idx::text,2,'0'), _med_ids[_med_idx], 'wh-ws-ninez-central',
      'NIN-C-' || LPAD(_med_idx::text,3,'0'), _expiry_date, _stock_qty[_med_idx]);
  END LOOP;

  FOR _med_idx IN 1..18 LOOP
    _expiry_date := NOW()::date + (60 + _med_idx*14);
    INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
    VALUES ('b24-nin-i-' || LPAD(_med_idx::text,2,'0'), _med_ids[_med_idx], 'wh-ws-ninez-interna',
      'NIN-I-' || LPAD(_med_idx::text,3,'0'), _expiry_date,
      GREATEST((_stock_qty[_med_idx]*0.2)::int, 2));
  END LOOP;

  FOR _med_idx IN 1..16 LOOP
    _expiry_date := NOW()::date + (30 + _med_idx*25);
    INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
    VALUES ('b24-nin-v-' || LPAD(_med_idx::text,2,'0'), _med_ids[_med_idx], 'wh-ws-ninez-ventas',
      'NIN-V-' || LPAD(_med_idx::text,3,'0'), _expiry_date,
      GREATEST((_stock_qty[_med_idx]*0.06)::int, 1));
  END LOOP;

  -- 2 vencidos: Ibuprofeno(2) y Diclofenac(8)
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-nin-c-02-exp', _med_ids[2], 'wh-ws-ninez-central', 'NIN-C-002-EXP', NOW()::date - 18, 500);
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-nin-c-08-exp', _med_ids[8], 'wh-ws-ninez-central', 'NIN-C-008-EXP', NOW()::date - 7, 100);

  -- 2 próximos: Amoxicilina(3) y Salbutamol(5)
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-nin-c-03-prox', _med_ids[3], 'wh-ws-ninez-central', 'NIN-C-003-PROX', NOW()::date + 6, 200);
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-nin-c-05-prox', _med_ids[5], 'wh-ws-ninez-central', 'NIN-C-005-PROX', NOW()::date + 3, 80);

  -- STOCK CONFIG
  FOR _med_idx IN 1..18 LOOP
    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
    VALUES (_med_ids[_med_idx], 'wh-ws-ninez-central', _min_central[_med_idx], _opt_central[_med_idx])
    ON CONFLICT (medication_id, warehouse_id) DO NOTHING;
  END LOOP;
  FOR _med_idx IN 1..18 LOOP
    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
    VALUES (_med_ids[_med_idx], 'wh-ws-ninez-interna', _min_interna[_med_idx], _opt_interna[_med_idx])
    ON CONFLICT (medication_id, warehouse_id) DO NOTHING;
  END LOOP;
  FOR _med_idx IN 1..16 LOOP
    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
    VALUES (_med_ids[_med_idx], 'wh-ws-ninez-ventas', _min_ventas[_med_idx], _opt_ventas[_med_idx])
    ON CONFLICT (medication_id, warehouse_id) DO NOTHING;
  END LOOP;

  UPDATE warehouses SET max_capacity = 25000 WHERE id = 'wh-ws-ninez-central';
  UPDATE warehouses SET max_capacity =  6000 WHERE id = 'wh-ws-ninez-interna';
  UPDATE warehouses SET max_capacity =  2000 WHERE id = 'wh-ws-ninez-ventas';

  -- MOVEMENTS
  SELECT ARRAY_AGG(DISTINCT name) INTO _random_users FROM workspace_users WHERE workspace_id = _ws;
  _counter := 0;
  FOR _med_idx IN 1..18 LOOP
    FOR _j IN 1..2 LOOP
      _counter := _counter + 1;
      INSERT INTO movements (id, workspace_id, type, medication_id, warehouse_id, quantity, user_name, reason, date)
      VALUES ('m24-nin-' || LPAD(_counter::text,3,'0'), _ws, 'ingreso', _med_ids[_med_idx], 'wh-ws-ninez-central',
        (_stock_qty[_med_idx]*(0.2+random()*0.3))::int,
        _random_users[1+floor(random()*array_length(_random_users,1))::int],
        'OC-NIN-' || LPAD((3000+_counter)::text,4,'0'),
        NOW() - INTERVAL '1 day' * (8+_med_idx*2+_j*6))
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
  FOR _med_idx IN 1..18 LOOP
    _counter := _counter + 1;
    INSERT INTO movements (id, workspace_id, type, medication_id, warehouse_id, quantity, user_name, reason, date)
    VALUES ('m24-nin-' || LPAD(_counter::text,3,'0'), _ws, 'egreso', _med_ids[_med_idx], 'wh-ws-ninez-central',
      -((_stock_qty[_med_idx]*0.05)::int),
      _random_users[1+floor(random()*array_length(_random_users,1))::int],
      'Consumo pediatría', NOW() - INTERVAL '1 day' * (5+_med_idx*2))
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- TRANSFERS (5)
  INSERT INTO transfer_code_counters (workspace_id, period_yyyymm, last_value)
  VALUES (_ws, TO_CHAR(NOW(),'YYYYMM'), 0)
  ON CONFLICT (workspace_id, period_yyyymm) DO NOTHING;

  FOR _med_idx IN 1..5 LOOP
    INSERT INTO transfer_requests (id, workspace_id, transfer_code, medication_id, from_warehouse_id, to_warehouse_id, quantity, status, requested_by, date)
    VALUES ('trf-' || _ws || '-' || _med_idx, _ws,
      TO_CHAR(NOW(),'YYYYMM') || '-' || LPAD(_med_idx::text,5,'0'),
      _med_ids[_med_idx], 'wh-ws-ninez-central', 'wh-ws-ninez-interna',
      15+_med_idx*10,
      (ARRAY['solicitado','autorizado','despachado','recibido','aceptado'])[_med_idx],
      _random_users[1+floor(random()*array_length(_random_users,1))::int],
      NOW() - INTERVAL '1 day' * (random()*15)::int)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- SALES
  _counter := 0;
  FOR _med_idx IN 1..14 LOOP
    FOR _j IN 1..2 LOOP
      _counter := _counter + 1;
      INSERT INTO sales (id, workspace_id, medication_id, warehouse_id, quantity, price, cashier, date)
      VALUES ('sale-' || _ws || '-' || _counter, _ws, _med_ids[_med_idx], 'wh-ws-ninez-ventas',
        1+floor(random()*4)::int, _med_prices[_med_idx]*(1+floor(random()*4)::int),
        _random_users[1+floor(random()*array_length(_random_users,1))::int],
        NOW() - INTERVAL '1 day' * (random()*20)::int)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- DISPENSATIONS
  _counter := 0;
  FOR _med_idx IN 1..8 LOOP
    FOR _patient_id IN SELECT id FROM patients WHERE workspace_id = _ws ORDER BY id LIMIT 3 LOOP
      _counter := _counter + 1;
      INSERT INTO dispensations (id, workspace_id, medication_id, warehouse_id, quantity, doctor, patient, room, treatment, date)
      VALUES ('disp-' || _ws || '-' || _counter, _ws, _med_ids[_med_idx], 'wh-ws-ninez-interna',
        1+floor(random()*6)::int,
        (ARRAY['Dra. Álvarez','Dr. Blanco','Dra. Córdoba','Dr. Delgado'])[1+floor(random()*4)::int],
        (SELECT _patient_first[1] || ' ' || _patient_last[1]),
        'Sala ' || (1+floor(random()*15)::int),
        (ARRAY['Antibiótico pediátrico','Broncodilatador','Antitérmico','Hidratación IV','Antiinflamatorio','Analgesia'])[1+floor(random()*6)::int],
        NOW() - INTERVAL '1 day' * (random()*10)::int)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ORDERS (8)
  _counter := 0;
  FOR _med_idx IN 1..8 LOOP
    FOR _patient_id IN SELECT id FROM patients WHERE workspace_id = _ws ORDER BY id LIMIT 1 LOOP
      _counter := _counter + 1;
      INSERT INTO medication_orders (id, workspace_id, medication_id, warehouse_id, quantity, doctor, patient, room, reason, status, requested_at)
      VALUES ('ord-' || _ws || '-' || _counter, _ws, _med_ids[_med_idx], 'wh-ws-ninez-interna',
        CASE WHEN _med_idx IN (3,5) THEN 100+floor(random()*200)::int ELSE 5+floor(random()*25)::int END,
        (ARRAY['Dra. Álvarez','Dr. Blanco','Dra. Córdoba','Dr. Delgado'])[1+floor(random()*4)::int],
        (SELECT _patient_first[1] || ' ' || _patient_last[1]),
        'Sala ' || (1+floor(random()*15)::int),
        (ARRAY['Déficit crítico','Reposición urgencia','Pedido pediatría','Emergencia'])[1+floor(random()*4)::int],
        (ARRAY['pendiente','pendiente','aprobado','despachado','recibido','pendiente','aprobado','recibido'])[_counter],
        NOW() - INTERVAL '1 day' * (2+floor(random()*10)::int))
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- AUDIT (20)
  FOR _i IN 1..20 LOOP
    INSERT INTO audit_log (id, workspace_id, user_name, action, entity, date)
    VALUES ('aud-nin-' || LPAD(_i::text,3,'0'), _ws,
      _random_users[1+floor(random()*array_length(_random_users,1))::int],
      (ARRAY['Lote vencido retirado','Ingreso','Venta','Dispensación','Transferencia','Ajuste','Alta paciente','Pedido médico'])[1+floor(random()*8)::int],
      (ARRAY['Amoxicilina','Salbutamol','Ibuprofeno','Paracetamol','Lote NIN-C-002-EXP','Depósito Central','Transferencia'])[1+floor(random()*7)::int],
      NOW() - INTERVAL '1 day' * (random()*25)::int)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  UPDATE warehouses w SET volume = COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.warehouse_id = w.id), 0)
  WHERE w.workspace_id = _ws;

  RAISE NOTICE '✅ Hospital del Niño Jesús completado con stock y datos';
END $$;
