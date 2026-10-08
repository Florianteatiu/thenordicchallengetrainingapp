-- New sign-ups wait for Florian's approval (only paying clients get in).
-- approved_at is set by the coach through approve_client(); clients can't
-- touch it (it isn't in the profile columns they may update). Until then the
-- app shows a waiting screen and the database refuses their messages,
-- check-ins, activities and uploads.

alter table public.profiles add column if not exists approved_at timestamptz;

-- Everyone already using the app is approved.
update public.profiles set approved_at = coalesce(created_at, now()) where approved_at is null;

create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and (approved_at is not null or role = 'coach'));
$$;

-- Approve (p_approve = true) or decline / revoke (false: also archives).
create or replace function public.approve_client(p_client_id uuid, p_approve boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
begin
  if not public.is_coach() then
    raise exception 'Only the coach can approve clients';
  end if;
  update public.profiles
  set approved_at = case when p_approve then coalesce(approved_at, now()) else null end,
      archived = not p_approve
  where id = p_client_id and role = 'client'
  returning * into result;
  return result;
end;
$$;

revoke execute on function public.approve_client(uuid, boolean) from public, anon;
grant execute on function public.approve_client(uuid, boolean) to authenticated;

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and (public.is_coach() or (client_id = auth.uid() and public.is_approved())));

drop policy if exists checkins_insert on public.checkins;
create policy checkins_insert on public.checkins for insert to authenticated
  with check (client_id = auth.uid() and public.is_approved());

drop policy if exists activities_write on public.activities;
create policy activities_write on public.activities for all to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid() and public.is_approved());

drop policy if exists client_files_insert on storage.objects;
create policy client_files_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('voice-notes', 'checkin-photos')
              and (public.is_coach() or ((storage.foldername(objects.name))[1] = auth.uid()::text and public.is_approved())));
