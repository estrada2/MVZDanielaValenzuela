-- VetHome Pro v10 Schnauzer
-- Realtime e indices operativos.
-- Seguro para datos existentes: no borra registros ni modifica valores cargados.

do $$
declare
    tabla text;
    tablas text[] := array[
        'clientes',
        'mascotas',
        'servicios',
        'inventario',
        'agenda',
        'consultas',
        'pagos',
        'servicios_externos',
        'clinicas_externas',
        'gastos',
        'movimientos_inventario',
        'vacunas_paciente',
        'audit_logs',
        'app_state'
    ];
begin
    foreach tabla in array tablas loop
        if to_regclass(format('public.%I', tabla)) is not null then
            execute format('alter table public.%I replica identity full', tabla);

            if not exists (
                select 1
                from pg_publication_tables
                where pubname = 'supabase_realtime'
                  and schemaname = 'public'
                  and tablename = tabla
            ) then
                execute format('alter publication supabase_realtime add table public.%I', tabla);
            end if;
        end if;
    end loop;
end $$;

do $$
declare
    columnas text[];
    faltantes int;
begin
    columnas := array['workspace_id', 'user_id', 'updated_at'];
    select count(*) into faltantes from unnest(columnas) c where not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'clientes' and column_name = c);
    if to_regclass('public.clientes') is not null and faltantes = 0 then
        create index if not exists idx_clientes_scope_updated on public.clientes (workspace_id, user_id, updated_at desc);
    end if;

    columnas := array['workspace_id', 'user_id', 'cliente_id'];
    select count(*) into faltantes from unnest(columnas) c where not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'mascotas' and column_name = c);
    if to_regclass('public.mascotas') is not null and faltantes = 0 then
        create index if not exists idx_mascotas_cliente_scope on public.mascotas (workspace_id, user_id, cliente_id);
    end if;

    columnas := array['workspace_id', 'user_id', 'fecha', 'hora'];
    select count(*) into faltantes from unnest(columnas) c where not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'agenda' and column_name = c);
    if to_regclass('public.agenda') is not null and faltantes = 0 then
        create index if not exists idx_agenda_scope_fecha_hora on public.agenda (workspace_id, user_id, fecha, hora);
    end if;

    columnas := array['workspace_id', 'user_id', 'mascota_id', 'fecha_iso'];
    select count(*) into faltantes from unnest(columnas) c where not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'consultas' and column_name = c);
    if to_regclass('public.consultas') is not null and faltantes = 0 then
        create index if not exists idx_consultas_scope_mascota_fecha on public.consultas (workspace_id, user_id, mascota_id, fecha_iso desc);
    end if;

    columnas := array['workspace_id', 'user_id', 'estado_pago', 'fecha_iso'];
    select count(*) into faltantes from unnest(columnas) c where not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pagos' and column_name = c);
    if to_regclass('public.pagos') is not null and faltantes = 0 then
        create index if not exists idx_pagos_scope_estado_fecha on public.pagos (workspace_id, user_id, estado_pago, fecha_iso desc);
    end if;

    columnas := array['workspace_id', 'user_id', 'fecha_iso'];
    select count(*) into faltantes from unnest(columnas) c where not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'servicios_externos' and column_name = c);
    if to_regclass('public.servicios_externos') is not null and faltantes = 0 then
        create index if not exists idx_servicios_externos_scope_fecha on public.servicios_externos (workspace_id, user_id, fecha_iso desc);
    end if;

    columnas := array['workspace_id', 'user_id', 'nombre'];
    select count(*) into faltantes from unnest(columnas) c where not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'clinicas_externas' and column_name = c);
    if to_regclass('public.clinicas_externas') is not null and faltantes = 0 then
        create index if not exists idx_clinicas_externas_scope_nombre on public.clinicas_externas (workspace_id, user_id, nombre);
    end if;

    columnas := array['workspace_id', 'user_id', 'stock', 'stock_minimo'];
    select count(*) into faltantes from unnest(columnas) c where not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'inventario' and column_name = c);
    if to_regclass('public.inventario') is not null and faltantes = 0 then
        create index if not exists idx_inventario_scope_stock on public.inventario (workspace_id, user_id, stock, stock_minimo);
    end if;

    columnas := array['workspace_id', 'user_id', 'fecha_refuerzo'];
    select count(*) into faltantes from unnest(columnas) c where not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'vacunas_paciente' and column_name = c);
    if to_regclass('public.vacunas_paciente') is not null and faltantes = 0 then
        create index if not exists idx_vacunas_paciente_scope_refuerzo on public.vacunas_paciente (workspace_id, user_id, fecha_refuerzo);
    end if;

    columnas := array['workspace_id', 'user_id', 'created_at'];
    select count(*) into faltantes from unnest(columnas) c where not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'audit_logs' and column_name = c);
    if to_regclass('public.audit_logs') is not null and faltantes = 0 then
        create index if not exists idx_audit_logs_scope_created on public.audit_logs (workspace_id, user_id, created_at desc);
    end if;
end $$;
