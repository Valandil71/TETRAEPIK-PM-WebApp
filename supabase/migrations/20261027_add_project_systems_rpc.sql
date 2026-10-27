-- /supabase/migrations/20261027_add_project_systems_rpc.sql
-- RPC listing every system used by a project, for the System select when creating or editing one.
-- Distinct in the database so the client does not download a row per project.
-- Security invoker: the caller's row-level security applies.

create or replace function project_systems()
returns setof text
language sql
stable
security invoker
as $$
  select distinct system
  from public.projects
  where system is not null
    and btrim(system) <> ''
  order by system;
$$;

grant execute on function project_systems() to authenticated;
