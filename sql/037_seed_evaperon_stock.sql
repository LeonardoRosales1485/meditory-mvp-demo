-- ============================================================
--  MEDITORY — Seed: Stock + datos para Hospital Eva Perón
--  Conserva workspace, warehouses, users, medications
--  existentes. Agrega batches, stock config, pacientes,
--  alas/salas/camas, movimientos, transferencias, etc.
--  Escenario: déficit en metformina(7) y ceftriaxona(13),
--  sobrestock en loratadina(9) y paracetamol(1).
-- ============================================================

DO $$
DECLARE
  _ws text := 'ws-evaperon';
  _wh_ids text[] := ARRAY['wh-ws-evaperon-central','wh-ws-evaperon-interna','wh-ws-evaperon-ventas'];
  _med_ids text[];
  _user_ids text[];
  _med_names text[] := ARRAY['Paracetamol','Ibuprofeno','Amoxicilina','Omeprazol','Salbutamol','Enalapril','Metformina','Diclofenac','Loratadina','Dexametasona','Atorvastatina','Losartán','Ceftriaxona','Heparina','Solución NaCl','Azitromicina','Carvedilol','Clonazepam'];
  _med_sale bool[] := ARRAY[true,true,true,true,true,true,true,true,true,true,true,true,true,false,false,true,true,true];
  _med_prices numeric[] := ARRAY[850,1200,2500,1500,3200,600,900,1800,720,2100,1500,890,3500,4200,400,2500,1200,800];

  _stock_qty int[] := ARRAY[4000,2000,1800,1200,500,1000,300,500,2500,600,1500,600,80,300,10000,600,400,300];
  _min_central int[] := ARRAY[1400,1000,1000,900,400,600,1200,400,500,300,800,500,200,150,8000,400,300,200];
  _opt_central int[] := ARRAY[2500,1800,1800,1600,700,1000,2200,700,900,550,1400,900,380,280,15000,700,550,380];
  _min_interna int[] := ARRAY[280,200,200,180,80,120,240,80,100,60,160,100,40,30,1600,80,60,40];
  _opt_interna int[] := ARRAY[500,360,360,320,140,200,440,140,180,110,280,180,76,56,3000,140,110,76];
  _min_ventas int[] := ARRAY[85,60,60,55,25,35,75,25,30,15,45,25,12,0,0,25,20,15];
  _opt_ventas int[] := ARRAY[150,110,110,100,45,60,135,45,55,25,75,45,25,0,0,45,35,25];

  _wing_id uuid; _room_id uuid; _bed_id uuid; _patient_id uuid;
  _i int; _j int; _med_idx int; _wing_idx int; _room_idx int;
  _counter int := 0;
  _room_numbers int[] := ARRAY[1,2,3,4,5,6,7,8,9,10];
  _bed_counts int[] := ARRAY[3,2,3,2,3,2,2,3,2,2];

  _patient_last text[] := ARRAY['Quinteros','Figueroa','Maldonado','Ávila','Bustos','Ceballos','Núñez','Páez','Rivero','Sarmiento'];
  _patient_first text[] := ARRAY['Oscar','Elisa','Marcelo','Roxana','Daniel','Patricia','Jorge','Yamila','Sebastián','Andrea'];
  _patient_insurance text[] := ARRAY['OSDE','PAMI','IOMA','Swiss Medical','PAMI','OSDE','IOMA','Swiss Medical','OSDE','PAMI'];
  _patient_diagnosis text[] := ARRAY['Diabetes insulino','Neumonía basal','Colecistectomía','Angina inestable','Artritis reumatoide','Pielonefritis','Insuficiencia renal','Fractura de tobillo','Crisis hipertensiva','Gastritis erosiva'];
  _patient_doctor text[] := ARRAY['Dr. Quinteros','Dra. Ceballos','Dr. Núñez','Dra. Ávila','Dr. Quinteros','Dra. Ceballos','Dr. Núñez','Dra. Ávila','Dr. Quinteros','Dra. Ceballos'];

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

  -- ══════════════════════════════════════════
  --  1. WINGS (4)
  -- ══════════════════════════════════════════
  INSERT INTO wings (workspace_id, name, type, prefix) VALUES
    (_ws, 'Emergencias',      'urgencias',          1),
    (_ws, 'Quirófanos',       'quirofanos',         2),
    (_ws, 'UTI',              'cuidados_intensivos',3),
    (_ws, 'Internación',      'hospitalizacion',    4)
  ON CONFLICT (workspace_id, name) DO NOTHING;

  -- ══════════════════════════════════════════
  --  2. ROOMS & BEDS
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
  --  3. PATIENTS (10)
  -- ══════════════════════════════════════════
  FOR _i IN 1..10 LOOP
    INSERT INTO patients (workspace_id, first_name, last_name, insurance, diagnosis, assigned_doctor, room)
    VALUES (_ws, _patient_first[_i], _patient_last[_i], _patient_insurance[_i], _patient_diagnosis[_i], _patient_doctor[_i], 'Sala ' || _i);
  END LOOP;

  -- ══════════════════════════════════════════
  --  4. BATCHES
  -- ══════════════════════════════════════════
  -- Déficit: metformina(7), ceftriaxona(13)
  -- Sobrestock: loratadina(9), paracetamol(1)

  -- Central: 18 meds
  FOR _med_idx IN 1..18 LOOP
    _expiry_date := CASE
      WHEN _med_idx IN (7,13) THEN NOW()::date + 30
      WHEN _med_idx IN (1,9) THEN NOW()::date + 320
      ELSE NOW()::date + (100 + _med_idx*15)
    END;
    INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
    VALUES ('b24-eva-c-' || LPAD(_med_idx::text,2,'0'), _med_ids[_med_idx], 'wh-ws-evaperon-central',
      'EVA-C-' || LPAD(_med_idx::text,3,'0'), _expiry_date, _stock_qty[_med_idx]);
  END LOOP;

  -- Interna: 18 meds
  FOR _med_idx IN 1..18 LOOP
    _expiry_date := NOW()::date + (70 + _med_idx*12);
    INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
    VALUES ('b24-eva-i-' || LPAD(_med_idx::text,2,'0'), _med_ids[_med_idx], 'wh-ws-evaperon-interna',
      'EVA-I-' || LPAD(_med_idx::text,3,'0'), _expiry_date,
      GREATEST((_stock_qty[_med_idx]*0.2)::int, 2));
  END LOOP;

  -- Ventas: 16 meds
  FOR _med_idx IN 1..16 LOOP
    _expiry_date := NOW()::date + (35 + _med_idx*22);
    INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
    VALUES ('b24-eva-v-' || LPAD(_med_idx::text,2,'0'), _med_ids[_med_idx], 'wh-ws-evaperon-ventas',
      'EVA-V-' || LPAD(_med_idx::text,3,'0'), _expiry_date,
      GREATEST((_stock_qty[_med_idx]*0.06)::int, 1));
  END LOOP;

  -- 2 vencidos: Omeprazol(4) y Enalapril(6) en central
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-eva-c-04-exp', _med_ids[4], 'wh-ws-evaperon-central', 'EVA-C-004-EXP', NOW()::date - 12, 300);
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-eva-c-06-exp', _med_ids[6], 'wh-ws-evaperon-central', 'EVA-C-006-EXP', NOW()::date - 6, 150);

  -- 2 próximos a vencer: Metformina(7) y Ceftriaxona(13)
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-eva-c-07-prox', _med_ids[7], 'wh-ws-evaperon-central', 'EVA-C-007-PROX', NOW()::date + 8, 150);
  INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
  VALUES ('b24-eva-c-13-prox', _med_ids[13], 'wh-ws-evaperon-central', 'EVA-C-013-PROX', NOW()::date + 4, 40);

  -- ══════════════════════════════════════════
  --  5. STOCK CONFIG
  -- ══════════════════════════════════════════
  FOR _med_idx IN 1..18 LOOP
    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
    VALUES (_med_ids[_med_idx], 'wh-ws-evaperon-central', _min_central[_med_idx], _opt_central[_med_idx])
    ON CONFLICT (medication_id, warehouse_id) DO NOTHING;
  END LOOP;
  FOR _med_idx IN 1..18 LOOP
    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
    VALUES (_med_ids[_med_idx], 'wh-ws-evaperon-interna', _min_interna[_med_idx], _opt_interna[_med_idx])
    ON CONFLICT (medication_id, warehouse_id) DO NOTHING;
  END LOOP;
  FOR _med_idx IN 1..16 LOOP
    INSERT INTO medication_stock_config (medication_id, warehouse_id, min_stock, optimal_stock)
    VALUES (_med_ids[_med_idx], 'wh-ws-evaperon-ventas', _min_ventas[_med_idx], _opt_ventas[_med_idx])
    ON CONFLICT (medication_id, warehouse_id) DO NOTHING;
  END LOOP;

  -- ══════════════════════════════════════════
  --  6. CAPACIDAD
  -- ══════════════════════════════════════════
  UPDATE warehouses SET max_capacity = 30000 WHERE id = 'wh-ws-evaperon-central';
  UPDATE warehouses SET max_capacity =  8000 WHERE id = 'wh-ws-evaperon-interna';
  UPDATE warehouses SET max_capacity =  2500 WHERE id = 'wh-ws-evaperon-ventas';

  -- ══════════════════════════════════════════
  --  7. MOVEMENTS
  -- ══════════════════════════════════════════
  SELECT ARRAY_AGG(DISTINCT name) INTO _random_users FROM workspace_users WHERE workspace_id = _ws;
  _counter := 0;
  FOR _med_idx IN 1..18 LOOP
    FOR _j IN 1..2 LOOP
      _counter := _counter + 1;
      INSERT INTO movements (id, workspace_id, type, medication_id, warehouse_id, quantity, user_name, reason, date)
      VALUES ('m24-eva-' || LPAD(_counter::text,3,'0'), _ws, 'ingreso', _med_ids[_med_idx], 'wh-ws-evaperon-central',
        (_stock_qty[_med_idx]*(0.2+random()*0.3))::int,
        _random_users[1+floor(random()*array_length(_random_users,1))::int],
        'OC-EVA-' || LPAD((2000+_counter)::text,4,'0'),
        NOW() - INTERVAL '1 day' * (10+_med_idx*2+_j*5))
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
  FOR _med_idx IN 1..18 LOOP
    _counter := _counter + 1;
    INSERT INTO movements (id, workspace_id, type, medication_id, warehouse_id, quantity, user_name, reason, date)
    VALUES ('m24-eva-' || LPAD(_counter::text,3,'0'), _ws, 'egreso', _med_ids[_med_idx], 'wh-ws-evaperon-central',
      -((_stock_qty[_med_idx]*0.05)::int),
      _random_users[1+floor(random()*array_length(_random_users,1))::int],
      'Consumo general', NOW() - INTERVAL '1 day' * (4+_med_idx*2))
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- ══════════════════════════════════════════
  --  8. TRANSFERS (6)
  -- ══════════════════════════════════════════
  INSERT INTO transfer_code_counters (workspace_id, period_yyyymm, last_value)
  VALUES (_ws, TO_CHAR(NOW(),'YYYYMM'), 0)
  ON CONFLICT (workspace_id, period_yyyymm) DO NOTHING;

  FOR _med_idx IN 1..6 LOOP
    INSERT INTO transfer_requests (id, workspace_id, transfer_code, medication_id, from_warehouse_id, to_warehouse_id, quantity, status, requested_by, date)
    VALUES ('trf-' || _ws || '-' || _med_idx, _ws,
      TO_CHAR(NOW(),'YYYYMM') || '-' || LPAD(_med_idx::text,5,'0'),
      _med_ids[_med_idx], 'wh-ws-evaperon-central', 'wh-ws-evaperon-interna',
      15+_med_idx*10,
      (ARRAY['solicitado','solicitado','autorizado','despachado','recibido','aceptado'])[_med_idx],
      _random_users[1+floor(random()*array_length(_random_users,1))::int],
      NOW() - INTERVAL '1 day' * (random()*20)::int)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- ══════════════════════════════════════════
  --  9. SALES (14 meds × 2)
  -- ══════════════════════════════════════════
  _counter := 0;
  FOR _med_idx IN 1..14 LOOP
    FOR _j IN 1..2 LOOP
      _counter := _counter + 1;
      INSERT INTO sales (id, workspace_id, medication_id, warehouse_id, quantity, price, cashier, date)
      VALUES ('sale-' || _ws || '-' || _counter, _ws, _med_ids[_med_idx], 'wh-ws-evaperon-ventas',
        1+floor(random()*5)::int, _med_prices[_med_idx]*(1+floor(random()*5)::int),
        _random_users[1+floor(random()*array_length(_random_users,1))::int],
        NOW() - INTERVAL '1 day' * (random()*25)::int)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ══════════════════════════════════════════
  --  10. DISPENSATIONS (8 meds × 3)
  -- ══════════════════════════════════════════
  _counter := 0;
  FOR _med_idx IN 1..8 LOOP
    FOR _patient_id IN SELECT id FROM patients WHERE workspace_id = _ws ORDER BY id LIMIT 3 LOOP
      _counter := _counter + 1;
      INSERT INTO dispensations (id, workspace_id, medication_id, warehouse_id, quantity, doctor, patient, room, treatment, date)
      VALUES ('disp-' || _ws || '-' || _counter, _ws, _med_ids[_med_idx], 'wh-ws-evaperon-interna',
        1+floor(random()*8)::int,
        (ARRAY['Dr. Quinteros','Dra. Ceballos','Dr. Núñez','Dra. Ávila'])[1+floor(random()*4)::int],
        (SELECT _patient_first[1] || ' ' || _patient_last[1]),
        'Sala ' || (1+floor(random()*15)::int),
        (ARRAY['Antibiótico','Analgesia','Insulina','Antihipertensivo','Antiinflamatorio','Cardiotónico'])[1+floor(random()*6)::int],
        NOW() - INTERVAL '1 day' * (random()*12)::int)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ══════════════════════════════════════════
  --  11. MEDICATION ORDERS (8)
  -- ══════════════════════════════════════════
  _counter := 0;
  FOR _med_idx IN 1..8 LOOP
    FOR _patient_id IN SELECT id FROM patients WHERE workspace_id = _ws ORDER BY id LIMIT 1 LOOP
      _counter := _counter + 1;
      INSERT INTO medication_orders (id, workspace_id, medication_id, warehouse_id, quantity, doctor, patient, room, reason, status, requested_at)
      VALUES ('ord-' || _ws || '-' || _counter, _ws, _med_ids[_med_idx], 'wh-ws-evaperon-interna',
        CASE WHEN _med_idx IN (7,13) THEN 120+floor(random()*200)::int ELSE 10+floor(random()*30)::int END,
        (ARRAY['Dr. Quinteros','Dra. Ceballos','Dr. Núñez','Dra. Ávila'])[1+floor(random()*4)::int],
        (SELECT _patient_first[1] || ' ' || _patient_last[1]),
        'Sala ' || (1+floor(random()*15)::int),
        (ARRAY['Déficit crítico','Reposición','Cirugía','Emergencia'])[1+floor(random()*4)::int],
        (ARRAY['pendiente','pendiente','aprobado','despachado','recibido','pendiente','aprobado','recibido'])[_counter],
        NOW() - INTERVAL '1 day' * (3+floor(random()*12)::int))
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ══════════════════════════════════════════
  --  12. AUDIT LOG (20)
  -- ══════════════════════════════════════════
  FOR _i IN 1..20 LOOP
    INSERT INTO audit_log (id, workspace_id, user_name, action, entity, date)
    VALUES ('aud-eva-' || LPAD(_i::text,3,'0'), _ws,
      _random_users[1+floor(random()*array_length(_random_users,1))::int],
      (ARRAY['Lote vencido retirado','Ingreso','Venta','Dispensación','Transferencia','Ajuste','Alta de paciente','Pedido médico'])[1+floor(random()*8)::int],
      (ARRAY['Metformina','Ceftriaxona','Omeprazol','Enalapril','Lote EVA-C-004-EXP','Depósito Central','Transferencia'])[1+floor(random()*7)::int],
      NOW() - INTERVAL '1 day' * (random()*30)::int)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  UPDATE warehouses w SET volume = COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.warehouse_id = w.id), 0)
  WHERE w.workspace_id = _ws;

  RAISE NOTICE '✅ Hospital Eva Perón completado con stock y datos';
END $$;
