-- ============================================================================
-- The Nordic Challenge Training App — database schema
--
-- Run this once in your Supabase project's SQL editor (Project → SQL Editor →
-- New query → paste → Run). It is safe to re-run: every statement is
-- idempotent (uses IF NOT EXISTS / CREATE OR REPLACE / drop-then-create for
-- policies).
--
-- After running this, also create three storage buckets (done for you below
-- via inserts into storage.buckets) — no manual dashboard steps needed.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- profiles — one row per auth user, extends auth.users with app data
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client',
  name text not null default '',
  email text,
  avatar_url text,
  coach_id uuid references public.profiles(id) on delete set null,
  xp_base integer not null default 0,
  weekly_target integer not null default 4,
  joined_challenge boolean not null default false,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Backfills these columns onto a "profiles" table that already existed
-- before this script ran (e.g. a leftover from an earlier partial run, or a
-- pre-existing table with a different shape) — CREATE TABLE IF NOT EXISTS
-- above is a no-op in that case, so this is what actually adds them.
alter table public.profiles add column if not exists role text not null default 'client';
alter table public.profiles add column if not exists name text not null default '';
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists coach_id uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists xp_base integer not null default 0;
alter table public.profiles add column if not exists weekly_target integer not null default 4;
alter table public.profiles add column if not exists joined_challenge boolean not null default false;
alter table public.profiles add column if not exists last_active_at timestamptz not null default now();
alter table public.profiles add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table public.profiles add constraint profiles_role_check check (role in ('coach', 'client'));
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- programs — one active training program per client
-- ----------------------------------------------------------------------------
create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  week_label text not null default '',
  title text not null default '',
  duration_min integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- exercises — belong to a program
-- ----------------------------------------------------------------------------
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  name text not null default '',
  target_sets integer not null default 3,
  target_reps text not null default '',
  target_weight numeric not null default 0,
  rest_seconds integer not null default 60,
  cue text not null default '',
  alternatives text[] not null default '{}',
  swapped_to text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- workout_sessions — one per client per calendar day
-- ----------------------------------------------------------------------------
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  program_id uuid references public.programs(id) on delete set null,
  session_date date not null default current_date,
  mood text,
  completed boolean not null default false,
  xp_awarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, session_date)
);

-- ----------------------------------------------------------------------------
-- set_logs — individual set entries + per-exercise notes for a session
-- ----------------------------------------------------------------------------
create table if not exists public.set_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  set_number integer not null,
  weight numeric,
  reps integer,
  done boolean not null default false,
  note text,
  updated_at timestamptz not null default now(),
  unique (session_id, exercise_id, set_number)
);

-- ----------------------------------------------------------------------------
-- messages — direct messages between a coach and one of their clients
-- ----------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  attachment_url text,
  attachment_type text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- ----------------------------------------------------------------------------
-- progress_photos — client-submitted progress photos
-- ----------------------------------------------------------------------------
create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  url text not null,
  taken_at timestamptz not null default now()
);

create index if not exists idx_programs_coach on public.programs(coach_id);
create index if not exists idx_exercises_program on public.exercises(program_id);
create index if not exists idx_sessions_client on public.workout_sessions(client_id);
create index if not exists idx_set_logs_session on public.set_logs(session_id);
create index if not exists idx_set_logs_exercise on public.set_logs(exercise_id);
create index if not exists idx_messages_sender on public.messages(sender_id);
create index if not exists idx_messages_recipient on public.messages(recipient_id);
create index if not exists idx_photos_client on public.progress_photos(client_id);
create index if not exists idx_profiles_coach on public.profiles(coach_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.programs enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.set_logs enable row level security;
alter table public.messages enable row level security;
alter table public.progress_photos enable row level security;

-- ---- profiles ----
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using (
    auth.uid() = id
    or coach_id = auth.uid()
    or role = 'coach'
  );

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- lets a coach toggle things like joined_challenge on their own clients
-- from the coach dashboard's Challenge tracker.
drop policy if exists "profiles_update_by_coach" on public.profiles;
create policy "profiles_update_by_coach" on public.profiles for update
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

-- ---- programs ----
drop policy if exists "programs_select" on public.programs;
create policy "programs_select" on public.programs for select
  using (client_id = auth.uid() or coach_id = auth.uid());

drop policy if exists "programs_insert" on public.programs;
create policy "programs_insert" on public.programs for insert
  with check (coach_id = auth.uid());

drop policy if exists "programs_update" on public.programs;
create policy "programs_update" on public.programs for update
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

drop policy if exists "programs_delete" on public.programs;
create policy "programs_delete" on public.programs for delete
  using (coach_id = auth.uid());

-- ---- exercises ----
drop policy if exists "exercises_select" on public.exercises;
create policy "exercises_select" on public.exercises for select
  using (
    exists (
      select 1 from public.programs p
      where p.id = exercises.program_id
        and (p.coach_id = auth.uid() or p.client_id = auth.uid())
    )
  );

drop policy if exists "exercises_insert" on public.exercises;
create policy "exercises_insert" on public.exercises for insert
  with check (
    exists (select 1 from public.programs p where p.id = exercises.program_id and p.coach_id = auth.uid())
  );

-- coaches can edit everything; clients may only touch their own program's
-- rows (the app UI limits clients to changing swapped_to, but RLS here is
-- row-level, not column-level — both coach and the program's own client can
-- update a row they can see).
drop policy if exists "exercises_update" on public.exercises;
create policy "exercises_update" on public.exercises for update
  using (
    exists (
      select 1 from public.programs p
      where p.id = exercises.program_id
        and (p.coach_id = auth.uid() or p.client_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.programs p
      where p.id = exercises.program_id
        and (p.coach_id = auth.uid() or p.client_id = auth.uid())
    )
  );

drop policy if exists "exercises_delete" on public.exercises;
create policy "exercises_delete" on public.exercises for delete
  using (
    exists (select 1 from public.programs p where p.id = exercises.program_id and p.coach_id = auth.uid())
  );

-- ---- workout_sessions ----
drop policy if exists "sessions_select" on public.workout_sessions;
create policy "sessions_select" on public.workout_sessions for select
  using (
    client_id = auth.uid()
    or exists (select 1 from public.profiles pr where pr.id = workout_sessions.client_id and pr.coach_id = auth.uid())
  );

drop policy if exists "sessions_insert" on public.workout_sessions;
create policy "sessions_insert" on public.workout_sessions for insert
  with check (client_id = auth.uid());

drop policy if exists "sessions_update" on public.workout_sessions;
create policy "sessions_update" on public.workout_sessions for update
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

-- ---- set_logs ----
drop policy if exists "set_logs_select" on public.set_logs;
create policy "set_logs_select" on public.set_logs for select
  using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = set_logs.session_id
        and (
          s.client_id = auth.uid()
          or exists (select 1 from public.profiles pr where pr.id = s.client_id and pr.coach_id = auth.uid())
        )
    )
  );

