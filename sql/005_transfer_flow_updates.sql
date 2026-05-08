-- Amplia estados del flujo de transferencias para incluir:
-- recibir y rechazado.
-- Seguro para re-ejecutar.

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
  check (status in ('solicitado', 'autorizado', 'despachado', 'recibir', 'recibido', 'rechazado'));
