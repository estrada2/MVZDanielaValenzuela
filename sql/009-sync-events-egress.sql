-- VetHome Pro - sincronizacion ligera entre dispositivos.
-- Seguro para ejecutar varias veces. No elimina ni modifica datos clinicos.

create table if not exists public.sync_events (
    user_id uuid primary key references auth.users(id) on delete cascade,
    workspace_id uuid,
    source_device text not null default '',
    stores text[] not null default '{}',
    changed_at timestamp with time zone not null default now()
);

alter table public.sync_events
    add column if not exists workspace_id uuid,
    add column if not exists source_device text not null default '',
    add column if not exists stores text[] not null default '{}',
    add column if not exists changed_at timestamp with time zone not null default now();

create index if not exists idx_sync_events_changed_at
    on public.sync_events(changed_at desc);

alter table public.sync_events enable row level security;

drop policy if exists "sync_events_select_own" on public.sync_events;
create policy "sync_events_select_own"
    on public.sync_events
    for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists "sync_events_insert_own" on public.sync_events;
create policy "sync_events_insert_own"
    on public.sync_events
    for insert
    to authenticated
    with check (auth.uid() = user_id);

drop policy if exists "sync_events_update_own" on public.sync_events;
create policy "sync_events_update_own"
    on public.sync_events
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

grant select, insert, update on public.sync_events to authenticated;

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'sync_events'
    ) then
        alter publication supabase_realtime add table public.sync_events;
    end if;
end
$$;

-- Indices ligeros para las lecturas por usuario que realiza la aplicacion.
create index if not exists idx_clientes_user_updated
    on public.clientes(user_id, updated_at desc);
create index if not exists idx_mascotas_user_updated
    on public.mascotas(user_id, updated_at desc);
create index if not exists idx_agenda_user_updated
    on public.agenda(user_id, updated_at desc);
create index if not exists idx_consultas_user_updated
    on public.consultas(user_id, updated_at desc);
create index if not exists idx_pagos_user_updated
    on public.pagos(user_id, updated_at desc);
create index if not exists idx_servicios_externos_user_updated
    on public.servicios_externos(user_id, updated_at desc);
create index if not exists idx_gastos_user_updated
    on public.gastos(user_id, updated_at desc);
