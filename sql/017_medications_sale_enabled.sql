-- Habilitar/deshabilitar venta en mostrador por medicamento.
-- Seguro para re-ejecutar.

alter table medications add column if not exists sale_enabled boolean not null default true;
