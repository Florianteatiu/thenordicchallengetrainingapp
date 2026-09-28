-- =============================================================================
-- In-person coaching ("Nordic PT", the app at /pt)
--
-- Florian's face-to-face clients don't have an account: he logs their
-- sessions himself on his phone. So they live in their own tables, separate
-- from the online clients, and only the coach can read or write any of it.
--
-- A PT_SESSION is one training session with one client on one date. Like a
-- program day, it owns a private copy of a workout (copied from a template,
-- from the client's last session, or built on the spot), so the normal
-- workout builder and exercise library work unchanged. Sets go into
-- PT_SET_LOGS, timed blocks into PT_BLOCK_LOGS. PT_NOTES replace the notes app:
-- quick dated notes per client, optionally pinned to the top.
-- =============================================================================

create table public.pt_clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  goals text,
  injuries text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.pt_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.pt_clients (id) on delete cascade,
  workout_id uuid references public.workouts (id) on delete set null,
  workout_title text not null default '',
  session_date date not null default current_date,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  rpe int check (rpe between 1 and 10),
  notes text
);
create index pt_sessions_client_idx on public.pt_sessions (client_id, session_date desc);

create table public.pt_set_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.pt_sessions (id) on delete cascade,
  block_exercise_id uuid references public.block_exercises (id) on delete set null,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  set_number int not null,
  reps int,
  load_kg numeric(6, 2),
  duration_sec int,
  distance_m int,
  done boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index pt_set_logs_unique on public.pt_set_logs (session_id, block_exercise_id, set_number);
create index pt_set_logs_exercise_idx on public.pt_set_logs (exercise_id);

create table public.pt_block_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.pt_sessions (id) on delete cascade,
  block_id uuid references public.workout_blocks (id) on delete set null,
  rounds int,
  extra_reps int,
  duration_sec int,
  notes text,
  created_at timestamptz not null default now()
);
create unique index pt_block_logs_unique on public.pt_block_logs (session_id, block_id);

create table public.pt_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.pt_clients (id) on delete cascade,
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index pt_notes_client_idx on public.pt_notes (client_id, created_at desc);

-- A session's workout is its own private copy: deleting the session deletes
-- it too (templates and workouts still used elsewhere are left alone).
create or replace function public.delete_pt_session_workout()
returns trigger
language plpgsql
as $$
begin
  delete from public.workouts w
  where w.id = old.workout_id
    and not w.is_template
    and not exists (select 1 from public.program_days pd where pd.workout_id = w.id)
    and not exists (select 1 from public.pt_sessions s where s.workout_id = w.id);
  return old;
end;
$$;

create trigger pt_sessions_cleanup
  after delete on public.pt_sessions
  for each row execute function public.delete_pt_session_workout();

-- ---------- Row level security: coach only --------------------------------

alter table public.pt_clients enable row level security;
alter table public.pt_sessions enable row level security;
alter table public.pt_set_logs enable row level security;
alter table public.pt_block_logs enable row level security;
alter table public.pt_notes enable row level security;

create policy pt_clients_coach on public.pt_clients for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
create policy pt_sessions_coach on public.pt_sessions for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
create policy pt_set_logs_coach on public.pt_set_logs for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
create policy pt_block_logs_coach on public.pt_block_logs for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
create policy pt_notes_coach on public.pt_notes for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
