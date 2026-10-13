-- Closest deadline of each project (the earliest of its initial, interim and final deadlines;
-- least() skips nulls, like getClosestProjectDeadline in lib/projectGrouping.ts).
-- Lets the server return a list's first page in the same order the app sorts it, so
-- Concluded Projects and Invoicing can show that page before the full list has loaded.
--
-- Generated and stored: the database keeps it in step with the deadlines. Code must never
-- write it (see lib/projects/stm.ts, which copies whole rows).

alter table public.projects
  add column if not exists closest_deadline timestamptz
  generated always as (least(initial_deadline, interim_deadline, final_deadline)) stored;

create index if not exists idx_projects_status_closest_deadline
  on public.projects (status, closest_deadline);
