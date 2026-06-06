-- VetHome Pro v10 - pagos parciales / abonos

alter table public.pagos
    add column if not exists abonos jsonb not null default '[]'::jsonb;

alter table public.servicios_externos
    add column if not exists abonos jsonb not null default '[]'::jsonb;

alter table public.consultas
    add column if not exists seguimiento jsonb not null default '{}'::jsonb;
