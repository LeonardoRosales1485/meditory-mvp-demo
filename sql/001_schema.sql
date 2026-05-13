create extension if not exists "pgcrypto";

create table if not exists workspaces (
  id text primary key,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists workspace_users (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references workspaces(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'ventas', 'doctor', 'tecnico')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references workspaces(id) on delete cascade,
  name text not null,
  type text not null check (type in ('central', 'interna', 'ventas')),
  unit text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists workspace_user_warehouses (
  user_id uuid not null references workspace_users(id) on delete cascade,
  warehouse_id uuid not null references warehouses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, warehouse_id)
);

create table if not exists medications (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references workspaces(id) on delete cascade,
  name text not null,
  active_ingredient text not null,
  concentration_value numeric(12,3) not null check (concentration_value > 0),
  concentration_unit text not null check (concentration_unit in ('mg', 'mcg', 'ml', 'L', 'g', 'unidad')),
  form text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null,
  sale_enabled boolean not null default true
);

create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references medications(id) on delete restrict,
  warehouse_id uuid not null references warehouses(id) on delete restrict,
  lot text not null,
  expiry date not null,
  quantity integer not null check (quantity >= 0),
  created_at timestamptz not null default now(),
  unique (warehouse_id, medication_id, lot)
);

create table if not exists movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references workspaces(id) on delete cascade,
  type text not null check (type in ('ingreso', 'egreso', 'transferencia', 'venta', 'dispensacion', 'ajuste')),
  medication_id uuid not null references medications(id) on delete restrict,
  warehouse_id uuid not null references warehouses(id) on delete restrict,
  quantity integer not null check (quantity <> 0),
  user_name text not null,
  reason text not null default '',
  lot text,
  date timestamptz not null default now()
);

create table if not exists transfer_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references workspaces(id) on delete cascade,
  transfer_code text,
  medication_id uuid not null references medications(id) on delete restrict,
  source_batch_id text,
  from_warehouse_id uuid not null references warehouses(id) on delete restrict,
  to_warehouse_id uuid not null references warehouses(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null check (status in ('solicitado', 'autorizado', 'despachado', 'recibir', 'recibido', 'aceptado', 'rechazado')),
  requested_by text not null,
  date timestamptz not null default now(),
  check (from_warehouse_id <> to_warehouse_id)
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references workspaces(id) on delete cascade,
  medication_id uuid not null references medications(id) on delete restrict,
  warehouse_id uuid not null references warehouses(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  price numeric(12,2) not null check (price >= 0),
  prescription text,
  doctor text,
  cashier text not null,
  date timestamptz not null default now()
);

create table if not exists dispensations (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references workspaces(id) on delete cascade,
  medication_id uuid not null references medications(id) on delete restrict,
  warehouse_id uuid not null references warehouses(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  doctor text not null,
  patient text not null,
  room text not null,
  treatment text not null,
  date timestamptz not null default now()
);

create table if not exists medication_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references workspaces(id) on delete cascade,
  medication_id uuid not null references medications(id) on delete restrict,
  source_batch_id text,
  warehouse_id uuid not null references warehouses(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  doctor text not null,
  patient text not null,
  room text not null,
  reason text not null,
  status text not null check (status in ('pendiente', 'aprobado', 'despachado', 'recibir', 'recibido', 'administrado', 'rechazado', 'devolucion_solicitada', 'devuelto', 'devolucion_rechazada')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by text
);

create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references workspaces(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  insurance text not null,
  diagnosis text not null,
  assigned_doctor text not null,
  room text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references workspaces(id) on delete cascade,
  user_name text not null,
  action text not null,
  entity text not null,
  date timestamptz not null default now()
);

alter table workspace_users add column if not exists workspace_id text;
alter table warehouses add column if not exists workspace_id text;
alter table medications add column if not exists workspace_id text;
alter table movements add column if not exists workspace_id text;
alter table transfer_requests add column if not exists workspace_id text;
alter table sales add column if not exists workspace_id text;
alter table dispensations add column if not exists workspace_id text;
alter table medication_orders add column if not exists workspace_id text;
alter table audit_log add column if not exists workspace_id text;

create index if not exists idx_warehouses_workspace on warehouses(workspace_id);
create unique index if not exists idx_warehouses_unique_name_type_active
  on warehouses (workspace_id, name, type)
  where deleted_at is null;
create unique index if not exists idx_warehouses_one_central_per_workspace
  on warehouses (workspace_id)
  where type = 'central' and deleted_at is null;
create unique index if not exists idx_transfer_requests_workspace_code
  on transfer_requests(workspace_id, transfer_code)
  where transfer_code is not null;
create index if not exists idx_user_warehouse_user on workspace_user_warehouses(user_id);
create index if not exists idx_user_warehouse_warehouse on workspace_user_warehouses(warehouse_id);
create index if not exists idx_medications_workspace on medications(workspace_id);
create index if not exists idx_batches_warehouse_medication on batches(warehouse_id, medication_id);
create index if not exists idx_movements_workspace_date on movements(workspace_id, date desc);
create index if not exists idx_transfers_workspace_date on transfer_requests(workspace_id, date desc);
create index if not exists idx_sales_workspace_date on sales(workspace_id, date desc);
create index if not exists idx_dispensations_workspace_date on dispensations(workspace_id, date desc);
create index if not exists idx_orders_workspace_requested on medication_orders(workspace_id, requested_at desc);
create index if not exists idx_patients_workspace_name on patients(workspace_id, last_name, first_name);
create index if not exists idx_audit_workspace_date on audit_log(workspace_id, date desc);

create table if not exists transfer_code_counters (
  workspace_id text not null references workspaces(id) on delete cascade,
  period_yyyymm text not null,
  last_value integer not null default 0,
  primary key (workspace_id, period_yyyymm)
);

-- Una sola firma (text): PostgREST envía strings sin ambigüedad; sirve con columnas uuid
-- (comparando vía ::text) y con seeds demo tipo "m3".
drop function if exists public.consume_stock(uuid, uuid, integer);
drop function if exists public.consume_stock(text, text, integer);

create or replace function consume_stock(
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
