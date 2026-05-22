-- ============================================================
--  MEDITORY — Seed masivo de datos dummy
--  Inserta muchísima información en TODAS las tablas para
--  los workspaces ws-aleman (Hospital Alemán) y ws-francisco
--  (Hospital Francisco). Es idempotente.
-- ============================================================

-- ─────────────────────────────────────────────
--  0. LIMPIEZA (orden inverso de FKs)
-- ─────────────────────────────────────────────
DELETE FROM audit_log;
DELETE FROM beds;
DELETE FROM rooms;
DELETE FROM wings;
DELETE FROM medication_orders;
DELETE FROM dispensations;
DELETE FROM sales;
DELETE FROM transfer_requests;
DELETE FROM movements;
DELETE FROM batches;
DELETE FROM workspace_user_warehouses;
DELETE FROM workspace_users;
DELETE FROM patients;
DELETE FROM medications;
DELETE FROM warehouses;
DELETE FROM transfer_code_counters;

-- ─────────────────────────────────────────────
--  1. WORKSPACES
-- ─────────────────────────────────────────────
INSERT INTO workspaces (id, name, slug) VALUES
  ('ws-aleman',    'Hospital Alemán',    'HOSPITALALEMAN'),
  ('ws-francisco', 'Hospital Francisco', 'HOSPITALFRANCISCO')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
--  2. WAREHOUSES (IDs text)
-- ─────────────────────────────────────────────
CREATE TEMP TABLE IF NOT EXISTS tmp_wh (id text, name text, type text, ws_id text);
TRUNCATE tmp_wh;

WITH inserted AS (
  INSERT INTO warehouses (id, workspace_id, name, type, unit) VALUES
    ('wh-aleman-central', 'ws-aleman',    'Depósito Central',    'central', 'Hospital Alemán'),
    ('wh-aleman-interna', 'ws-aleman',    'Farmacia Interna',    'interna', 'Hospital Alemán'),
    ('wh-aleman-ventas',  'ws-aleman',    'Farmacia Ventas',     'ventas',  'Hospital Alemán'),
    ('wh-fco-central',    'ws-francisco', 'Depósito Central',    'central', 'Hospital Francisco'),
    ('wh-fco-interna',    'ws-francisco', 'Farmacia Interna',    'interna', 'Hospital Francisco'),
    ('wh-fco-ventas',     'ws-francisco', 'Farmacia Ventas',     'ventas',  'Hospital Francisco')
  RETURNING id, name, type, workspace_id
)
INSERT INTO tmp_wh SELECT id, name, type, workspace_id FROM inserted;

-- ─────────────────────────────────────────────
--  3. WORKSPACE USERS (IDs text)
-- ─────────────────────────────────────────────
CREATE TEMP TABLE IF NOT EXISTS tmp_user (id text, name text, role text, ws_id text);
TRUNCATE tmp_user;

WITH inserted AS (
  INSERT INTO workspace_users (id, workspace_id, name, email, role) VALUES
    ('u-admin-ale',  'ws-aleman',    'Admin Alemán',    'hospitalalemanadmin@user.com',     'admin'),
    ('u-ven-ale',    'ws-aleman',    'María Pérez',     'hospitalalemanventas@user.com',    'ventas'),
    ('u-doc-ale',    'ws-aleman',    'Doctor García',   'hospitalalemandactor@user.com',    'doctor'),
    ('u-tec-ale',    'ws-aleman',    'Enf. Sosa',       'hospitalalemanntecnico@user.com',  'tecnico'),
    ('u-admin-fco',  'ws-francisco', 'Admin Francisco', 'hospitalfranciscoadmin@user.com',  'admin'),
    ('u-ven-fco',    'ws-francisco', 'Carlos Ruiz',     'hospitalfranciscoventas@user.com', 'ventas'),
    ('u-doc-fco',    'ws-francisco', 'Doctor Mendoza',  'hospitalfranciscodoctor@user.com', 'doctor'),
    ('u-tec-fco',    'ws-francisco', 'Enf. Vega',       'hospitalfranciscotecnico@user.com','tecnico')
  ON CONFLICT (id) DO NOTHING
  RETURNING id, name, role, workspace_id
)
INSERT INTO tmp_user SELECT id, name, role, workspace_id FROM inserted;

-- Segundo batch (IDs extras)
WITH inserted AS (
  INSERT INTO workspace_users (id, workspace_id, name, email, role) VALUES
    ('u-ale-laura',    'ws-aleman',    'Laura Rosales',  'laura.rosales@aleman.com',    'admin'),
    ('u-ale-pedro',    'ws-aleman',    'Pedro Sánchez',  'pedro.sanchez@aleman.com',    'ventas'),
    ('u-ale-torres',   'ws-aleman',    'Dra. Torres',    'dra.torres@aleman.com',       'doctor'),
    ('u-ale-martin',   'ws-aleman',    'Martín López',   'martin.lopez@aleman.com',     'tecnico'),
    ('u-ale-lucia',    'ws-aleman',    'Lucía Fernández','lucia.fernandez@aleman.com',  'doctor'),
    ('u-ale-roberto',  'ws-aleman',    'Roberto Díaz',   'roberto.diaz@aleman.com',     'ventas'),
    ('u-fco-ana',      'ws-francisco', 'Ana Martínez',   'ana.martinez@francisco.com',  'admin'),
    ('u-fco-jorge',    'ws-francisco', 'Jorge Ramírez',  'jorge.ramirez@francisco.com', 'ventas'),
    ('u-fco-rios',     'ws-francisco', 'Dra. Ríos',      'dra.rios@francisco.com',      'doctor'),
    ('u-fco-sofia',    'ws-francisco', 'Sofía Castillo', 'sofia.castillo@francisco.com','tecnico'),
    ('u-fco-diego',    'ws-francisco', 'Diego Gómez',    'diego.gomez@francisco.com',   'doctor'),
    ('u-fco-valen',    'ws-francisco', 'Valentina Ortiz','valentina.ortiz@francisco.com','ventas')
  ON CONFLICT (id) DO NOTHING
  RETURNING id, name, role, workspace_id
)
INSERT INTO tmp_user SELECT id, name, role, workspace_id FROM inserted;

