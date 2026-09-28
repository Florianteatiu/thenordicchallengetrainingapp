-- =============================================================================
-- Phase 2: coaching features
--
--   * messages        coach <-> client chat: text, voice notes, and comments
--                     pinned to a logged set or a whole workout
--   * checkins        the weekly check-in form + the coach's reply
--   * activities      runs / rides / swims that move a client across Sweden
--   * push_subscriptions + reminder_log   push notifications
--   * profiles.onboarded_at   welcome flow done
--   * exercises.journey_kind  exercises whose logged distance counts on the map
-- =============================================================================

-- ---------- Profiles & exercises --------------------------------------------

alter table public.profiles add column if not exists onboarded_at timestamptz;
grant update (onboarded_at) on public.profiles to authenticated;

-- The coach never goes through the client welcome flow.
update public.profiles set onboarded_at = now() where role = 'coach' and onboarded_at is null;

alter table public.exercises add column if not exists journey_kind text
  check (journey_kind in ('run', 'bike', 'swim'));

update public.exercises set journey_kind = 'run' where lower(name) in ('run', 'interval run') and journey_kind is null;
update public.exercises set journey_kind = 'bike' where lower(name) = 'cycling' and journey_kind is null;
update public.exercises set journey_kind = 'swim' where lower(name) = 'swim' and journey_kind is null;

-- ---------- Messages ----------------------------------------------------------

-- One conversation per client (client_id). sender_id is whoever wrote it.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text,
  audio_path text,
  audio_duration_sec int,
  -- Optional context: a comment on a specific logged set, or on a workout.
  session_id uuid references public.workout_sessions (id) on delete set null,
  set_log_id uuid references public.set_logs (id) on delete set null,
  context_label text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (coalesce(nullif(trim(body), ''), audio_path) is not null)
);
create index messages_client_idx on public.messages (client_id, created_at);

alter table public.messages enable row level security;

create policy messages_select on public.messages for select to authenticated
  using (client_id = auth.uid() or public.is_coach());
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and (client_id = auth.uid() or public.is_coach()));
create policy messages_delete_own on public.messages for delete to authenticated
  using (sender_id = auth.uid());

-- Marks everything the other side sent in a conversation as read.
create or replace function public.mark_messages_read(p_client_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.messages
  set read_at = now()
  where client_id = p_client_id
    and read_at is null
    and sender_id <> auth.uid()
    and (p_client_id = auth.uid() or public.is_coach());
$$;

alter publication supabase_realtime add table public.messages;

-- ---------- Weekly check-ins ------------------------------------------------

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  week_start date not null,          -- Monday of the week being reported on
  sleep int check (sleep between 1 and 5),
  energy int check (energy between 1 and 5),
  stress int check (stress between 1 and 5),
  nutrition int check (nutrition between 1 and 5),
  bodyweight_kg numeric(5, 1) check (bodyweight_kg between 20 and 400),
  wins text,
  struggles text,
  notes text,
  photo_paths text[] not null default '{}',
  coach_reply text,
  coach_replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, week_start)
);

alter table public.checkins enable row level security;

create policy checkins_select on public.checkins for select to authenticated
  using (client_id = auth.uid() or public.is_coach());
create policy checkins_insert on public.checkins for insert to authenticated
  with check (client_id = auth.uid());
create policy checkins_update on public.checkins for update to authenticated
  using (client_id = auth.uid() or public.is_coach())
  with check (client_id = auth.uid() or public.is_coach());

-- The client fills in the form; only the coach writes the reply, and the coach
-- can't rewrite what the client answered.
create or replace function public.guard_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reply text;
begin
  if public.is_coach() and tg_op = 'UPDATE' then
    v_reply := nullif(trim(new.coach_reply), '');
    new := old;
    new.coach_reply := v_reply;
    new.coach_replied_at := case when v_reply is null then null else now() end;
  elsif tg_op = 'INSERT' then
    new.coach_reply := null;
    new.coach_replied_at := null;
  else
    new.client_id := old.client_id;
    new.week_start := old.week_start;
    new.coach_reply := old.coach_reply;
    new.coach_replied_at := old.coach_replied_at;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger checkins_guard before insert or update on public.checkins
  for each row execute function public.guard_checkin();

-- ---------- Cross Sweden journey -------------------------------------------

-- Run: Stockholm -> Gothenburg (513 km). Bike: Malmo -> Stockholm (695 km).
-- Swim: Gothenburg -> Malmo (240 km). Distance logged in workouts on an
-- exercise with a journey_kind counts too (see journey_totals).
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('run', 'bike', 'swim')),
  distance_km numeric(6, 2) not null check (distance_km > 0 and distance_km <= 500),
  duration_sec int check (duration_sec > 0),
  activity_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);
create index activities_client_idx on public.activities (client_id, activity_date desc);

alter table public.activities enable row level security;

create policy activities_select on public.activities for select to authenticated
  using (client_id = auth.uid() or public.is_coach());
create policy activities_write on public.activities for all to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());

-- Kilometres per discipline for one client: logged activities + distance
-- logged in workouts on run/bike/swim exercises.
create or replace function public.journey_totals(p_client_id uuid)
returns table (kind text, km numeric)
language sql
stable
security definer
set search_path = public
as $$
  select kind, round(sum(km), 2) as km
  from (
    select a.kind, a.distance_km as km
    from public.activities a
    where a.client_id = p_client_id
    union all
    select e.journey_kind, sl.distance_m / 1000.0
    from public.set_logs sl
    join public.workout_sessions s on s.id = sl.session_id
    join public.exercises e on e.id = sl.exercise_id
    where s.client_id = p_client_id and e.journey_kind is not null and sl.distance_m > 0
  ) t
  where p_client_id = auth.uid() or public.is_coach()
  group by kind;
$$;

-- ---------- Push notifications ---------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- One training-day reminder per client per day (written by the notify
-- function with the service role; nobody reads it through the API).
create table public.reminder_log (
  client_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  primary key (client_id, day)
);
alter table public.reminder_log enable row level security;

-- ---------- Storage ---------------------------------------------------------

-- Private buckets, one folder per client: "<client_id>/<file>". The client
-- reads and writes their own folder; the coach reads and writes everyone's.
insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', false), ('checkin-photos', 'checkin-photos', false)
on conflict (id) do nothing;

create policy client_files_select on storage.objects for select to authenticated
  using (bucket_id in ('voice-notes', 'checkin-photos')
         and ((storage.foldername(objects.name))[1] = auth.uid()::text or public.is_coach()));
create policy client_files_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('voice-notes', 'checkin-photos')
              and ((storage.foldername(objects.name))[1] = auth.uid()::text or public.is_coach()));
create policy client_files_delete on storage.objects for delete to authenticated
  using (bucket_id in ('voice-notes', 'checkin-photos')
         and ((storage.foldername(objects.name))[1] = auth.uid()::text or public.is_coach()));

-- Exercise demo videos: public to watch, only the coach uploads.
insert into storage.buckets (id, name, public)
values ('exercise-videos', 'exercise-videos', true)
on conflict (id) do nothing;

create policy exercise_videos_read on storage.objects for select
  using (bucket_id = 'exercise-videos');
create policy exercise_videos_coach on storage.objects for all to authenticated
  using (bucket_id = 'exercise-videos' and public.is_coach())
  with check (bucket_id = 'exercise-videos' and public.is_coach());
