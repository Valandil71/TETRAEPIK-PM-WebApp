-- HTML body of each projects.sap_instructions entry, in the same order (null where SAP sent
-- plain text). Kept out of sap_instructions so project lists, which load that column, do not
-- pay for the HTML; only the project page and the instructions drawer read it.

alter table public.projects
  add column if not exists sap_instructions_html jsonb;

comment on column public.projects.sap_instructions_html is
  'HTML bodies of sap_instructions entries (same order); display only, sanitized in the app.';
