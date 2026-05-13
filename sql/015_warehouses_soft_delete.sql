-- Baja lógica de depósitos: la fila permanece para trazabilidad y FKs.
-- Seguro para re-ejecutar.

-- 1) Columna de baja
alter table warehouses add column if not exists deleted_at timestamptz null;

-- 2) Quitar unicidades que impedirían reutilizar nombre tras baja lógica
do $$
declare
  cname text;
begin
  for cname in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'warehouses'
      and rel.relnamespace = (select oid from pg_namespace where nspname = 'public')
      and con.contype = 'u'
  loop
    execute format('alter table warehouses drop constraint %I', cname);
  end loop;
end
$$;

create unique index if not exists idx_warehouses_unique_name_type_active
  on warehouses (workspace_id, name, type)
  where deleted_at is null;

-- 3) Un solo central activo por workspace (recrear índice con deleted_at)
drop index if exists idx_warehouses_one_central_per_workspace;

create unique index if not exists idx_warehouses_one_central_per_workspace
  on warehouses (workspace_id)
  where type = 'central' and deleted_at is null;
