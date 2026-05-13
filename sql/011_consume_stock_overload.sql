-- Tras 011 original solo quedaba consume_stock(uuid,...): los datos demo (p. ej. medication_id "m3")
-- no son UUID → "invalid input syntax for type uuid".
-- Dejamos UNA función con parámetros text y comparación ::text (válido con columnas uuid o text).

drop function if exists public.consume_stock(uuid, uuid, integer);
drop function if exists public.consume_stock(text, text, integer);

create or replace function public.consume_stock(
  p_medication_id text,
  p_warehouse_id text,
  p_quantity integer
)
returns void
language plpgsql
as $$
declare
  remaining integer := p_quantity;
  row_record record;
  take_qty integer;
begin
  if p_quantity <= 0 then
    raise exception 'Quantity must be > 0';
  end if;

  for row_record in
    select id, quantity
    from batches
    where medication_id::text = p_medication_id
      and warehouse_id::text = p_warehouse_id
      and quantity > 0
    order by expiry asc, id asc
    for update
  loop
    exit when remaining <= 0;
    take_qty := least(row_record.quantity, remaining);
    update batches
    set quantity = quantity - take_qty
    where id = row_record.id;
    remaining := remaining - take_qty;
  end loop;

  if remaining > 0 then
    raise exception 'Stock insuficiente';
  end if;
end;
$$;
