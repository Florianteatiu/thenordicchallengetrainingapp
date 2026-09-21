-- ============================================================================
-- Additive fixes for The Nordic Challenge Training App
--
-- Your Supabase project already has its own hand-built schema — coaches,
-- clients, programs, exercises, logged_sets, messages, mood_checkins,
-- progress_photos — with Row Level Security already enabled and policies
-- already in place. This script does NOT recreate or touch any of that.
--
-- It only adds the two things that were missing for the app to actually
-- work:
--   1. A policy letting a newly-signed-up athlete create their own row in
--      `clients` (there was no INSERT policy on `clients` or `coaches` at
--      all, so no account of either kind could ever be created from the
--      app). Deliberately NOT added for `coaches` — see README for how the
--      one coach account gets created (once, by hand).
--   2. The three storage buckets the app needs (avatars, progress-photos,
--      message-attachments), with policies scoped to the real
--      coaches/clients tables.
--
-- It also now adds:
--   3. A nullable `coach_id` column on `programs`, so a coach can build a
--      reusable "template" program (client_id left null) before any client
--      exists, then assign a copy of it to a client later. The existing
--      coach-side policies on `programs` and `exercises` only reached a
--      program through its client_id -> clients.coach_id chain, which can't
--      resolve when client_id is null, so those two policies are replaced
--      with equivalents keyed on the new coach_id column instead. The
--      client-side "see my own program/exercises" policies are untouched.
--
-- Safe to re-run.
-- ============================================================================

drop policy if exists "clients_insert_self" on public.clients;
create policy "clients_insert_self" on public.clients
  for insert
  with check (auth.uid() = id);

-- The existing "coach sees own row" policy only lets a coach see themselves —
-- there was no way for a CLIENT to read their own coach's name/email, which
-- the app's "Coach" tab needs. Scoped narrowly: only the coach a client is
-- actually linked to, not the whole coaches table.
drop policy if exists "clients_see_own_coach" on public.coaches;
create policy "clients_see_own_coach" on public.coaches
  for select
  using (id in (select coach_id from public.clients where id = auth.uid()));

-- ----------------------------------------------------------------------------
-- Coach phone number: `coaches` had no column for it, so the app's "Call"
-- button on the athlete's Coach tab had a hardcoded placeholder number.
-- No new policy needed — the existing "coach sees/updates own row" and
-- "clients_see_own_coach" policies already select/update every column.
-- ----------------------------------------------------------------------------

alter table public.coaches add column if not exists phone text;

-- ----------------------------------------------------------------------------
-- Challenge join status: `clients` had no column for it, so "I'm in" on the
-- athlete's Home tab was session-only UI state that reset on every reload
-- and never reached the coach dashboard. No new policy needed — the
-- existing "clients update own row" and "coach sees own clients" policies
-- already cover every column.
-- ----------------------------------------------------------------------------

alter table public.clients add column if not exists joined_challenge boolean not null default false;

-- ----------------------------------------------------------------------------
-- Which program is "current": a client can have several programs (a coach
-- can build one without disturbing what their client currently sees), and
-- exactly one of them should be the one the athlete app actually shows.
-- Previously this was just "whichever was created most recently," which
-- meant creating any new program — even just to try something out — silently
-- replaced what the client saw. No new policy needed.
-- ----------------------------------------------------------------------------

alter table public.programs add column if not exists is_active boolean not null default false;

-- Backfill: mark each client's most-recently-created program active, since
-- that's the one "most recently created wins" was already showing them —
-- this preserves current behavior for every existing assignment instead of
-- silently leaving all of them inactive.
update public.programs p
set is_active = true
where p.client_id is not null
  and p.created_at = (
    select max(p2.created_at) from public.programs p2 where p2.client_id = p.client_id
  );

-- ----------------------------------------------------------------------------
-- Program templates: coach_id on programs, so a program can exist before any
-- client is assigned to it.
-- ----------------------------------------------------------------------------

alter table public.programs add column if not exists coach_id uuid references public.coaches(id) on delete cascade;

-- Backfill coach_id on any existing (already-assigned) programs from their
-- client's coach, so nothing already in use loses coach access.
update public.programs p
set coach_id = c.coach_id
from public.clients c
where p.client_id = c.id
  and p.coach_id is null;

drop policy if exists "coach manages client programs" on public.programs;
drop policy if exists "coach_manages_own_programs" on public.programs;
create policy "coach_manages_own_programs" on public.programs
  for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

drop policy if exists "coach manages client exercises" on public.exercises;
drop policy if exists "coach_manages_own_exercises" on public.exercises;
create policy "coach_manages_own_exercises" on public.exercises
  for all
  using (exists (select 1 from public.programs p where p.id = exercises.program_id and p.coach_id = auth.uid()))
  with check (exists (select 1 from public.programs p where p.id = exercises.program_id and p.coach_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- Storage buckets
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', false)
on conflict (id) do nothing;

-- avatars: path "<client_id>/avatar.<ext>" — world-readable, owner-writable
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

-- progress-photos: path "<client_id>/<filename>" — readable by that client
-- and their coach, writable by the client
drop policy if exists "progress_photos_read" on storage.objects;
create policy "progress_photos_read" on storage.objects for select
  using (
    bucket_id = 'progress-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.clients c
        where c.id::text = (storage.foldername(name))[1]
          and c.coach_id = auth.uid()
      )
    )
  );

drop policy if exists "progress_photos_write" on storage.objects;
create policy "progress_photos_write" on storage.objects for insert
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "progress_photos_delete" on storage.objects;
create policy "progress_photos_delete" on storage.objects for delete
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- message-attachments: path "<client_id>/<filename>" — client_id here is the
-- conversation this message belongs to, regardless of whether the coach or
-- the client sent it — readable/writable by that client or their coach.
drop policy if exists "message_attachments_rw" on storage.objects;
create policy "message_attachments_rw" on storage.objects for all
  using (
    bucket_id = 'message-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.clients c
        where c.id::text = (storage.foldername(name))[1]
          and c.coach_id = auth.uid()
      )
    )
  )
  with check (
    bucket_id = 'message-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.clients c
        where c.id::text = (storage.foldername(name))[1]
          and c.coach_id = auth.uid()
      )
    )
  );
