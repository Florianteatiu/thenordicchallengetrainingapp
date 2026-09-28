-- ============================================================================
-- Base schema for The Nordic Challenge Training App
--
-- The app was originally built against a hand-made Supabase project whose
-- base tables were never checked into this repo. This file recreates that
-- base (tables, foreign keys, RLS and the original policies) so a brand-new,
-- empty Supabase project can be brought up from scratch.
--
-- Run order on a fresh project:
--   1. supabase/base_schema.sql   (this file)
--   2. supabase/schema.sql        (additive columns, policies, buckets)
--
-- Columns that schema.sql adds later (programs.coach_id, programs.is_active,
-- clients.joined_challenge, ...) are deliberately left out here so that
-- schema.sql stays the single place they're defined.
--
-- Safe to re-run.
-- ============================================================================

create table if not exists public.coaches (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key references auth.users(id) on delete cascade,
  coach_id uuid references public.coaches(id) on delete set null,
  name text not null,
  email text,
  photo_url text,
  xp integer not null default 0,
  streak integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists clients_coach_id_idx on public.clients(coach_id);

-- client_id is nullable: a null client_id is a coach's reusable template
-- (see programs.coach_id in schema.sql).
create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  week_label text,
  title text,
  duration_min integer,
  created_at timestamptz not null default now()
);

create index if not exists programs_client_id_idx on public.programs(client_id);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  name text not null,
  target_sets integer not null default 3,
  target_reps text,
  target_weight_kg numeric not null default 0,
  rest_seconds integer not null default 60,
  cue text,
  alternatives text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists exercises_program_id_idx on public.exercises(program_id);

-- exercise_id has no cascade on purpose: deleting an exercise that already
-- has logged history fails with 23503, which the app surfaces as "this
-- program has logged workout history and can't be deleted".
create table if not exists public.logged_sets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  set_number integer not null,
  weight_kg numeric,
  reps integer,
  logged_at timestamptz not null default now()
);

create index if not exists logged_sets_client_logged_idx on public.logged_sets(client_id, logged_at desc);
create index if not exists logged_sets_exercise_id_idx on public.logged_sets(exercise_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  sender text not null check (sender in ('coach', 'client')),
  text text,
  attachment_url text,
  attachment_type text check (attachment_type in ('image', 'video')),
  created_at timestamptz not null default now()
);

create index if not exists messages_client_created_idx on public.messages(client_id, created_at);

create table if not exists public.mood_checkins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  emoji text,
  label text,
  logged_at timestamptz not null default now()
);

create index if not exists mood_checkins_client_logged_idx on public.mood_checkins(client_id, logged_at desc);

create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  url text not null,
  taken_at timestamptz not null default now()
);

create index if not exists progress_photos_client_idx on public.progress_photos(client_id, taken_at);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

alter table public.coaches enable row level security;
alter table public.clients enable row level security;
alter table public.programs enable row level security;
alter table public.exercises enable row level security;
alter table public.logged_sets enable row level security;
alter table public.messages enable row level security;
alter table public.mood_checkins enable row level security;
alter table public.progress_photos enable row level security;

-- coaches
drop policy if exists "coach sees own row" on public.coaches;
create policy "coach sees own row" on public.coaches
  for select using (id = auth.uid());

drop policy if exists "coach updates own row" on public.coaches;
create policy "coach updates own row" on public.coaches
  for update using (id = auth.uid()) with check (id = auth.uid());

-- clients
drop policy if exists "client sees own row" on public.clients;
create policy "client sees own row" on public.clients
  for select using (id = auth.uid());

drop policy if exists "clients update own row" on public.clients;
create policy "clients update own row" on public.clients
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "coach sees own clients" on public.clients;
create policy "coach sees own clients" on public.clients
  for select using (coach_id = auth.uid());

drop policy if exists "coach updates own clients" on public.clients;
create policy "coach updates own clients" on public.clients
  for update using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- programs / exercises: athletes read their own; the coach-side policies
-- are defined in schema.sql (keyed on programs.coach_id).
drop policy if exists "client sees own programs" on public.programs;
create policy "client sees own programs" on public.programs
  for select using (client_id = auth.uid());

drop policy if exists "client sees own exercises" on public.exercises;
create policy "client sees own exercises" on public.exercises
  for select using (
    exists (select 1 from public.programs p where p.id = exercises.program_id and p.client_id = auth.uid())
  );

-- logged_sets
drop policy if exists "client manages own logged sets" on public.logged_sets;
create policy "client manages own logged sets" on public.logged_sets
  for all using (client_id = auth.uid()) with check (client_id = auth.uid());

drop policy if exists "coach sees client logged sets" on public.logged_sets;
create policy "coach sees client logged sets" on public.logged_sets
  for select using (
    exists (select 1 from public.clients c where c.id = logged_sets.client_id and c.coach_id = auth.uid())
  );

-- messages
drop policy if exists "client reads own messages" on public.messages;
create policy "client reads own messages" on public.messages
  for select using (client_id = auth.uid());

drop policy if exists "client sends own messages" on public.messages;
create policy "client sends own messages" on public.messages
  for insert with check (client_id = auth.uid() and sender = 'client');

drop policy if exists "coach reads client messages" on public.messages;
create policy "coach reads client messages" on public.messages
  for select using (
    exists (select 1 from public.clients c where c.id = messages.client_id and c.coach_id = auth.uid())
  );

drop policy if exists "coach sends client messages" on public.messages;
create policy "coach sends client messages" on public.messages
  for insert with check (
    sender = 'coach'
    and exists (select 1 from public.clients c where c.id = messages.client_id and c.coach_id = auth.uid())
  );

-- mood_checkins
drop policy if exists "client manages own mood checkins" on public.mood_checkins;
create policy "client manages own mood checkins" on public.mood_checkins
  for all using (client_id = auth.uid()) with check (client_id = auth.uid());

drop policy if exists "coach sees client mood checkins" on public.mood_checkins;
create policy "coach sees client mood checkins" on public.mood_checkins
  for select using (
    exists (select 1 from public.clients c where c.id = mood_checkins.client_id and c.coach_id = auth.uid())
  );

-- progress_photos
drop policy if exists "client manages own progress photos" on public.progress_photos;
create policy "client manages own progress photos" on public.progress_photos
  for all using (client_id = auth.uid()) with check (client_id = auth.uid());

drop policy if exists "coach sees client progress photos" on public.progress_photos;
create policy "coach sees client progress photos" on public.progress_photos
  for select using (
    exists (select 1 from public.clients c where c.id = progress_photos.client_id and c.coach_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- Realtime: the chat subscribes to INSERTs on messages.
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
