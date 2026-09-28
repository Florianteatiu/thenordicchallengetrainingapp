-- =============================================================================
-- The Nordic Challenge — training app: initial schema
--
-- Model in one paragraph: the coach keeps an exercise LIBRARY. A WORKOUT is
-- made of ordered BLOCKS (straight sets, circuit, intervals, AMRAP, EMOM), and
-- each block holds ordered BLOCK_EXERCISES with the prescription (sets, reps,
-- load, time, distance, rest). A PROGRAM is a number of weeks; PROGRAM_DAYS put
-- a workout on (week, day). Templates are just workouts/programs with
-- is_template = true; assigning one to a client deep-copies it (copy_program),
-- so tweaking a client's plan never changes the template. Clients log into
-- WORKOUT_SESSIONS, with SET_LOGS for straight sets and BLOCK_LOGS for timed
-- blocks.
-- =============================================================================

-- ---------- Profiles --------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'client' check (role in ('coach', 'client')),
  full_name text not null default '',
  avatar_url text,
  goals text,
  injuries text,
  equipment text,
  weekly_target int not null default 3 check (weekly_target between 1 and 14),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- Only one coach can ever exist (partial unique index on a constant).
create unique index profiles_single_coach on public.profiles ((true)) where role = 'coach';

create or replace function public.is_coach()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'coach');
$$;

-- Every new auth user gets a profile. The very first account becomes the
-- coach; everyone after that is a client.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles where role = 'coach') then 'client' else 'coach' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Exercise library -----------------------------------------------

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'strength'
    check (category in ('strength', 'mobility', 'endurance', 'conditioning', 'core')),
  -- What a client logs for this exercise.
  tracking text not null default 'weight_reps'
    check (tracking in ('weight_reps', 'reps', 'time', 'distance_time')),
  video_url text,
  cues text,
  created_at timestamptz not null default now()
);

create unique index exercises_name_unique on public.exercises (lower(name));

-- ---------- Workouts --------------------------------------------------------

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'New workout',
  description text,
  is_template boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_blocks (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  position int not null default 0,
  name text not null default '',
  -- sets: classic straight sets, logged set by set
  -- circuit: go through the list N rounds
  -- intervals: work/rest x rounds (HIIT, Tabata)
  -- amrap: as many rounds as possible in time_cap_sec
  -- emom: every minute on the minute for `rounds` minutes
  format text not null default 'sets'
    check (format in ('sets', 'circuit', 'intervals', 'amrap', 'emom')),
  rounds int,
  work_sec int,
  rest_sec int,
  time_cap_sec int,
  notes text
);
create index workout_blocks_workout_idx on public.workout_blocks (workout_id, position);

create table public.block_exercises (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.workout_blocks (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position int not null default 0,
  sets int,
  reps text,          -- text on purpose: "8-10", "AMRAP", "5/side"
  load text,          -- text on purpose: "60 kg", "RPE 8", "bodyweight"
  duration_sec int,
  distance_m int,
  rest_sec int,
  tempo text,
  notes text
);
create index block_exercises_block_idx on public.block_exercises (block_id, position);

-- ---------- Programs --------------------------------------------------------

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'New program',
  description text,
  weeks int not null default 4 check (weeks between 1 and 52),
  is_template boolean not null default false,
  client_id uuid references public.profiles (id) on delete cascade,
  start_date date,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  created_at timestamptz not null default now(),
  check (is_template or client_id is not null)
);
create index programs_client_idx on public.programs (client_id);

create table public.program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  week int not null check (week >= 1),
  day int not null check (day between 1 and 7),   -- 1 = Monday
  position int not null default 0,
  workout_id uuid not null references public.workouts (id) on delete cascade
);
create index program_days_program_idx on public.program_days (program_id, week, day);

-- Workouts belong to exactly one program day (or are standalone templates),
-- so deleting a program day also deletes its private workout copy.
create or replace function public.delete_orphan_workout()
returns trigger
language plpgsql
as $$
begin
  delete from public.workouts w
  where w.id = old.workout_id
    and not w.is_template
    and not exists (select 1 from public.program_days pd where pd.workout_id = w.id);
  return old;
end;
$$;

create trigger program_days_cleanup
  after delete on public.program_days
  for each row execute function public.delete_orphan_workout();

