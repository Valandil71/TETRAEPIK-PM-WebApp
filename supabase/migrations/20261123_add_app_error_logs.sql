-- /supabase/migrations/20261123_add_app_error_logs.sql
-- Persistent log of server-side API errors (Vercel Hobby only keeps logs for 1 hour).
-- Written only by the service role from API routes (lib/logging/errorLog.ts).
-- Readable only by admins; no one can write from the browser.

create table if not exists public.app_error_logs (
  id                bigint generated always as identity primary key,
  occurred_at       timestamptz not null default now(),

  -- Request that failed
  route             text        not null,
  method            text,
  http_status       int,
  user_id           uuid        references auth.users(id) on delete set null,

  -- The error itself
  error_name        text,
  message           text        not null,
  stack             text,

  -- External service the request depended on (e.g. SAP), when the error came from it
  upstream_service  text,
  upstream_url      text,
  upstream_status   int,
  upstream_body     text,
  attempts          jsonb,
  duration_ms       int,

  -- Deployment info, to match Vercel logs and know which code was live
  vercel_request_id text,
  vercel_env        text,
  commit_sha        text,
  region            text,

  -- Anything route-specific (e.g. failed SAP import items)
  context           jsonb       not null default '{}'::jsonb
);

create index if not exists app_error_logs_occurred_at_idx
  on public.app_error_logs (occurred_at desc);

create index if not exists app_error_logs_route_occurred_at_idx
  on public.app_error_logs (route, occurred_at desc);

alter table public.app_error_logs enable row level security;

-- Admins can read the log from the app. Inserts/deletes happen only via the service role
-- (which bypasses RLS), so no insert/update/delete policies exist on purpose.
drop policy if exists "admin read error logs" on public.app_error_logs;
create policy "admin read error logs"
on public.app_error_logs
for select
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

revoke all on public.app_error_logs from anon;
revoke insert, update, delete on public.app_error_logs from authenticated;
