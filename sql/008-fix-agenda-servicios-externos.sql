-- VetHome Pro v10/v11 - agenda externa y servicios externos
-- Seguro para correr varias veces. No borra informacion existente.
-- Permite que agenda acepte citas externas sin propietario/mascota registrados.

alter table if exists public.agenda
    alter column cliente_id drop not null,
    alter column mascota_id drop not null;

alter table if exists public.servicios_externos
    add column if not exists clinica_legacy_id bigint;

do $$
declare
    tiene_workspace boolean;
begin
    select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'servicios_externos'
          and column_name = 'workspace_id'
    ) into tiene_workspace;

    if tiene_workspace then
        create index if not exists idx_servicios_externos_clinica_legacy
            on public.servicios_externos(workspace_id, user_id, clinica_legacy_id);
    else
        create index if not exists idx_servicios_externos_clinica_legacy
            on public.servicios_externos(user_id, clinica_legacy_id);
    end if;
end $$;
