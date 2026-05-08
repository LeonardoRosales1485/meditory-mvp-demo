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

create index if not exists idx_patients_workspace_name on patients(workspace_id, last_name, first_name);
