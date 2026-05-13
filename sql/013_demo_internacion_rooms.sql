-- =============================================================================
-- Demo: alas, 100 salas (50 por hospital) y asignación de pacientes dummy
-- Requiere: 001_schema, 002_seed (workspaces ws-francisco, ws-aleman), 012_wings_rooms_beds
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Cinco alas por workspace (una por tipo). Idempotente por (workspace_id, prefix).
--    Si ya usás prefix 1–5 en esos workspaces, cambiá los prefix en este bloque (1–9).
-- -----------------------------------------------------------------------------
insert into wings (workspace_id, name, type, prefix)
select v.workspace_id, v.name, v.type::text, v.prefix::smallint
from (
  values
    ('ws-francisco', 'SAT Francisco — Urgencias', 'urgencias', 1),
    ('ws-francisco', 'SAT Francisco — Quirófanos', 'quirofanos', 2),
    ('ws-francisco', 'SAT Francisco — UCI', 'cuidados_intensivos', 3),
    ('ws-francisco', 'SAT Francisco — Hospitalización', 'hospitalizacion', 4),
    ('ws-francisco', 'SAT Francisco — Ambulatoria', 'ambulatoria', 5),
    ('ws-aleman', 'SAT Alemán — Urgencias', 'urgencias', 1),
    ('ws-aleman', 'SAT Alemán — Quirófanos', 'quirofanos', 2),
    ('ws-aleman', 'SAT Alemán — UCI', 'cuidados_intensivos', 3),
    ('ws-aleman', 'SAT Alemán — Hospitalización', 'hospitalizacion', 4),
    ('ws-aleman', 'SAT Alemán — Ambulatoria', 'ambulatoria', 5)
) as v(workspace_id, name, type, prefix)
where not exists (
  select 1 from wings w
  where w.workspace_id = v.workspace_id
    and w.prefix = v.prefix::smallint
);

-- -----------------------------------------------------------------------------
-- 2) 10 salas por cada ala SAT de Francisco y Alemán (= 50 + 50 = 100 salas).
--    bed_count entre 1 y 4 según número de sala. Trigger crea filas en beds.
-- -----------------------------------------------------------------------------
insert into rooms (workspace_id, wing_id, number, bed_count)
select w.workspace_id, w.id, k.n::smallint, (1 + ((k.n + w.prefix) % 4))::smallint
from wings w
cross join generate_series(1, 10) as k(n)
where w.workspace_id in ('ws-francisco', 'ws-aleman')
  and (
    w.name like 'SAT Francisco — %'
    or w.name like 'SAT Alemán — %'
  )
  and not exists (
    select 1 from rooms r
    where r.wing_id = w.id
      and r.number = k.n::smallint
  );

-- =============================================================================
-- B1) Asignación canónica: camas libres ↔ pacientes sin cama (mismo workspace).
--     Sincroniza patients.room con full_number (como assignBed en la app).
-- =============================================================================
with ranked_beds as (
  select
    b.id as bed_id,
    r.workspace_id,
    row_number() over (
      partition by r.workspace_id
      order by random()
    ) as rn
  from beds b
  join rooms r on r.id = b.room_id
  where b.patient_id is null
    and r.workspace_id in ('ws-francisco', 'ws-aleman')
),
ranked_patients as (
  select
    p.id as patient_id,
    p.workspace_id,
    row_number() over (
      partition by p.workspace_id
      order by random()
    ) as rn
  from patients p
  where p.workspace_id in ('ws-francisco', 'ws-aleman')
    and not exists (select 1 from beds b where b.patient_id = p.id)
)
update beds b
set patient_id = rp.patient_id
from ranked_beds rb
join ranked_patients rp
  on rp.workspace_id = rb.workspace_id
 and rp.rn = rb.rn
where b.id = rb.bed_id;

update patients p
set room = r.full_number::text
from beds b
join rooms r on r.id = b.room_id
where b.patient_id = p.id
  and p.workspace_id in ('ws-francisco', 'ws-aleman');

-- =============================================================================
-- B2) Solo override de demo en patients.room (sin tocar beds).
--     Útil si ya cargaste dummies y no querés pasar por B1.
--     Descomentá SOLO este bloque si querés reemplazar room al azar sin camas.
-- =============================================================================
/*
update patients p
set room = sub.fn::text
from (
  select
    p2.id,
    (array_agg(r.full_number order by random()))[1] as fn
  from patients p2
  join rooms r on r.workspace_id = p2.workspace_id
  where p2.workspace_id in ('ws-francisco', 'ws-aleman')
  group by p2.id
) sub
where p.id = sub.id;
*/

-- Nota: si ejecutás B2, la UI mostrará "Internado" por room no vacío pero sin cama
-- en sistema hasta que uses "Registrar internación" o B1. Para datos coherentes preferí B1.
