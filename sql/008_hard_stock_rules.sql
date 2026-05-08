-- Reglas duras de stock y transferencias.
-- Seguro para re-ejecutar.

-- 1) Autocorrección legacy: un solo depósito central por workspace.
with ranked_centrals as (
  select
    id,
    workspace_id,
    row_number() over (
      partition by workspace_id
      order by id asc
    ) as rn
  from warehouses
  where type = 'central'
)
update warehouses w
set type = 'interna'
from ranked_centrals rc
where w.id = rc.id
  and rc.rn > 1;

-- 2) Unicidad parcial de central por workspace.
create unique index if not exists idx_warehouses_one_central_per_workspace
  on warehouses(workspace_id)
  where type = 'central';

-- 3) Ajuste de estados de transferencias para etapa post-recepción.
do $$
declare
  constraint_name text;
begin
  select conname
  into constraint_name
  from pg_constraint
  where conrelid = 'public.transfer_requests'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';

  if constraint_name is not null then
    execute format('alter table transfer_requests drop constraint %I', constraint_name);
  end if;
end
$$;

alter table transfer_requests
  add constraint transfer_requests_status_check
  check (status in ('solicitado', 'autorizado', 'despachado', 'recibir', 'recibido', 'aceptado', 'rechazado'));

-- 4) Normalización legacy:
--    - registros ya "recibidos" se consideran aceptados (flujo previo).
update transfer_requests
set status = 'aceptado'
where status = 'recibido';
