-- /supabase/migrations/20260317_add_cron_run_logs.sql
-- Persistent log of every cron run for developer/ops visibility.
-- Written only by the service role via the cron endpoint — no RLS needed.

create table cron_run_logs (
  id       bigint generated always as identity primary key,
  ran_at   timestamptz not null default now(),
  synced   int         not null default 0,
  imported int         not null default 0,
  failed   int         not null default 0,
  errors   text[]      not null default '{}'
);
