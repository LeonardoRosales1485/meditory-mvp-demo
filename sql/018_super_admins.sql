-- Superadmins del backoffice
-- Requiere pgcrypto (creado en 001_schema.sql)

create table if not exists super_admins (
  id text primary key default 'sa-' || substr(md5(random()::text), 1, 12),
  email text not null unique,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- Función para verificar contraseña (usa pgcrypto)
create or replace function check_super_admin_password(
  p_email text,
  p_password text
)
returns boolean
language plpgsql
as $$
declare
  stored_hash text;
begin
  select password_hash into stored_hash
  from super_admins
  where email = p_email;

  if stored_hash is null then
    return false;
  end if;

  return stored_hash = crypt(p_password, stored_hash);
end;
$$;

-- Seed default superadmin (password: meditory2026)
insert into super_admins (email, name, password_hash)
values (
  'admin@meditory.com',
  'Super Admin',
  crypt('meditory2026', gen_salt('bf'))
)
on conflict (email) do nothing;
