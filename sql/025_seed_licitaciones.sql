-- ============================================================
--  MEDITORY — Seed 025: Datos de ejemplo para Licitaciones
--  Ejecutar DESPUÉS de 024_licitaciones.sql
--  Es idempotente: usa ON CONFLICT y verificación previa.
-- ============================================================

-- ─────────────────────────────────────────────
--  1. PROVEEDORES
-- ─────────────────────────────────────────────
INSERT INTO proveedores (id, nombre, contacto, telefono, email, cuit, direccion) VALUES
  (gen_random_uuid(), 'Pharmaline S.A.',           'Lucía Fernández', '011-4567-8901', 'compras@pharmaline.com.ar', '30-71234567-8', 'Av. Corrientes 2345, CABA'),
  (gen_random_uuid(), 'Medifar Argentina',         'Carlos Gómez',    '011-4789-0123', 'ventas@medifar.com.ar',    '30-72345678-9', 'Calle Florida 567, CABA'),
  (gen_random_uuid(), 'Droguería del Sur',         'Ana Martínez',    '0221-456-7890', 'admin@delsur.com.ar',      '30-73456789-0', 'Calle 7 N° 890, La Plata'),
  (gen_random_uuid(), 'Rossi Hnos.',               'Pedro Rossi',     '0341-567-8901', 'pedro@rossihnos.com',      '30-74567890-1', 'Av. Pellegrini 1234, Rosario'),
  (gen_random_uuid(), 'Farmacéutica Córdoba SRL',  'María Torres',    '0351-678-9012', 'ventas@farmacordoba.com',  '30-75678901-2', 'Av. Colón 3456, Córdoba')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
