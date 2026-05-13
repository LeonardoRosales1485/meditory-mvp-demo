-- Medicamentos: baja lógica (deleted_at) + venta en mostrador (sale_enabled).
-- Idempotente: podés re-ejecutarlo aunque hayas corrido una versión anterior solo con sale_enabled.
-- Si no aplicaste 016_medications_soft_delete.sql, este script incorpora lo necesario.

-- Baja lógica en catálogo (equivalente a 016)
alter table medications add column if not exists deleted_at timestamptz null;

create index if not exists idx_medications_workspace_active on medications (workspace_id) where deleted_at is null;

-- Habilitar/deshabilitar venta en mostrador
alter table medications add column if not exists sale_enabled boolean not null default true;