drop policy if exists "set_logs_insert" on public.set_logs;
create policy "set_logs_insert" on public.set_logs for insert
  with check (
    exists (select 1 from public.workout_sessions s where s.id = set_logs.session_id and s.client_id = auth.uid())
  );

drop policy if exists "set_logs_update" on public.set_logs;
create policy "set_logs_update" on public.set_logs for update
  using (
    exists (select 1 from public.workout_sessions s where s.id = set_logs.session_id and s.client_id = auth.uid())
  )
  with check (
    exists (select 1 from public.workout_sessions s where s.id = set_logs.session_id and s.client_id = auth.uid())
  );

-- ---- messages ----
drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages for insert
  with check (
    sender_id = auth.uid()
    and (
      recipient_id = (select coach_id from public.profiles where id = auth.uid())
      or recipient_id in (select id from public.profiles where coach_id = auth.uid())
    )
  );

drop policy if exists "messages_update" on public.messages;
create policy "messages_update" on public.messages for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- ---- progress_photos ----
drop policy if exists "photos_select" on public.progress_photos;
create policy "photos_select" on public.progress_photos for select
  using (
    client_id = auth.uid()
    or exists (select 1 from public.profiles pr where pr.id = progress_photos.client_id and pr.coach_id = auth.uid())
  );

drop policy if exists "photos_insert" on public.progress_photos;
create policy "photos_insert" on public.progress_photos for insert
  with check (client_id = auth.uid());

drop policy if exists "photos_delete" on public.progress_photos;
create policy "photos_delete" on public.progress_photos for delete
  using (client_id = auth.uid());

-- ============================================================================
-- Storage buckets + policies
-- avatars: profile photos (readable by anyone, writable by owner)
-- progress-photos: private, readable by owner + their coach
-- message-attachments: private, readable by sender + recipient
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', false)
on conflict (id) do nothing;

-- avatars: path convention "<user_id>/<filename>"
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_write" on storage.objects;
create policy "avatars_owner_write" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- progress-photos: path convention "<client_id>/<filename>"
drop policy if exists "progress_photos_read" on storage.objects;
create policy "progress_photos_read" on storage.objects for select
  using (
    bucket_id = 'progress-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.profiles pr
        where pr.id::text = (storage.foldername(name))[1]
          and pr.coach_id = auth.uid()
      )
    )
  );

drop policy if exists "progress_photos_write" on storage.objects;
create policy "progress_photos_write" on storage.objects for insert
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "progress_photos_delete" on storage.objects;
create policy "progress_photos_delete" on storage.objects for delete
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- message-attachments: path convention "<sender_id>/<filename>"; readable by
-- anyone who is part of a coach/client relationship with the sender (simplest
-- safe approximation: sender, sender's coach, or sender's clients).
drop policy if exists "message_attachments_read" on storage.objects;
create policy "message_attachments_read" on storage.objects for select
  using (
    bucket_id = 'message-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.profiles me
        where me.id = auth.uid()
          and (
            me.coach_id::text = (storage.foldername(name))[1]
            or (storage.foldername(name))[1] in (
              select id::text from public.profiles where coach_id = auth.uid()
            )
          )
      )
    )
  );

drop policy if exists "message_attachments_write" on storage.objects;
create policy "message_attachments_write" on storage.objects for insert
  with check (bucket_id = 'message-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
