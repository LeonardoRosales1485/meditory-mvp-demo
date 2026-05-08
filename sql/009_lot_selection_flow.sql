-- Reglas de selección explícita de lote para transferencias y pedidos.
-- Seguro para re-ejecutar.

alter table transfer_requests
  add column if not exists source_batch_id text;

alter table medication_orders
  add column if not exists source_batch_id text;
