-- Amplía estados del flujo de pedidos médicos.
-- Seguro para re-ejecutar.

do $$
declare
  constraint_name text;
begin
  select conname
  into constraint_name
  from pg_constraint
  where conrelid = 'public.medication_orders'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';

  if constraint_name is not null then
    execute format('alter table medication_orders drop constraint %I', constraint_name);
  end if;

  -- Normaliza estados legacy para que cumplan el nuevo check.
  -- "dispensado" pasa a "despachado" para mantener continuidad del flujo.
  update medication_orders
  set status = 'despachado'
  where status = 'dispensado';
end
$$;

alter table medication_orders
  add constraint medication_orders_status_check
  check (
    status in (
      'pendiente',
      'aprobado',
      'despachado',
      'recibir',
      'recibido',
      'administrado',
      'rechazado',
      'devolucion_solicitada',
      'devuelto',
      'devolucion_rechazada'
    )
  );
