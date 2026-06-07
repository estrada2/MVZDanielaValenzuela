-- VetHome Pro v10 - agregar segundo usuario al mismo workspace
-- Cambia los correos antes de ejecutar.
-- No crea usuarios; el segundo usuario debe existir antes en Supabase Auth.

with workspace_principal as (
    select member.workspace_id
    from public.app_workspace_members member
    join auth.users usuario_principal on usuario_principal.id = member.user_id
    where usuario_principal.email = 'CORREO_USUARIO_PRINCIPAL'
    order by member.created_at
    limit 1
),
usuario_nuevo as (
    select id
    from auth.users
    where email = 'CORREO_SEGUNDO_USUARIO'
)
insert into public.app_workspace_members (workspace_id, user_id, role)
select workspace_principal.workspace_id, usuario_nuevo.id, 'member'
from workspace_principal, usuario_nuevo
on conflict (workspace_id, user_id) do nothing;