-- ---------- Logging ---------------------------------------------------------

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  program_day_id uuid references public.program_days (id) on delete set null,
  workout_id uuid references public.workouts (id) on delete set null,
  workout_title text not null default '',
  scheduled_date date,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  rpe int check (rpe between 1 and 10),
  feeling int check (feeling between 1 and 5),
  notes text
);
create unique index workout_sessions_day_unique on public.workout_sessions (client_id, program_day_id);
create index workout_sessions_client_idx on public.workout_sessions (client_id, completed_at desc);

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
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
create unique index set_logs_unique on public.set_logs (session_id, block_exercise_id, set_number);
create index set_logs_exercise_idx on public.set_logs (exercise_id, created_at desc);

create table public.block_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  block_id uuid references public.workout_blocks (id) on delete set null,
  rounds int,
  extra_reps int,
  duration_sec int,
  notes text,
  created_at timestamptz not null default now()
);
create unique index block_logs_unique on public.block_logs (session_id, block_id);

-- ---------- Access helpers --------------------------------------------------

-- Can the current user read this program? Coach: always. Client: only their
-- own, and never while it's still a draft.
create or replace function public.can_read_program(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_coach() or exists (
    select 1 from public.programs p
    where p.id = p_program_id and p.client_id = auth.uid() and p.status <> 'draft'
  );
$$;

create or replace function public.can_read_workout(p_workout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_coach() or exists (
    select 1 from public.program_days pd
    join public.programs p on p.id = pd.program_id
    where pd.workout_id = p_workout_id and p.client_id = auth.uid() and p.status <> 'draft'
  );
$$;

create or replace function public.owns_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.workout_sessions s where s.id = p_session_id and s.client_id = auth.uid());
$$;

-- ---------- Row level security ---------------------------------------------

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_blocks enable row level security;
alter table public.block_exercises enable row level security;
alter table public.programs enable row level security;
alter table public.program_days enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.set_logs enable row level security;
alter table public.block_logs enable row level security;

-- profiles: everyone reads their own; clients can read the coach (name/photo
-- for the companion); the coach reads and edits everyone.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or role = 'coach' or public.is_coach());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_coach_update on public.profiles for update to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- Nobody may change `role` (or `archived`) through the API: column privileges
-- limit what an UPDATE can touch; the coach edits client fields through the
-- same list.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, avatar_url, goals, injuries, equipment, weekly_target, archived) on public.profiles to authenticated;

-- A client must not be able to archive themselves or edit their target; only
-- the coach may change those two.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_coach() and (new.archived is distinct from old.archived or new.weekly_target is distinct from old.weekly_target) then
    raise exception 'Only the coach can change this';
  end if;
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- exercise library: everyone signed in reads, coach writes.
create policy exercises_select on public.exercises for select to authenticated using (true);
create policy exercises_coach on public.exercises for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- workouts & their parts
create policy workouts_select on public.workouts for select to authenticated
  using (public.can_read_workout(id));
create policy workouts_coach on public.workouts for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

create policy workout_blocks_select on public.workout_blocks for select to authenticated
  using (public.can_read_workout(workout_id));
create policy workout_blocks_coach on public.workout_blocks for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

create policy block_exercises_select on public.block_exercises for select to authenticated
  using (exists (select 1 from public.workout_blocks b where b.id = block_id and public.can_read_workout(b.workout_id)));
create policy block_exercises_coach on public.block_exercises for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- programs
create policy programs_select on public.programs for select to authenticated
  using (public.can_read_program(id));
create policy programs_coach on public.programs for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

create policy program_days_select on public.program_days for select to authenticated
  using (public.can_read_program(program_id));
create policy program_days_coach on public.program_days for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- sessions & logs: the client owns theirs; the coach reads everything.
create policy sessions_select on public.workout_sessions for select to authenticated
  using (client_id = auth.uid() or public.is_coach());
create policy sessions_insert on public.workout_sessions for insert to authenticated
  with check (client_id = auth.uid());
create policy sessions_update on public.workout_sessions for update to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy sessions_delete on public.workout_sessions for delete to authenticated
  using (client_id = auth.uid() or public.is_coach());

create policy set_logs_select on public.set_logs for select to authenticated
  using (public.owns_session(session_id) or public.is_coach());
create policy set_logs_write on public.set_logs for all to authenticated
  using (public.owns_session(session_id)) with check (public.owns_session(session_id));

create policy block_logs_select on public.block_logs for select to authenticated
  using (public.owns_session(session_id) or public.is_coach());
create policy block_logs_write on public.block_logs for all to authenticated
  using (public.owns_session(session_id)) with check (public.owns_session(session_id));

