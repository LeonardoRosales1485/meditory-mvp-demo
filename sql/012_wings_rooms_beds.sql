-- Gestión de alas médicas, salas y camas
-- Un ala agrupa salas; una sala pertenece a una sola ala.

create table if not exists wings (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references workspaces(id) on delete cascade,
  name text not null,
  type text not null check (type in (
    'urgencias',
    'quirofanos',
    'cuidados_intensivos',
    'hospitalizacion',
    'ambulatoria'
  )),
  prefix smallint not null check (prefix between 1 and 9),
  created_at timestamptz not null default now(),
  unique (workspace_id, prefix),
  unique (workspace_id, name)
);

create index if not exists idx_wings_workspace on wings(workspace_id);

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references workspaces(id) on delete cascade,
  wing_id uuid not null references wings(id) on delete cascade,
  number smallint not null check (number between 1 and 99),
  full_number smallint generated always as (null) stored,
  bed_count smallint not null check (bed_count between 1 and 4),
  created_at timestamptz not null default now(),
  unique (workspace_id, wing_id, number)
);

-- full_number = prefix * 100 + number; lo calculamos vía trigger ya que requiere join con wings.
alter table rooms drop column if exists full_number;
alter table rooms add column if not exists full_number smallint;

create or replace function rooms_set_full_number()
returns trigger
language plpgsql
as $$
declare
  v_prefix smallint;
begin
  select prefix into v_prefix from wings where id = new.wing_id;
  if v_prefix is null then
    raise exception 'Ala (wing) no encontrada para la sala.';
  end if;
  new.full_number := v_prefix * 100 + new.number;
  return new;
end;
$$;

drop trigger if exists rooms_set_full_number_trg on rooms;
create trigger rooms_set_full_number_trg
before insert or update of number, wing_id on rooms
for each row execute function rooms_set_full_number();

-- Si cambia el prefix de un ala, sincronizamos full_number en sus salas.
create or replace function wings_sync_room_numbers()
returns trigger
language plpgsql
as $$
begin
  if new.prefix is distinct from old.prefix then
    update rooms set full_number = new.prefix * 100 + number where wing_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists wings_sync_room_numbers_trg on wings;
create trigger wings_sync_room_numbers_trg
after update of prefix on wings
for each row execute function wings_sync_room_numbers();

create unique index if not exists idx_rooms_workspace_full_number
  on rooms(workspace_id, full_number);

create index if not exists idx_rooms_wing on rooms(wing_id);
create index if not exists idx_rooms_workspace on rooms(workspace_id);

create table if not exists beds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  position smallint not null check (position between 1 and 4),
  patient_id uuid references patients(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (room_id, position),
  unique (patient_id)
);

create index if not exists idx_beds_room on beds(room_id);
create index if not exists idx_beds_patient on beds(patient_id);

-- Ajuste de cantidad de camas: garantiza que rooms.bed_count coincida con #beds.
create or replace function rooms_sync_beds()
returns trigger
language plpgsql
as $$
declare
  v_existing integer;
  v_max_pos integer;
  v_target integer := new.bed_count;
begin
  select coalesce(max(position), 0) into v_max_pos from beds where room_id = new.id;
  select count(*) into v_existing from beds where room_id = new.id;

  if v_existing < v_target then
    -- agregar camas hasta llegar a bed_count
    while v_existing < v_target loop
      insert into beds (room_id, position)
      values (new.id, v_existing + 1);
      v_existing := v_existing + 1;
    end loop;
  elsif v_existing > v_target then
    -- eliminar camas por encima del nuevo target; rechazamos si tienen paciente asignado
    if exists (
      select 1 from beds
      where room_id = new.id
        and position > v_target
        and patient_id is not null
    ) then
      raise exception 'No se puede reducir la cantidad de camas: hay pacientes asignados en camas excedentes.';
    end if;
    delete from beds where room_id = new.id and position > v_target;
  end if;

  return new;
end;
$$;

drop trigger if exists rooms_sync_beds_insert_trg on rooms;
create trigger rooms_sync_beds_insert_trg
after insert on rooms
for each row execute function rooms_sync_beds();

drop trigger if exists rooms_sync_beds_update_trg on rooms;
create trigger rooms_sync_beds_update_trg
after update of bed_count on rooms
for each row execute function rooms_sync_beds();
