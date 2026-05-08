-- Corrige desfasajes de esquema en entornos existentes.
-- Seguro para re-ejecutar.

create extension if not exists "pgcrypto";

-- 1) Columna faltante usada por ingresos y movimientos por lote
alter table movements add column if not exists lot text;

-- 2) Defaults UUID para evitar inserts con id null
alter table workspace_users alter column id set default gen_random_uuid();
alter table warehouses alter column id set default gen_random_uuid();
alter table medications alter column id set default gen_random_uuid();
alter table batches alter column id set default gen_random_uuid();
alter table movements alter column id set default gen_random_uuid();
alter table transfer_requests alter column id set default gen_random_uuid();
alter table sales alter column id set default gen_random_uuid();
alter table dispensations alter column id set default gen_random_uuid();
alter table medication_orders alter column id set default gen_random_uuid();
alter table audit_log alter column id set default gen_random_uuid();