-- ---------- Copy helpers (coach only; run with the caller's permissions) ---

-- Deep-copies a workout with its blocks and exercises. Returns the new id.
create or replace function public.copy_workout(p_workout_id uuid, p_as_template boolean default false)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_new_workout uuid;
  v_block record;
  v_new_block uuid;
begin
  if not public.is_coach() then
    raise exception 'Only the coach can copy workouts';
  end if;

  insert into public.workouts (title, description, is_template)
  select title, description, p_as_template from public.workouts where id = p_workout_id
  returning id into v_new_workout;

  if v_new_workout is null then
    raise exception 'Workout % not found', p_workout_id;
  end if;

  for v_block in select * from public.workout_blocks where workout_id = p_workout_id order by position loop
    insert into public.workout_blocks (workout_id, position, name, format, rounds, work_sec, rest_sec, time_cap_sec, notes)
    values (v_new_workout, v_block.position, v_block.name, v_block.format, v_block.rounds, v_block.work_sec, v_block.rest_sec, v_block.time_cap_sec, v_block.notes)
    returning id into v_new_block;

    insert into public.block_exercises (block_id, exercise_id, position, sets, reps, load, duration_sec, distance_m, rest_sec, tempo, notes)
    select v_new_block, exercise_id, position, sets, reps, load, duration_sec, distance_m, rest_sec, tempo, notes
    from public.block_exercises where block_id = v_block.id;
  end loop;

  return v_new_workout;
end;
$$;

-- Deep-copies a program: every scheduled day gets its own private copy of the
-- workout, so the copy can be tweaked freely.
create or replace function public.copy_program(
  p_program_id uuid,
  p_client_id uuid default null,
  p_start_date date default null,
  p_as_template boolean default false,
  p_status text default 'draft'
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_new_program uuid;
  v_day record;
begin
  if not public.is_coach() then
    raise exception 'Only the coach can copy programs';
  end if;

  insert into public.programs (title, description, weeks, is_template, client_id, start_date, status)
  select title, description, weeks, p_as_template, p_client_id, p_start_date, case when p_as_template then 'draft' else p_status end
  from public.programs where id = p_program_id
  returning id into v_new_program;

  if v_new_program is null then
    raise exception 'Program % not found', p_program_id;
  end if;

  for v_day in select * from public.program_days where program_id = p_program_id order by week, day, position loop
    insert into public.program_days (program_id, week, day, position, workout_id)
    values (v_new_program, v_day.week, v_day.day, v_day.position, public.copy_workout(v_day.workout_id, false));
  end loop;

  return v_new_program;
end;
$$;

-- Copies every workout in one week of a program into another week of the same
-- program (added alongside whatever is already there).
create or replace function public.copy_week(p_program_id uuid, p_from_week int, p_to_week int)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_day record;
begin
  if not public.is_coach() then
    raise exception 'Only the coach can copy weeks';
  end if;

  update public.programs set weeks = greatest(weeks, p_to_week) where id = p_program_id;

  for v_day in select * from public.program_days where program_id = p_program_id and week = p_from_week order by day, position loop
    insert into public.program_days (program_id, week, day, position, workout_id)
    values (p_program_id, p_to_week, v_day.day, v_day.position, public.copy_workout(v_day.workout_id, false));
  end loop;
end;
$$;

-- Adds a copy of a workout (usually a template) to a program day.
create or replace function public.add_workout_to_day(p_program_id uuid, p_week int, p_day int, p_workout_id uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_day_id uuid;
begin
  insert into public.program_days (program_id, week, day, position, workout_id)
  values (
    p_program_id, p_week, p_day,
    coalesce((select max(position) + 1 from public.program_days where program_id = p_program_id and week = p_week and day = p_day), 0),
    public.copy_workout(p_workout_id, false)
  )
  returning id into v_day_id;
  return v_day_id;
end;
$$;

-- Only one active program per client: activating one completes the others.
create or replace function public.activate_program(p_program_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_client uuid;
begin
  if not public.is_coach() then
    raise exception 'Only the coach can activate programs';
  end if;
  select client_id into v_client from public.programs where id = p_program_id;
  update public.programs set status = 'completed' where client_id = v_client and status = 'active' and id <> p_program_id;
  update public.programs set status = 'active', start_date = coalesce(start_date, current_date) where id = p_program_id;
end;
$$;

-- ---------- Storage ---------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');
create policy avatars_write_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
