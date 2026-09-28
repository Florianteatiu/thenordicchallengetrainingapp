-- =============================================================================
-- Florian's challenge calendar: the dates of each leg of the crossing and
-- other events (e.g. the documentary premiere). Everyone signed in can read
-- it; only the coach edits it.
-- =============================================================================

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'event' check (kind in ('swim', 'bike', 'run', 'event')),
  starts_on date not null,
  ends_on date check (ends_on is null or ends_on >= starts_on),
  location text,
  description text,
  url text,
  created_at timestamptz not null default now()
);
create index events_starts_idx on public.events (starts_on);

alter table public.events enable row level security;

create policy events_select on public.events for select to authenticated using (true);
create policy events_coach on public.events for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
