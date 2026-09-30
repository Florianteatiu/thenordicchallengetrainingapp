-- Small groups for Nordic PT (1–8 people). A group session is a container:
-- every person who shows up gets their own ordinary pt_session inside it, so
-- their history, "last time" numbers and lift charts are one and the same
-- whether they train 1-to-1 or in a group. Members share the session's
-- workout (or one of two workouts: A or B) through pt_sessions.workout_id.

create table public.pt_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.pt_group_members (
  group_id uuid not null references public.pt_groups (id) on delete cascade,
  client_id uuid not null references public.pt_clients (id) on delete cascade,
  position int not null default 0,
  primary key (group_id, client_id)
);
create index pt_group_members_client_idx on public.pt_group_members (client_id);

create table public.pt_group_sessions (
  id uuid primary key default gen_random_uuid(),
  -- Deleting a group keeps its past sessions (and everyone's history).
  group_id uuid references public.pt_groups (id) on delete set null,
  group_name text not null default '',
  session_date date not null default current_date,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text
);
create index pt_group_sessions_group_idx on public.pt_group_sessions (group_id, session_date desc);

-- Deleting a group session removes the member sessions logged in it.
alter table public.pt_sessions
  add column if not exists group_session_id uuid references public.pt_group_sessions (id) on delete cascade;
create index if not exists pt_sessions_group_session_idx on public.pt_sessions (group_session_id);

alter table public.pt_groups enable row level security;
alter table public.pt_group_members enable row level security;
alter table public.pt_group_sessions enable row level security;

create policy pt_groups_coach on public.pt_groups for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
create policy pt_group_members_coach on public.pt_group_members for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
create policy pt_group_sessions_coach on public.pt_group_sessions for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
