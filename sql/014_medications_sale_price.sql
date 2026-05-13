-- Precio de venta de mostrador por medicamento (lista de precios del workspace)

alter table medications
  add column if not exists sale_price numeric(12,2) not null default 0
  check (sale_price >= 0);

-- Valores alineados al listado demo previo (solo referencia inicial; pueden editarse en la app)
update medications set sale_price = 850 where name = 'Paracetamol';
update medications set sale_price = 1200 where name = 'Ibuprofeno';
update medications set sale_price = 4200 where name = 'Amoxicilina';
update medications set sale_price = 1500 where name = 'Omeprazol';
update medications set sale_price = 3800 where name = 'Salbutamol';
update medications set sale_price = 1100 where name = 'Enalapril';
update medications set sale_price = 3200 where name = 'Metformina';
update medications set sale_price = 2400 where name = 'Diclofenac';
