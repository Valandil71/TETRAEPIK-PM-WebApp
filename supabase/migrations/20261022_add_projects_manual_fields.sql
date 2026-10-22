-- SAP-owned fields a PM edited by hand in "Edit project" (e.g. 'instructions', 'work_list').
-- The SAP import skips these on update, so a manual edit is not overwritten by the next import.
-- Clearing the field in the form removes it from the list and SAP fills it again.

alter table public.projects
  add column if not exists manual_fields text[] not null default '{}';

comment on column public.projects.manual_fields is
  'SAP-owned fields edited by a PM; the SAP import does not overwrite them.';