-- ─────────────────────────────────────────────
--  4. WORKSPACE_USER_WAREHOUSES
-- ─────────────────────────────────────────────
INSERT INTO workspace_user_warehouses (user_id, warehouse_id)
SELECT u.id, w.id
FROM tmp_user u
JOIN tmp_wh w ON w.ws_id = u.ws_id
WHERE u.role = 'admin';

INSERT INTO workspace_user_warehouses (user_id, warehouse_id)
SELECT u.id, w.id
FROM tmp_user u
JOIN tmp_wh w ON w.ws_id = u.ws_id AND w.type = 'ventas'
WHERE u.role = 'ventas';

INSERT INTO workspace_user_warehouses (user_id, warehouse_id)
SELECT u.id, w.id
FROM tmp_user u
JOIN tmp_wh w ON w.ws_id = u.ws_id AND w.type = 'interna'
WHERE u.role = 'doctor';

INSERT INTO workspace_user_warehouses (user_id, warehouse_id)
SELECT u.id, w.id
FROM tmp_user u
JOIN tmp_wh w ON w.ws_id = u.ws_id AND w.type IN ('central', 'interna')
WHERE u.role = 'tecnico';

-- ─────────────────────────────────────────────
--  5. MEDICATIONS — 15 por workspace (IDs text)
-- ─────────────────────────────────────────────
CREATE TEMP TABLE IF NOT EXISTS tmp_med (id text, name text, sale_enabled boolean, ws_id text);
TRUNCATE tmp_med;

WITH inserted AS (
  INSERT INTO medications (id, workspace_id, name, active_ingredient, concentration_value, concentration_unit, form, sale_price, sale_enabled) VALUES
    -- Hospital Alemán
    ('med-ale-01', 'ws-aleman', 'Paracetamol',      'Paracetamol',       500,  'mg',     'Comprimido',   850,  true),
    ('med-ale-02', 'ws-aleman', 'Ibuprofeno',       'Ibuprofeno',        400,  'mg',     'Comprimido',   1200, true),
    ('med-ale-03', 'ws-aleman', 'Amoxicilina',      'Amoxicilina',       875,  'mg',     'Cápsula',      2500, true),
    ('med-ale-04', 'ws-aleman', 'Omeprazol',        'Omeprazol',         20,   'mg',     'Cápsula',      1500, true),
    ('med-ale-05', 'ws-aleman', 'Salbutamol',       'Salbutamol',        100,  'mcg',    'Aerosol',      3200, true),
    ('med-ale-06', 'ws-aleman', 'Enalapril',        'Enalapril',         10,   'mg',     'Comprimido',   900,  true),
    ('med-ale-07', 'ws-aleman', 'Metformina',       'Metformina',        850,  'mg',     'Comprimido',   1100, true),
    ('med-ale-08', 'ws-aleman', 'Diclofenac',       'Diclofenac',        75,   'mg',     'Inyectable',   1800, true),
    ('med-ale-09', 'ws-aleman', 'Loratadina',       'Loratadina',        10,   'mg',     'Comprimido',   650,  true),
    ('med-ale-10', 'ws-aleman', 'Dexametasona',     'Dexametasona',      8,    'mg',     'Inyectable',   2200, true),
    ('med-ale-11', 'ws-aleman', 'Atorvastatina',    'Atorvastatina',     20,   'mg',     'Comprimido',   2800, true),
    ('med-ale-12', 'ws-aleman', 'Losartán',         'Losartán',          50,   'mg',     'Comprimido',   1700, true),
    ('med-ale-13', 'ws-aleman', 'Ceftriaxona',      'Ceftriaxona',       1,    'g',      'Inyectable',   4500, true),
    ('med-ale-14', 'ws-aleman', 'Heparina',         'Heparina',          5000, 'unidad', 'Inyectable',   3800, false),
    ('med-ale-15', 'ws-aleman', 'Solución NaCl',    'Cloruro de sodio',  500,  'ml',     'Solución',     600,  false),
    -- Hospital Francisco
    ('med-fco-01', 'ws-francisco', 'Paracetamol',      'Paracetamol',       500,  'mg',     'Comprimido',   850,  true),
    ('med-fco-02', 'ws-francisco', 'Ibuprofeno',       'Ibuprofeno',        600,  'mg',     'Comprimido',   1300, true),
    ('med-fco-03', 'ws-francisco', 'Amoxicilina',      'Amoxicilina',       500,  'mg',     'Cápsula',      2000, true),
    ('med-fco-04', 'ws-francisco', 'Omeprazol',        'Omeprazol',         40,   'mg',     'Inyectable',   2500, true),
    ('med-fco-05', 'ws-francisco', 'Salbutamol',       'Salbutamol',        100,  'mcg',    'Aerosol',      3200, true),
    ('med-fco-06', 'ws-francisco', 'Clonazepam',       'Clonazepam',        2,    'mg',     'Comprimido',   1800, true),
    ('med-fco-07', 'ws-francisco', 'Metformina',       'Metformina',        1000, 'mg',     'Comprimido',   1400, true),
    ('med-fco-08', 'ws-francisco', 'Tramadol',         'Tramadol',          50,   'mg',     'Inyectable',   2100, true),
    ('med-fco-09', 'ws-francisco', 'Montelukast',      'Montelukast',       10,   'mg',     'Comprimido',   2900, true),
    ('med-fco-10', 'ws-francisco', 'Furosemida',       'Furosemida',        40,   'mg',     'Comprimido',   750,  true),
    ('med-fco-11', 'ws-francisco', 'Carvedilol',       'Carvedilol',        25,   'mg',     'Comprimido',   1600, true),
    ('med-fco-12', 'ws-francisco', 'Azitromicina',     'Azitromicina',      500,  'mg',     'Comprimido',   3500, true),
    ('med-fco-13', 'ws-francisco', 'Insulina NPH',     'Insulina NPH',      100,  'unidad', 'Inyectable',   4200, false),
    ('med-fco-14', 'ws-francisco', 'Morfina',          'Morfina',           10,   'mg',     'Inyectable',   1500, false),
    ('med-fco-15', 'ws-francisco', 'Ringer Lactato',   'Ringer Lactato',    500,  'ml',     'Solución',     800,  false)
  RETURNING id, name, sale_enabled, workspace_id
)
INSERT INTO tmp_med SELECT id, name, sale_enabled, workspace_id FROM inserted;

