-- Código amigable para transferencias: YYYYMM-00001
-- Seguro para re-ejecutar.

alter table transfer_requests
  add column if not exists transfer_code text;

create unique index if not exists idx_transfer_requests_workspace_code
  on transfer_requests(workspace_id, transfer_code)
  where transfer_code is not null;

create table if not exists transfer_code_counters (
  workspace_id text not null references workspaces(id) on delete cascade,
  period_yyyymm text not null,
  last_value integer not null default 0,
  primary key (workspace_id, period_yyyymm)
);

create or replace function next_transfer_code(
  p_workspace_id text,
  p_now timestamptz default now()
)
returns text
language plpgsql
as $$
declare
  v_period text := to_char(p_now, 'YYYYMM');
  v_next integer;
begin
  insert into transfer_code_counters (workspace_id, period_yyyymm, last_value)
  values (p_workspace_id, v_period, 1)
  on conflict (workspace_id, period_yyyymm)
  do update set last_value = transfer_code_counters.last_value + 1
  returning last_value into v_next;

  return v_period || '-' || lpad(v_next::text, 5, '0');
end;
$$;

with numbered as (
  select
    id,
    workspace_id,
    to_char(coalesce(date, now()), 'YYYYMM') as period_yyyymm,
    row_number() over (
      partition by workspace_id, to_char(coalesce(date, now()), 'YYYYMM')
      order by coalesce(date, now()) asc, id asc
    ) as seq
  from transfer_requests
  where transfer_code is null
    and workspace_id is not null
)
update transfer_requests tr
set transfer_code = numbered.period_yyyymm || '-' || lpad(numbered.seq::text, 5, '0')
from numbered
where tr.id = numbered.id;

insert into transfer_code_counters (workspace_id, period_yyyymm, last_value)
select workspace_id, period_yyyymm, max(seq)
from (
  select
    workspace_id,
    split_part(transfer_code, '-', 1) as period_yyyymm,
    split_part(transfer_code, '-', 2)::integer as seq
  from transfer_requests
  where transfer_code is not null
    and workspace_id is not null
) t
group by workspace_id, period_yyyymm
on conflict (workspace_id, period_yyyymm)
do update set last_value = greatest(transfer_code_counters.last_value, excluded.last_value);
