-- STM projects created via "Create STM Project" were copied with the source's sap_import_key,
-- so they collided with the source on (sap_subproject_id, sap_import_key).
-- Give existing copies their own key (mode prefix STM instead of STD), then enforce uniqueness.
-- Copies are identified as: system = 'STM' but the key's system token (2nd part) is not 'STM'.
update public.projects
set sap_import_key = 'STM|' || substr(sap_import_key, 5)
where system = 'STM'
  and sap_import_key like 'STD|%'
  and split_part(sap_import_key, '|', 2) <> 'STM';

create unique index if not exists projects_sap_subproject_import_key_uq
on public.projects (sap_subproject_id, sap_import_key)
where sap_subproject_id is not null
  and sap_import_key is not null;