-- ─────────────────────────────────────────────
--  6. WINGS (alas médicas, IDs uuid)
-- ─────────────────────────────────────────────
CREATE TEMP TABLE IF NOT EXISTS tmp_wing (id uuid, name text, ws_id text, prefix int);
TRUNCATE tmp_wing;

WITH inserted AS (
  INSERT INTO wings (workspace_id, name, type, prefix) VALUES
    ('ws-aleman',    'Urgencias',          'urgencias',            1),
    ('ws-aleman',    'Quirófanos',         'quirofanos',           2),
    ('ws-aleman',    'Cuidados Intensivos','cuidados_intensivos',  3),
    ('ws-aleman',    'Hospitalización',    'hospitalizacion',      4),
    ('ws-francisco', 'Urgencias',          'urgencias',            1),
    ('ws-francisco', 'Quirófanos',         'quirofanos',           2),
    ('ws-francisco', 'Cuidados Intensivos','cuidados_intensivos',  3),
    ('ws-francisco', 'Hospitalización',    'hospitalizacion',      4)
  ON CONFLICT (workspace_id, name) DO NOTHING
  RETURNING id, name, workspace_id, prefix
)
INSERT INTO tmp_wing SELECT id, name, workspace_id, prefix FROM inserted;

-- ─────────────────────────────────────────────
--  7. ROOMS (IDs uuid, beds se crean solas vía trigger)
-- ─────────────────────────────────────────────
CREATE TEMP TABLE IF NOT EXISTS tmp_room (id uuid, full_number int);
TRUNCATE tmp_room;

WITH rooms_data AS (
  SELECT w.id AS wing_id, w.ws_id, w.prefix, v.*
  FROM tmp_wing w
  CROSS JOIN (VALUES
    (1, 2), (2, 2), (3, 3), (4, 2), (5, 2),
    (6, 3), (7, 2), (8, 2), (9, 3), (10, 2)
  ) AS v(number, bed_count)
),
inserted AS (
  INSERT INTO rooms (workspace_id, wing_id, number, bed_count)
  SELECT ws_id, wing_id, number, bed_count
  FROM rooms_data
  RETURNING id, full_number
)
INSERT INTO tmp_room SELECT id, full_number FROM inserted;

-- ─────────────────────────────────────────────
--  8. PATIENTS (IDs uuid)
-- ─────────────────────────────────────────────
CREATE TEMP TABLE IF NOT EXISTS tmp_patient (id uuid, full_name text, room text, ws_id text);
TRUNCATE tmp_patient;

