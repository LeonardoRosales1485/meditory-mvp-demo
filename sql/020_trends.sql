-- Tendencias de consumo: proyección de días hasta agotar stock por medicamento
-- Depende de las tablas: movements, batches, medications

create or replace function get_consumption_trends(
  p_period_days int default 30,
  p_workspace_id text default null
)
returns table (
  medication_id text,
  medication_name text,
  stock_total bigint,
  consumed_per_day numeric,
  days_until_empty numeric,
  risk_category text
)
language plpgsql
as $$
begin
  return query
  with consumption as (
    select
      m.medication_id::text as med_id,
      abs(sum(m.quantity))::numeric / p_period_days as daily_rate
    from movements m
    where m.quantity < 0
      and m.date >= now() - (p_period_days || ' days')::interval
      and (p_workspace_id is null or m.workspace_id = p_workspace_id)
    group by m.medication_id
  ),
  stock as (
    select
      b.medication_id::text as med_id,
      coalesce(sum(b.quantity), 0)::bigint as total
    from batches b
    where (p_workspace_id is null or exists (
      select 1 from warehouses w
      where w.id = b.warehouse_id and w.workspace_id = p_workspace_id
    ))
    group by b.medication_id
  ),
  meds as (
    select m.id::text as med_id, m.name as med_name
    from medications m
    where (p_workspace_id is null or m.workspace_id = p_workspace_id)
      and m.deleted_at is null
  )
  select
    m.med_id,
    m.med_name,
    coalesce(s.total, 0) as stock_total,
    round(coalesce(c.daily_rate, 0), 2) as consumed_per_day,
    case
      when coalesce(c.daily_rate, 0) <= 0 then null::numeric
      else round(coalesce(s.total, 0)::numeric / c.daily_rate, 1)
    end as days_until_empty,
    case
      when coalesce(s.total, 0) = 0 then 'sin_stock'
      when coalesce(c.daily_rate, 0) <= 0 then 'sin_consumo'
      when coalesce(s.total, 0)::numeric / c.daily_rate < 30 then 'critico'
      when coalesce(s.total, 0)::numeric / c.daily_rate < 60 then 'bajo'
      when coalesce(s.total, 0)::numeric / c.daily_rate <= 120 then 'optimo'
      else 'superavit'
    end as risk_category
  from meds m
  left join consumption c on c.med_id = m.med_id
  left join stock s on s.med_id = m.med_id
  where coalesce(c.daily_rate, 0) > 0 or coalesce(s.total, 0) > 0
  order by
    case
      when coalesce(s.total, 0) = 0 then 0
      when coalesce(c.daily_rate, 0) <= 0 then 4
      when coalesce(s.total, 0)::numeric / c.daily_rate < 30 then 1
      when coalesce(s.total, 0)::numeric / c.daily_rate < 60 then 2
      when coalesce(s.total, 0)::numeric / c.daily_rate <= 120 then 3
      else 5
    end,
    days_until_empty asc nulls last;
end;
$$;
