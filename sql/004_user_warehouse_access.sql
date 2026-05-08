-- Accesos por usuario a depósitos.
-- Seguro para re-ejecutar y compatible con entornos donde workspace_users.id
-- pueda ser uuid o text.

do $$
declare
  user_id_type text;
  warehouse_id_type text;
begin
  select data_type
  into user_id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'workspace_users'
    and column_name = 'id';

  if user_id_type is null then
    raise exception 'No se encontró public.workspace_users.id';
  end if;

  select data_type
  into warehouse_id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'warehouses'
    and column_name = 'id';

  if warehouse_id_type is null then
    raise exception 'No se encontró public.warehouses.id';
  end if;

  execute format(
    $sql$
      create table if not exists workspace_user_warehouses (
        user_id %s not null references workspace_users(id) on delete cascade,
        warehouse_id %s not null references warehouses(id) on delete cascade,
        created_at timestamptz not null default now(),
        primary key (user_id, warehouse_id)
      );
    $sql$,
    case when user_id_type = 'uuid' then 'uuid' else 'text' end,
    case when warehouse_id_type = 'uuid' then 'uuid' else 'text' end
  );
end
$$;

create index if not exists idx_user_warehouse_user on workspace_user_warehouses(user_id);
create index if not exists idx_user_warehouse_warehouse on workspace_user_warehouses(warehouse_id);

-- Backfill inicial: asigna todos los depósitos del workspace a todos sus usuarios.
insert into workspace_user_warehouses (user_id, warehouse_id)
select u.id, w.id
from workspace_users u
join warehouses w on w.workspace_id = u.workspace_id
where not exists (
  select 1
  from workspace_user_warehouses x
  where x.user_id = u.id
    and x.warehouse_id = w.id
);