WITH patient_data(full_name, sala, insurance, diagnosis, doctor, ws_id) AS (
  VALUES
    -- Hospital Alemán
    ('López, Carlos',       'Sala 7',       'OSDE',         'Neumonía bacteriana',                   'Dr. García',       'ws-aleman'),
    ('Ramírez, Ana',        'UCI',          'Swiss Medical','Control de dolor post-quirúrgico',      'Dra. Torres',      'ws-aleman'),
    ('Fernández, Roberto',  'Sala 12',      'PAMI',         'Colecistectomía',                       'Dr. García',       'ws-aleman'),
    ('Morales, Lucía',      'Sala 3',       'OSDE',         'Gastritis crónica',                     'Dra. Ríos',        'ws-aleman'),
    ('Acosta, Hugo',        'Cardiología',  'IOMA',         'Hipertensión arterial',                 'Dr. Mendoza',      'ws-aleman'),
    ('Villalba, Marta',     'Sala 9',       'PAMI',         'Diabetes tipo 2',                       'Dr. Mendoza',      'ws-aleman'),
    ('Suárez, Pablo',       'Guardia',      'OSDE',         'Traumatismo leve',                      'Dra. Torres',      'ws-aleman'),
    ('Romero, Valeria',     'Sala 2',       'Swiss Medical','Crisis asmática',                       'Dr. García',       'ws-aleman'),
    ('Castro, Ernesto',     'UCI',          'IOMA',         'Neumonía bilateral',                    'Dra. Ríos',        'ws-aleman'),
    ('Gutiérrez, Sofía',    'Sala 5',       'OSDE',         'Apendicitis',                           'Dr. García',       'ws-aleman'),
    ('Herrera, Diego',      'Sala 11',      'Swiss Medical','Insuficiencia renal crónica',           'Dra. Torres',      'ws-aleman'),
    ('Navarro, Elena',      'Cardiología',  'PAMI',         'Arritmia cardíaca',                     'Dr. Mendoza',      'ws-aleman'),
    ('Delgado, Tomás',      'Guardia',      'OSDE',         'Lumbalgia aguda',                       'Dr. García',       'ws-aleman'),
    ('Pereyra, Gabriel',    'Sala 4',       'IOMA',         'Insuficiencia cardíaca congestiva',     'Dra. Ríos',        'ws-aleman'),
    ('Medina, Laura',       'Sala 8',       'OSDE',         'Infección urinaria',                    'Dr. García',       'ws-aleman'),
    ('Aguirre, Pablo',      'Sala 1',       'Swiss Medical','Fractura de fémur',                     'Dra. Torres',      'ws-aleman'),
    ('Roldán, Silvia',      'Sala 6',       'PAMI',         'Neumonía aspirativa',                   'Dr. Mendoza',      'ws-aleman'),
    ('Vega, Miguel',        'Sala 10',      'OSDE',         'Pancreatitis aguda',                    'Dr. García',       'ws-aleman'),
    ('Ferreyra, Claudia',   'UCI',          'IOMA',         'Shock séptico',                         'Dra. Ríos',        'ws-aleman'),
    ('Mansilla, Jorge',     'Sala 3',       'Swiss Medical','Bronquitis crónica reagudizada',        'Dra. Torres',      'ws-aleman'),
    ('Álvarez, Patricia',   'Sala 5',       'OSDE',         'Histerectomía programada',              'Dr. García',       'ws-aleman'),
    ('Godoy, Esteban',      'Cardiología',  'PAMI',         'Infarto agudo de miocardio',            'Dr. Mendoza',      'ws-aleman'),
    ('Rivas, Florencia',    'Sala 2',       'IOMA',         'Neumonía adquirida en la comunidad',    'Dra. Ríos',        'ws-aleman'),
    ('Campos, Nicolás',     'UCI',          'OSDE',         'Traumatismo craneoencefálico',          'Dra. Torres',      'ws-aleman'),
    -- Hospital Francisco
    ('Ibáñez, Carmen',      'Sala 3',       'OSDE',         'Infección urinaria complicada',         'Dr. Mendoza',      'ws-francisco'),
    ('Quispe, Andrés',      'Sala 8',       'Swiss Medical','Diabetes tipo 2 descompensada',         'Dr. Gómez',        'ws-francisco'),
    ('Mamani, Rosa',        'UCI',          'PAMI',         'Neumonía grave',                        'Dra. Ríos',        'ws-francisco'),
    ('Condori, Pedro',      'Sala 1',       'IOMA',         'Accidente cerebrovascular',             'Dr. Mendoza',      'ws-francisco'),
    ('Flores, Beatriz',     'Sala 5',       'OSDE',         'Insuficiencia renal aguda',             'Dra. Ríos',        'ws-francisco'),
    ('Torrico, Juan',       'Cardiología',  'Swiss Medical','Hipertensión arterial severa',           'Dr. Gómez',        'ws-francisco'),
    ('Chávez, María',       'Sala 2',       'PAMI',         'Artritis reumatoide',                   'Dra. Ríos',        'ws-francisco'),
    ('Rocha, David',        'Sala 7',       'IOMA',         'Fractura de cadera',                    'Dr. Mendoza',      'ws-francisco'),
    ('Ortiz, Elena',        'Sala 4',       'OSDE',         'Neumonía por COVID-19',                 'Dra. Ríos',        'ws-francisco'),
    ('Salinas, Mario',      'Guardia',      'Swiss Medical','Cólico renal',                           'Dr. Gómez',        'ws-francisco'),
    ('Peña, Juana',         'Sala 6',       'PAMI',         'Enfermedad pulmonar obstructiva crónica','Dr. Mendoza',     'ws-francisco'),
    ('Cabrera, Ricardo',    'UCI',          'IOMA',         'Sepsis abdominal',                      'Dra. Ríos',        'ws-francisco'),
    ('Vargas, Ana',         'Sala 9',       'OSDE',         'Colelitiasis',                          'Dr. Gómez',        'ws-francisco'),
    ('Soria, Luis',         'Sala 10',      'Swiss Medical','Insuficiencia cardíaca',                 'Dr. Mendoza',      'ws-francisco'),
    ('Arias, Teresa',       'Cardiología',  'PAMI',         'Cardiopatía isquémica',                 'Dra. Ríos',        'ws-francisco'),
    ('Moya, Fernando',      'Sala 3',       'IOMA',         'Hernia discal',                         'Dr. Gómez',        'ws-francisco'),
    ('Méndez, Silvia',      'Sala 1',       'OSDE',         'Infección de herida quirúrgica',        'Dr. Mendoza',      'ws-francisco'),
    ('Coronel, Alberto',    'Sala 5',       'Swiss Medical','Neumotórax espontáneo',                  'Dra. Ríos',        'ws-francisco'),
    ('Aguilar, Gabriela',   'Sala 8',       'PAMI',         'Crisis hipertensiva',                   'Dr. Gómez',        'ws-francisco'),
    ('Miranda, Hugo',       'UCI',          'IOMA',         'Falla hepática aguda',                  'Dr. Mendoza',      'ws-francisco')
),
inserted AS (
  INSERT INTO patients (workspace_id, first_name, last_name, insurance, diagnosis, assigned_doctor, room)
  SELECT ws_id,
    SPLIT_PART(full_name, ', ', 2),
    SPLIT_PART(full_name, ', ', 1),
    insurance, diagnosis, doctor, sala
  FROM patient_data
  RETURNING id, workspace_id, room, last_name || ', ' || first_name AS patient_name
)
INSERT INTO tmp_patient SELECT id, patient_name, room, workspace_id FROM inserted;

