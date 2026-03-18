-- /supabase/migrations/20260318_add_duration_ms_to_import_reports.sql
-- Tracks how long each import took (ms) for developer performance visibility.
-- Nullable — existing rows will have NULL, new rows will be populated.

alter table import_reports
  add column duration_ms int null;
