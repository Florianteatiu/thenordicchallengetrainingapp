-- Coach-driven password reset, so a client who forgot their password can get
-- back in without any email being sent. The coach sets a temporary password;
-- on their next sign-in the client is asked to choose their own.

alter table public.profiles add column if not exists must_change_password boolean not null default false;

create or replace function public.coach_reset_password(p_client_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_coach() then
    raise exception 'Only the coach can reset passwords';
  end if;
  if not exists (select 1 from public.profiles where id = p_client_id and role = 'client') then
    raise exception 'Client not found';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'The temporary password must be at least 8 characters';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = p_client_id;

  -- Sign the client out everywhere, so only the new password works from now on.
  delete from auth.sessions where user_id = p_client_id;
  delete from auth.refresh_tokens where user_id = p_client_id::text;

  update public.profiles set must_change_password = true where id = p_client_id;
end;
$$;

-- Called by the client right after choosing their own password.
create or replace function public.password_changed()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;

revoke execute on function public.coach_reset_password(uuid, text) from public, anon;
revoke execute on function public.password_changed() from public, anon;
grant execute on function public.coach_reset_password(uuid, text) to authenticated;
grant execute on function public.password_changed() to authenticated;