-- ─────────────────────────────────────────────
--  9. ASIGNAR PACIENTES A CAMAS
-- ─────────────────────────────────────────────
UPDATE beds b
SET patient_id = p.id
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM tmp_patient
) p
JOIN (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM beds
  WHERE patient_id IS NULL
) b2 ON p.rn = b2.rn
WHERE b.id = b2.id;

-- Actualizar room según la cama asignada
UPDATE patients p
SET room = CONCAT('Sala ', r.full_number::text)
FROM beds b
JOIN rooms r ON r.id = b.room_id
WHERE b.patient_id = p.id AND b.patient_id IS NOT NULL;

-- ─────────────────────────────────────────────
--  10. BATCHES — Stock masivo (IDs text)
-- ─────────────────────────────────────────────
-- Depósito Central Alemán
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
SELECT 'bat-ale-c-' || LPAD(ROW_NUMBER() OVER (ORDER BY m.name)::text, 2, '0'),
  m.id, w.id,
  'C-2026-' || LPAD(ROW_NUMBER() OVER (ORDER BY m.name)::text, 3, '0'),
  NOW() + INTERVAL '1 day' * (30 + (ROW_NUMBER() OVER (ORDER BY m.name)) * 45),
  200 + (ROW_NUMBER() OVER (ORDER BY m.name)) * 100
FROM (SELECT id, name FROM tmp_med WHERE ws_id = 'ws-aleman') m
CROSS JOIN (SELECT id FROM tmp_wh WHERE ws_id = 'ws-aleman' AND type = 'central') w;

-- Interna Alemán
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
SELECT 'bat-ale-i-' || LPAD(ROW_NUMBER() OVER (ORDER BY m.name)::text, 2, '0'),
  m.id, w.id,
  'I-2026-' || LPAD(ROW_NUMBER() OVER (ORDER BY m.name)::text, 3, '0'),
  NOW() + INTERVAL '1 day' * (60 + (ROW_NUMBER() OVER (ORDER BY m.name)) * 30),
  50 + (ROW_NUMBER() OVER (ORDER BY m.name)) * 25
FROM (SELECT id, name FROM tmp_med WHERE ws_id = 'ws-aleman') m
CROSS JOIN (SELECT id FROM tmp_wh WHERE ws_id = 'ws-aleman' AND type = 'interna') w;

-- Ventas Alemán
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
SELECT 'bat-ale-v-' || LPAD(ROW_NUMBER() OVER (ORDER BY m.name)::text, 2, '0'),
  m.id, w.id,
  'V-2026-' || LPAD(ROW_NUMBER() OVER (ORDER BY m.name)::text, 3, '0'),
  NOW() + INTERVAL '1 day' * (15 + (ROW_NUMBER() OVER (ORDER BY m.name)) * 60),
  30 + (ROW_NUMBER() OVER (ORDER BY m.name)) * 15
FROM (SELECT id, name FROM tmp_med WHERE ws_id = 'ws-aleman' AND sale_enabled = true) m
CROSS JOIN (SELECT id FROM tmp_wh WHERE ws_id = 'ws-aleman' AND type = 'ventas') w;

-- Depósito Central Francisco
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
SELECT 'bat-fco-c-' || LPAD(ROW_NUMBER() OVER (ORDER BY m.name)::text, 2, '0'),
  m.id, w.id,
  'CF-2026-' || LPAD(ROW_NUMBER() OVER (ORDER BY m.name)::text, 3, '0'),
  NOW() + INTERVAL '1 day' * (20 + (ROW_NUMBER() OVER (ORDER BY m.name)) * 50),
  250 + (ROW_NUMBER() OVER (ORDER BY m.name)) * 80
FROM (SELECT id, name FROM tmp_med WHERE ws_id = 'ws-francisco') m
CROSS JOIN (SELECT id FROM tmp_wh WHERE ws_id = 'ws-francisco' AND type = 'central') w;

-- Interna Francisco
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
SELECT 'bat-fco-i-' || LPAD(ROW_NUMBER() OVER (ORDER BY m.name)::text, 2, '0'),
  m.id, w.id,
  'IF-2026-' || LPAD(ROW_NUMBER() OVER (ORDER BY m.name)::text, 3, '0'),
  NOW() + INTERVAL '1 day' * (40 + (ROW_NUMBER() OVER (ORDER BY m.name)) * 35),
  40 + (ROW_NUMBER() OVER (ORDER BY m.name)) * 30
FROM (SELECT id, name FROM tmp_med WHERE ws_id = 'ws-francisco') m
CROSS JOIN (SELECT id FROM tmp_wh WHERE ws_id = 'ws-francisco' AND type = 'interna') w;

-- Ventas Francisco
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
SELECT 'bat-fco-v-' || LPAD(ROW_NUMBER() OVER (ORDER BY m.name)::text, 2, '0'),
  m.id, w.id,
  'VF-2026-' || LPAD(ROW_NUMBER() OVER (ORDER BY m.name)::text, 3, '0'),
  NOW() + INTERVAL '1 day' * (10 + (ROW_NUMBER() OVER (ORDER BY m.name)) * 55),
  20 + (ROW_NUMBER() OVER (ORDER BY m.name)) * 20
