-- Requiere haber ejecutado 001_schema.sql

insert into workspaces (id, name, slug)
values
  ('ws-aleman', 'Hospital Alemán', 'HOSPITALALEMAN'),
  ('ws-francisco', 'Hospital Francisco', 'HOSPITALFRANCISCO'),
  ('ws-blanco', 'Hospital Blanco', 'hospitalblanco')
on conflict do nothing;

insert into workspace_users (id, workspace_id, name, email, role)
select gen_random_uuid(), v.workspace_id, v.name, v.email, v.role
from (
  values
    ('ws-aleman', 'Admin Demo', 'hospitalalemanadmin@user.com', 'admin'),
    ('ws-aleman', 'María Pérez', 'hospitalalemanventas@user.com', 'ventas'),
    ('ws-aleman', 'Doctor Demo', 'hospitalalemandoctor@user.com', 'doctor'),
    ('ws-aleman', 'Luis Sosa', 'hospitalalemantecnico@user.com', 'tecnico'),
    ('ws-francisco', 'Admin Demo', 'hospitalfranciscoadmin@user.com', 'admin'),
    ('ws-francisco', 'Carlos Ruiz', 'hospitalfranciscoventas@user.com', 'ventas'),
    ('ws-francisco', 'Doctor Demo', 'hospitalfranciscodoctor@user.com', 'doctor'),
    ('ws-francisco', 'Patricia Vega', 'hospitalfranciscotecnico@user.com', 'tecnico'),
    ('ws-blanco', 'Admin Demo', 'hospitalblancoadmin@user.com', 'admin'),
    ('ws-blanco', 'Ventas Demo', 'hospitalblancoventas@user.com', 'ventas'),
    ('ws-blanco', 'Doctor Demo', 'hospitalblancodoctor@user.com', 'doctor'),
    ('ws-blanco', 'Enfermero Jefe Demo', 'hospitalblancotecnico@user.com', 'tecnico')
) as v(workspace_id, name, email, role)
where not exists (
  select 1
  from workspace_users u
  where lower(u.email) = lower(v.email)
);

insert into warehouses (id, workspace_id, name, type, unit)
select gen_random_uuid(), v.workspace_id, v.name, v.type, v.unit
from (
  values
    ('ws-aleman', 'Depósito Central', 'central', 'Hospital Alemán'),
    ('ws-aleman', 'Farmacia Interna', 'interna', 'Hospital Alemán'),
    ('ws-aleman', 'Farmacia Ventas', 'ventas', 'Hospital Alemán'),
    ('ws-francisco', 'Depósito Central', 'central', 'Hospital Francisco'),
    ('ws-francisco', 'Farmacia Interna', 'interna', 'Hospital Francisco'),
    ('ws-francisco', 'Farmacia Ventas', 'ventas', 'Hospital Francisco')
) as v(workspace_id, name, type, unit)
where not exists (
  select 1
  from warehouses w
  where w.workspace_id = v.workspace_id
    and w.name = v.name
    and w.type = v.type
);

insert into medications (id, workspace_id, name, active_ingredient, concentration_value, concentration_unit, form)
select gen_random_uuid(), v.workspace_id, v.name, v.active_ingredient, v.concentration_value, v.concentration_unit, v.form
from (
  values
    ('ws-aleman', 'Paracetamol', 'Paracetamol', 500, 'mg', 'Comprimido'),
    ('ws-aleman', 'Ibuprofeno', 'Ibuprofeno', 400, 'mg', 'Comprimido'),
    ('ws-aleman', 'Amoxicilina', 'Amoxicilina', 875, 'mg', 'Cápsula'),
    ('ws-aleman', 'Omeprazol', 'Omeprazol', 20, 'mg', 'Cápsula'),
    ('ws-aleman', 'Salbutamol', 'Salbutamol', 100, 'mcg', 'Aerosol'),
    ('ws-aleman', 'Enalapril', 'Enalapril', 10, 'mg', 'Comprimido'),
    ('ws-aleman', 'Metformina', 'Metformina', 850, 'mg', 'Comprimido'),
    ('ws-aleman', 'Diclofenac', 'Diclofenac', 75, 'mg', 'Inyectable'),
    ('ws-francisco', 'Paracetamol', 'Paracetamol', 500, 'mg', 'Comprimido'),
    ('ws-francisco', 'Ibuprofeno', 'Ibuprofeno', 400, 'mg', 'Comprimido'),
    ('ws-francisco', 'Amoxicilina', 'Amoxicilina', 875, 'mg', 'Cápsula'),
    ('ws-francisco', 'Omeprazol', 'Omeprazol', 20, 'mg', 'Cápsula'),
    ('ws-francisco', 'Salbutamol', 'Salbutamol', 100, 'mcg', 'Aerosol'),
    ('ws-francisco', 'Enalapril', 'Enalapril', 10, 'mg', 'Comprimido'),
    ('ws-francisco', 'Metformina', 'Metformina', 850, 'mg', 'Comprimido'),
    ('ws-francisco', 'Diclofenac', 'Diclofenac', 75, 'mg', 'Inyectable')
) as v(workspace_id, name, active_ingredient, concentration_value, concentration_unit, form)
where not exists (
  select 1
  from medications m
  where m.workspace_id = v.workspace_id
    and m.name = v.name
    and m.concentration_value = v.concentration_value
    and m.concentration_unit = v.concentration_unit
    and m.form = v.form
);

insert into batches (id, medication_id, warehouse_id, lot, expiry, quantity)
select gen_random_uuid(), m.id, w.id, concat('SEED-', substr(m.id::text, 1, 8), '-', row_number() over()), current_date + interval '180 days', 120
from medications m
join warehouses w on w.workspace_id = m.workspace_id and w.type = 'central'
where not exists (
  select 1
  from batches b
  where b.medication_id = m.id
    and b.warehouse_id = w.id
);

insert into workspace_user_warehouses (user_id, warehouse_id)
select u.id, w.id
from workspace_users u
join warehouses w on w.workspace_id = u.workspace_id
where not exists (
  select 1
  from workspace_user_warehouses x
  where x.user_id = u.id
    and x.warehouse_id = w.id
);
