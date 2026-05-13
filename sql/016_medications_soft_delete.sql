-- Baja lógica de medicamentos del catálogo (trazabilidad y FKs intactas).
-- Seguro para re-ejecutar.

alter table medications add column if not exists deleted_at timestamptz null;

create index if not exists idx_medications_workspace_active on medications (workspace_id) where deleted_at is null;