FROM (SELECT id, name FROM tmp_med WHERE ws_id = 'ws-francisco' AND sale_enabled = true) m
CROSS JOIN (SELECT id FROM tmp_wh WHERE ws_id = 'ws-francisco' AND type = 'ventas') w;

-- Lotes vencidos y críticos (para dashboard de vencimientos)
INSERT INTO batches (id, medication_id, warehouse_id, lot, expiry, quantity)
SELECT 'bat-exp-' || SUBSTR(md5(random()::text), 1, 8),
  m.id, w.id,
  'EXP-' || SUBSTR(md5(random()::text), 1, 6),
  CASE WHEN random() < 0.3
    THEN NOW() - INTERVAL '1 day' * (1 + (random() * 60)::int)
    ELSE NOW() + INTERVAL '1 day' * (1 + (random() * 25)::int)
  END,
  10 + (random() * 100)::int
FROM tmp_med m
CROSS JOIN tmp_wh w
WHERE w.ws_id = m.ws_id AND w.type = 'interna';

-- ─────────────────────────────────────────────
--  11. MOVEMENTS (historial, IDs text)
-- ─────────────────────────────────────────────
INSERT INTO movements (id, workspace_id, type, medication_id, warehouse_id, quantity, user_name, reason, date)
SELECT 'mov-ing-' || SUBSTR(md5(random()::text), 1, 8),
  m.ws_id, 'ingreso', m.id, w.id, 500 + (random() * 2000)::int,
  CASE WHEN random() < 0.5 THEN 'L. Rosales' ELSE 'Admin Demo' END,
  'Compra OC-' || LPAD((random() * 9999)::int::text, 4, '0'),
  NOW() - INTERVAL '1 day' * (random() * 60)::int
FROM tmp_med m
CROSS JOIN tmp_wh w
WHERE w.ws_id = m.ws_id AND w.type = 'central';

INSERT INTO movements (id, workspace_id, type, medication_id, warehouse_id, quantity, user_name, reason, date)
SELECT 'mov-egr-' || SUBSTR(md5(random()::text), 1, 8),
  m.ws_id,
  CASE floor(random() * 5)
    WHEN 0 THEN 'egreso'::text
    WHEN 1 THEN 'transferencia'::text
    WHEN 2 THEN 'venta'::text
    WHEN 3 THEN 'dispensacion'::text
    ELSE 'ajuste'::text
  END,
  m.id, w.id,
  -(1 + (random() * 50)::int),
  CASE WHEN random() < 0.3 THEN 'M. Pérez'
       WHEN random() < 0.6 THEN 'J. Sosa'
       WHEN random() < 0.8 THEN 'Admin Demo'
       ELSE 'Doctor Demo' END,
  CASE floor(random() * 4)
    WHEN 0 THEN 'Consumo interno'
    WHEN 1 THEN 'Solicitud regular'
    WHEN 2 THEN 'Devolución'
    ELSE 'Ajuste manual' END,
  NOW() - INTERVAL '1 day' * (random() * 45)::int
FROM tmp_med m
CROSS JOIN tmp_wh w
WHERE w.ws_id = m.ws_id AND w.type IN ('interna', 'ventas');

-- ─────────────────────────────────────────────
--  12. TRANSFER REQUESTS (IDs text)
-- ─────────────────────────────────────────────
DO $$
DECLARE
  ws RECORD;
  med RECORD;
  wh_from text;
  wh_to text;
  batch_id text;
  v_statuses text[] := ARRAY['solicitado', 'autorizado', 'despachado', 'recibir', 'recibido', 'aceptado'];
  v_status text;
  v_users text[] := ARRAY['L. Rosales', 'M. Pérez', 'Admin Demo'];
  v_user text;
  v_qty int;
  v_transfer_code text;
  v_counter int;
  v_period text := to_char(NOW(), 'YYYYMM');
  v_idx int;
BEGIN
  FOR ws IN SELECT DISTINCT ws_id FROM tmp_wh LOOP
    INSERT INTO transfer_code_counters (workspace_id, period_yyyymm, last_value)
    VALUES (ws.ws_id, v_period, 0)
    ON CONFLICT (workspace_id, period_yyyymm) DO NOTHING;

    v_counter := 0;
    v_idx := 0;

    FOR med IN
      SELECT id, name FROM tmp_med WHERE ws_id = ws.ws_id
    LOOP
      SELECT id INTO wh_from FROM tmp_wh WHERE ws_id = ws.ws_id AND type = 'central' LIMIT 1;
      SELECT id INTO wh_to FROM tmp_wh
        WHERE ws_id = ws.ws_id AND type IN ('interna', 'ventas')
        ORDER BY random() LIMIT 1;

      SELECT b.id INTO batch_id
      FROM batches b
      WHERE b.medication_id = med.id AND b.warehouse_id = wh_from
      LIMIT 1;

      IF wh_from IS NOT NULL AND wh_to IS NOT NULL AND batch_id IS NOT NULL THEN
        v_idx := v_idx + 1;
        v_counter := v_counter + 1;
        v_transfer_code := v_period || '-' || LPAD(v_counter::text, 5, '0');

        IF v_idx % 3 = 0 THEN
          v_status := 'aceptado';
          v_qty := 10 + (random() * 30)::int;
        ELSIF v_idx % 3 = 1 THEN
          v_status := v_statuses[1 + (random() * 3)::int];
          v_qty := 15 + (random() * 40)::int;
        ELSE
          v_status := v_statuses[1 + (random() * 2)::int];
          v_qty := 20 + (random() * 50)::int;
        END IF;

        v_user := v_users[1 + (random() * 2)::int];

        INSERT INTO transfer_requests
          (id, workspace_id, transfer_code, medication_id, source_batch_id,
           from_warehouse_id, to_warehouse_id, quantity, status, requested_by, date)
        VALUES
          ('trf-' || ws.ws_id || '-' || v_idx, ws.ws_id, v_transfer_code, med.id, batch_id,
           wh_from, wh_to, v_qty, v_status, v_user,
           NOW() - INTERVAL '1 day' * (random() * 14)::int);

        UPDATE transfer_code_counters
        SET last_value = v_counter
        WHERE workspace_id = ws.ws_id AND period_yyyymm = v_period;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────