--  2. LICITACIONES
-- ─────────────────────────────────────────────
WITH inserted_lics AS (
  INSERT INTO licitaciones (id, codigo, titulo, descripcion, estado, creado_por, fecha_limite_ofertas)
  SELECT ids.id, ids.codigo, ids.titulo, ids.descripcion, ids.estado, ids.creado_por, ids.fecha_limite
  FROM (VALUES
    (gen_random_uuid(), 'LIC-0001', 'Compra de Analgésicos y Antiinflamatorios',
     'Abastecimiento de Paracetamol 500mg, Ibuprofeno 400mg y Diclofenac 75mg para Hospital Alemán',
     'en_licitacion'::licitacion_estado, 'Admin Demo', NOW() + INTERVAL '15 days'),
    (gen_random_uuid(), 'LIC-0002', 'Antibióticos para Hospital Francisco',
     'Cobertura de Amoxicilina 875mg y Diclofenac 75mg inyectable',
     'borrador'::licitacion_estado, 'Admin Demo', NULL::timestamptz),
    (gen_random_uuid(), 'LIC-0003', 'Antidiabéticos',
     'Adquisición de Metformina 850mg para Hospital Alemán y Francisco',
     'ofertas_recibidas'::licitacion_estado, 'Admin Demo', NOW() - INTERVAL '2 days'),
    (gen_random_uuid(), 'LIC-0004', 'Analgésicos para Hospital Blanco',
     'Compra de Paracetamol 500mg e Ibuprofeno 400mg',
     'adjudicado'::licitacion_estado, 'Admin Demo', NOW() - INTERVAL '5 days')
  ) AS ids(id, codigo, titulo, descripcion, estado, creado_por, fecha_limite)
  ON CONFLICT (id) DO NOTHING
  RETURNING id, codigo
)
-- ─────────────────────────────────────────────
--  3. ITEMS (por código de licitación)
-- ─────────────────────────────────────────────
, lic_map AS (
  SELECT id, codigo FROM licitaciones WHERE codigo IN ('LIC-0001','LIC-0002','LIC-0003','LIC-0004')
)
INSERT INTO licitacion_items (id, licitacion_id, medication_id, workspace_id, cantidad_solicitada, precio_unitario_estimado, justificacion)
SELECT gen_random_uuid(), lic_map.id, items.*
FROM lic_map
CROSS JOIN LATERAL (VALUES
  ('m1', 'ws-aleman', 5000, 750,   'Stock bajo: actual 800, mínimo 2000'),
  ('m2', 'ws-aleman', 3000, 1000,  'Stock bajo: actual 600, mínimo 1500'),
  ('m8', 'ws-aleman', 1500, 1500,  'Stock bajo: actual 60, mínimo 500')
) AS items(medication_id, workspace_id, cantidad_solicitada, precio_unitario_estimado, justificacion)
WHERE lic_map.codigo = 'LIC-0001'
UNION ALL
SELECT gen_random_uuid(), lic_map.id, items.*
FROM lic_map
CROSS JOIN LATERAL (VALUES
  ('f3', 'ws-francisco', 2000, 2200, 'Cobertura semestral'),
  ('f8', 'ws-francisco', 500,  4000, 'Cobertura trimestral')
) AS items(medication_id, workspace_id, cantidad_solicitada, precio_unitario_estimado, justificacion)
WHERE lic_map.codigo = 'LIC-0002'
UNION ALL
SELECT gen_random_uuid(), lic_map.id, items.*
FROM lic_map
CROSS JOIN LATERAL (VALUES
  ('m7', 'ws-aleman', 4000, 800,  'Reposición de stock'),
  ('f7', 'ws-francisco', 2000, 850, 'Reposición trimestral')
) AS items(medication_id, workspace_id, cantidad_solicitada, precio_unitario_estimado, justificacion)
WHERE lic_map.codigo = 'LIC-0003'
UNION ALL
SELECT gen_random_uuid(), lic_map.id, items.*
FROM lic_map
CROSS JOIN LATERAL (VALUES
  ('m1', 'ws-aleman', 2000, 800,  'Abastecimiento cruzado'),
  ('m2', 'ws-aleman', 1000, 1100, 'Abastecimiento cruzado')
) AS items(medication_id, workspace_id, cantidad_solicitada, precio_unitario_estimado, justificacion)
WHERE lic_map.codigo = 'LIC-0004'
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
--  4. OFERTAS
-- ─────────────────────────────────────────────
WITH prov_map AS (
  SELECT id, nombre FROM proveedores WHERE nombre IN ('Pharmaline S.A.','Medifar Argentina','Droguería del Sur','Rossi Hnos.','Farmacéutica Córdoba SRL')
), lic_map AS (
  SELECT id, codigo FROM licitaciones WHERE codigo IN ('LIC-0001','LIC-0003','LIC-0004')
)
INSERT INTO licitacion_ofertas (id, licitacion_id, proveedor_id, monto_total, plazo_entrega_dias, observaciones, adjudicado)
SELECT gen_random_uuid(), lic_map.id, prov_map.id, ofertas.*
FROM lic_map
JOIN prov_map ON TRUE
CROSS JOIN LATERAL (VALUES
  (8750000, 15, 'Entrega en 2 cuotas',             false)
) AS ofertas(monto_total, plazo_entrega_dias, observaciones, adjudicado)
WHERE lic_map.codigo = 'LIC-0001' AND prov_map.nombre = 'Pharmaline S.A.'
UNION ALL
SELECT gen_random_uuid(), lic_map.id, prov_map.id, ofertas.*
FROM lic_map
JOIN prov_map ON TRUE
CROSS JOIN LATERAL (VALUES
  (8200000, 20, 'Incluye flete',                   false)
) AS ofertas(monto_total, plazo_entrega_dias, observaciones, adjudicado)
WHERE lic_map.codigo = 'LIC-0001' AND prov_map.nombre = 'Medifar Argentina'
UNION ALL
SELECT gen_random_uuid(), lic_map.id, prov_map.id, ofertas.*
FROM lic_map
JOIN prov_map ON TRUE
CROSS JOIN LATERAL (VALUES
  (9100000, 10, 'Entrega urgente',                 false)
) AS ofertas(monto_total, plazo_entrega_dias, observaciones, adjudicado)
WHERE lic_map.codigo = 'LIC-0001' AND prov_map.nombre = 'Rossi Hnos.'
UNION ALL
SELECT gen_random_uuid(), lic_map.id, prov_map.id, ofertas.*
FROM lic_map
JOIN prov_map ON TRUE
CROSS JOIN LATERAL (VALUES
  (4100000, 14, 'Precio especial por volumen',      false)
) AS ofertas(monto_total, plazo_entrega_dias, observaciones, adjudicado)
WHERE lic_map.codigo = 'LIC-0003' AND prov_map.nombre = 'Medifar Argentina'
UNION ALL
SELECT gen_random_uuid(), lic_map.id, prov_map.id, ofertas.*
FROM lic_map
JOIN prov_map ON TRUE
CROSS JOIN LATERAL (VALUES
  (3950000, 21, 'Incluye capacitación',             false)
) AS ofertas(monto_total, plazo_entrega_dias, observaciones, adjudicado)
WHERE lic_map.codigo = 'LIC-0003' AND prov_map.nombre = 'Farmacéutica Córdoba SRL'
UNION ALL
SELECT gen_random_uuid(), lic_map.id, prov_map.id, ofertas.*
FROM lic_map
JOIN prov_map ON TRUE
CROSS JOIN LATERAL (VALUES
  (3200000,  7, 'Entrega inmediata',                true)
) AS ofertas(monto_total, plazo_entrega_dias, observaciones, adjudicado)
WHERE lic_map.codigo = 'LIC-0004' AND prov_map.nombre = 'Droguería del Sur'
UNION ALL
SELECT gen_random_uuid(), lic_map.id, prov_map.id, ofertas.*
FROM lic_map
JOIN prov_map ON TRUE
CROSS JOIN LATERAL (VALUES
  (3500000, 10, '',                                  false)
) AS ofertas(monto_total, plazo_entrega_dias, observaciones, adjudicado)
WHERE lic_map.codigo = 'LIC-0004' AND prov_map.nombre = 'Pharmaline S.A.'
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
--  5. HISTORIAL
-- ─────────────────────────────────────────────
WITH lic_map AS (
  SELECT id, codigo FROM licitaciones WHERE codigo IN ('LIC-0001','LIC-0002','LIC-0003','LIC-0004')
)
INSERT INTO licitacion_historial (id, licitacion_id, estado_anterior, estado_nuevo, fecha_cambio, usuario, comentario)
SELECT gen_random_uuid(), lic_map.id, hist.*
FROM lic_map
CROSS JOIN LATERAL (VALUES
  (NULL::licitacion_estado, 'borrador'::licitacion_estado,       NOW() - INTERVAL '10 days', 'Admin Demo', 'Creación de licitación'),
  ('borrador'::licitacion_estado, 'en_licitacion'::licitacion_estado, NOW() - INTERVAL '8 days', 'Admin Demo', 'Publicación para recepción de ofertas')
) AS hist(estado_anterior, estado_nuevo, fecha_cambio, usuario, comentario)
WHERE lic_map.codigo = 'LIC-0001'
UNION ALL
SELECT gen_random_uuid(), lic_map.id, hist.*
FROM lic_map
CROSS JOIN LATERAL (VALUES
  (NULL::licitacion_estado, 'borrador'::licitacion_estado,       NOW() - INTERVAL '7 days', 'Admin Demo', 'Creación de licitación')
) AS hist(estado_anterior, estado_nuevo, fecha_cambio, usuario, comentario)
WHERE lic_map.codigo = 'LIC-0002'
UNION ALL
SELECT gen_random_uuid(), lic_map.id, hist.*
FROM lic_map
CROSS JOIN LATERAL (VALUES
  (NULL::licitacion_estado, 'borrador'::licitacion_estado,             NOW() - INTERVAL '6 days', 'Admin Demo', 'Creación de licitación'),
  ('borrador'::licitacion_estado, 'en_licitacion'::licitacion_estado, NOW() - INTERVAL '5 days', 'Admin Demo', 'Publicación'),
  ('en_licitacion'::licitacion_estado, 'ofertas_recibidas'::licitacion_estado, NOW() - INTERVAL '3 days', 'Admin Demo', 'Cierre de recepción de ofertas')
) AS hist(estado_anterior, estado_nuevo, fecha_cambio, usuario, comentario)
WHERE lic_map.codigo = 'LIC-0003'
UNION ALL
SELECT gen_random_uuid(), lic_map.id, hist.*
FROM lic_map
CROSS JOIN LATERAL (VALUES
  (NULL::licitacion_estado, 'borrador'::licitacion_estado,                NOW() - INTERVAL '10 days', 'Admin Demo', 'Creación de licitación'),
  ('borrador'::licitacion_estado, 'en_licitacion'::licitacion_estado,    NOW() - INTERVAL '8 days', 'Admin Demo', 'Publicación'),
  ('en_licitacion'::licitacion_estado, 'ofertas_recibidas'::licitacion_estado, NOW() - INTERVAL '6 days', 'Admin Demo', 'Cierre de recepción'),
  ('ofertas_recibidas'::licitacion_estado, 'adjudicado'::licitacion_estado,   NOW() - INTERVAL '4 days', 'Admin Demo', 'Adjudicado a Droguería del Sur')
) AS hist(estado_anterior, estado_nuevo, fecha_cambio, usuario, comentario)
WHERE lic_map.codigo = 'LIC-0004'
ON CONFLICT (id) DO NOTHING;
