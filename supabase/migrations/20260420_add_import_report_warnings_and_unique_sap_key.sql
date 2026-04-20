-- Store non-fatal SAP import warnings in the same report shown to PMs/admins.
alter table public.import_reports
add column if not exists warnings jsonb not null default '[]'::jsonb;

comment on column public.import_reports.warnings is
'Non-fatal SAP import warnings, such as instructions that could not be fetched.';

-- Safety net: each generated SAP project key may map to only one local row.
-- If this migration fails, clean existing duplicate pairs before re-running it.
create unique index if not exists projects_sap_subproject_import_key_uq
on public.projects (sap_subproject_id, sap_import_key)
where sap_subproject_id is not null
  and sap_import_key is not null;