--  13. SALES (IDs text)
-- ─────────────────────────────────────────────
DO $$
DECLARE
  ws RECORD;
  med RECORD;
  wh_ventas text;
  v_qty int;
  v_price numeric;
  v_cashiers text[] := ARRAY['M. Pérez', 'C. Ruiz', 'Admin Demo', 'R. Díaz', 'V. Ortiz'];
  v_sale_id text;
BEGIN
  FOR ws IN SELECT DISTINCT ws_id FROM tmp_wh LOOP
    SELECT id INTO wh_ventas FROM tmp_wh
      WHERE ws_id = ws.ws_id AND type = 'ventas' LIMIT 1;
    IF wh_ventas IS NULL THEN CONTINUE; END IF;

    FOR med IN
      SELECT m.id, m.name, mt.sale_price
      FROM tmp_med m
      JOIN medications mt ON mt.id = m.id
      WHERE m.ws_id = ws.ws_id AND mt.sale_enabled = true
    LOOP
      FOR i IN 1..(1 + (random() * 2)::int) LOOP
        v_qty := 1 + (random() * 5)::int;
        v_price := med.sale_price * v_qty;
        v_sale_id := 'sale-' || ws.ws_id || '-' || med.id || '-' || i;

        INSERT INTO sales (id, workspace_id, medication_id, warehouse_id, quantity, price, prescription, doctor, cashier, date)
        VALUES (
          v_sale_id, ws.ws_id, med.id, wh_ventas, v_qty, v_price,
          CASE WHEN random() < 0.4 THEN 'RX-' || LPAD((random() * 9999)::int::text, 4, '0') ELSE NULL END,
          CASE WHEN random() < 0.4 THEN
            (ARRAY['Dr. García', 'Dra. Torres', 'Dra. Ríos', 'Dr. Gómez', 'Dr. Mendoza'])[1 + (random() * 4)::int]
          ELSE NULL END,
          v_cashiers[1 + (random() * 4)::int],
          NOW() - INTERVAL '1 day' * (random() * 30)::int - INTERVAL '1 hour' * (random() * 8)::int
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────
--  14. DISPENSATIONS (IDs text)
-- ─────────────────────────────────────────────
DO $$
DECLARE
  ws RECORD;
  med RECORD;
  wh_interna text;
  pat RECORD;
  v_doctors text[] := ARRAY['Dr. García', 'Dra. Torres', 'Dra. Ríos', 'Dr. Gómez', 'Dr. Mendoza'];
  v_treatments text[] := ARRAY[
    'Antibiótico post-quirúrgico', 'Manejo de dolor', 'Antiinflamatorio',
    'Protector gástrico', 'Analgesia', 'Antihipertensivo', 'Broncodilatador',
    'Anticoagulante', 'Hipoglucemiante', 'Sedación'
  ];
  v_disp_id text;
BEGIN
  FOR ws IN SELECT DISTINCT ws_id FROM tmp_wh LOOP
    SELECT id INTO wh_interna FROM tmp_wh
      WHERE ws_id = ws.ws_id AND type = 'interna' LIMIT 1;
    IF wh_interna IS NULL THEN CONTINUE; END IF;

    FOR med IN
      SELECT id, name FROM tmp_med WHERE ws_id = ws.ws_id
    LOOP
      FOR pat IN
        SELECT id, full_name AS name FROM tmp_patient WHERE ws_id = ws.ws_id
        ORDER BY random() LIMIT 3
      LOOP
        v_disp_id := 'disp-' || ws.ws_id || '-' || med.id || '-' || SUBSTR(md5(random()::text), 1, 4);

        INSERT INTO dispensations (id, workspace_id, medication_id, warehouse_id, quantity, doctor, patient, room, treatment, date)
        VALUES (
          v_disp_id, ws.ws_id, med.id, wh_interna,
          1 + (random() * 10)::int,
          v_doctors[1 + (random() * 4)::int],
          pat.name,
          'Sala ' || (100 + (random() * 20)::int),
          v_treatments[1 + (random() * 9)::int],
          NOW() - INTERVAL '1 day' * (random() * 20)::int
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────
--  15. MEDICATION ORDERS (IDs text)
-- ─────────────────────────────────────────────
DO $$
DECLARE
  ws RECORD;
  med RECORD;
  wh_interna text;
  pat RECORD;
  v_doctors text[] := ARRAY['Dr. García', 'Dra. Torres', 'Dra. Ríos', 'Dr. Gómez', 'Dr. Mendoza'];
  v_reasons text[] := ARRAY[
    'Tratamiento antibiótico post-operatorio', 'Control de dolor agudo',
    'Protección gástrica durante tratamiento con AINEs',
    'Hipertensión arterial descompensada', 'Control glucémico',
    'Crisis asmática', 'Analgesia postquirúrgica',
    'Infección urinaria complicada', 'Neumonía bacteriana',
    'Manejo de dolor crónico'
  ];
  v_statuses text[] := ARRAY['pendiente', 'aprobado', 'despachado', 'recibido', 'administrado', 'rechazado'];
  v_users text[] := ARRAY['Admin Demo', 'L. Rosales', 'M. Pérez', 'J. Sosa'];
  v_batch_id text;
  v_order_id text;
BEGIN
  FOR ws IN SELECT DISTINCT ws_id FROM tmp_wh LOOP
    SELECT id INTO wh_interna FROM tmp_wh
      WHERE ws_id = ws.ws_id AND type = 'interna' LIMIT 1;
    IF wh_interna IS NULL THEN CONTINUE; END IF;

    FOR med IN
      SELECT id, name FROM tmp_med WHERE ws_id = ws.ws_id
    LOOP
      SELECT b.id INTO v_batch_id
      FROM batches b
      WHERE b.medication_id = med.id AND b.warehouse_id = wh_interna
      LIMIT 1;

      FOR pat IN
        SELECT id, full_name AS name FROM tmp_patient WHERE ws_id = ws.ws_id
        ORDER BY random() LIMIT 2
      LOOP
        v_order_id := 'ord-' || ws.ws_id || '-' || med.id || '-' || SUBSTR(md5(random()::text), 1, 4);

        INSERT INTO medication_orders
          (id, workspace_id, medication_id, source_batch_id, warehouse_id,
           quantity, doctor, patient, room, reason, status,
           requested_at, processed_at, processed_by)
        VALUES (
          v_order_id, ws.ws_id, med.id, v_batch_id, wh_interna,
          5 + (random() * 30)::int,
          v_doctors[1 + (random() * 4)::int],
          pat.name,
          'Sala ' || (1 + (random() * 15)::int),
          v_reasons[1 + (random() * 9)::int],
          v_statuses[1 + (random() * 4)::int],
          NOW() - INTERVAL '1 day' * (5 + (random() * 15)::int),
          CASE WHEN random() < 0.6 THEN NOW() - INTERVAL '1 day' * (random() * 10)::int ELSE NULL END,
          CASE WHEN random() < 0.6 THEN v_users[1 + (random() * 3)::int] ELSE NULL END
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────
--  16. AUDIT LOG (IDs text)
-- ─────────────────────────────────────────────
DO $$
DECLARE
  ws RECORD;
  v_actions text[] := ARRAY[
    'Ingreso de mercadería', 'Venta registrada', 'Dispensación',
    'Transferencia solicitada', 'Transferencia autorizada',
    'Transferencia despachada', 'Transferencia recibida',
    'Transferencia aceptada', 'Alta de medicamento',
    'Modificación de medicamento', 'Alta de paciente',
    'Internación registrada', 'Alta de usuario',
    'Pedido médico creado', 'Pedido médico aprobado',
    'Pedido médico rechazado', 'Pedido médico dispensado',
    'Ajuste de stock', 'Alta de depósito',
    'Inicio de sesión'
  ];
  v_entities text[] := ARRAY[
    'Paracetamol 500mg', 'Ibuprofeno 400mg', 'Amoxicilina 875mg',
    'Omeprazol 20mg', 'Lote C-2026-001', 'Lote C-2026-002',
    'Transferencia T-2026-00001', 'Transferencia T-2026-00002',
    'Venta #4521', 'Venta #4522', 'Paciente López, Carlos',
    'Paciente Ramírez, Ana', 'Usuario Admin Demo',
    'Depósito Central', 'Depósito Farmacia Interna',
    'Pedido médico ord-001', 'Pedido médico ord-002',
    'Ajuste de stock - inventario', 'Acta de recepción OC-1042'
  ];
  v_users_per_ws text[];
BEGIN
  FOR ws IN SELECT DISTINCT ws_id FROM tmp_wh LOOP
    SELECT ARRAY_AGG(DISTINCT name) INTO v_users_per_ws
    FROM tmp_user WHERE ws_id = ws.ws_id;

    FOR i IN 1..40 LOOP
      INSERT INTO audit_log (id, workspace_id, user_name, action, entity, date)
      VALUES (
        'aud-' || ws.ws_id || '-' || LPAD(i::text, 3, '0'),
        ws.ws_id,
        v_users_per_ws[1 + floor(random() * array_length(v_users_per_ws, 1))::int],
        v_actions[1 + floor(random() * array_length(v_actions, 1))::int],
        v_entities[1 + floor(random() * array_length(v_entities, 1))::int],
        NOW() - INTERVAL '1 day' * (random() * 30)::int - INTERVAL '1 hour' * (random() * 12)::int
      );
    END LOOP;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────
--  17. LIMPIEZA de tablas temporales
-- ─────────────────────────────────────────────
DROP TABLE IF EXISTS tmp_wh;
DROP TABLE IF EXISTS tmp_user;
DROP TABLE IF EXISTS tmp_med;
DROP TABLE IF EXISTS tmp_wing;
DROP TABLE IF EXISTS tmp_room;
DROP TABLE IF EXISTS tmp_patient;

-- ============================================================
--  FIN — Emails de login:
--  hospitalalemanadmin@user.com    → Admin Alemán
--  hospitalalemanventas@user.com   → María Pérez
--  hospitalalemandactor@user.com   → Doctor García
--  hospitalalemanntecnico@user.com → Enf. Sosa
--  hospitalfranciscoadmin@user.com → Admin Francisco
--  hospitalfranciscoventas@user.com→ Carlos Ruiz
--  hospitalfranciscodoctor@user.com→ Doctor Mendoza
--  hospitalfranciscotecnico@user.com→ Enf. Vega
-- ============================================================
