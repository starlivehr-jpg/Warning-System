-- Warning System: profile bootstrap and role-safe access improvements.
create or replace function private.handle_new_warning_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, 'user'), '@', 1)), 'viewer'::public.app_role)
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.handle_new_warning_user() from public, anon, authenticated;
drop trigger if exists on_warning_auth_user_created on auth.users;
create trigger on_warning_auth_user_created after insert on auth.users for each row execute function private.handle_new_warning_user();

drop policy if exists "profiles_hr_read" on public.profiles;
create policy "profiles_hr_read" on public.profiles for select to authenticated
using (private.has_any_role(array['system_admin','hr_officer']::public.app_role[]));

create table if not exists private.warning_bootstrap_tokens (
  id boolean primary key default true check (id = true),
  token_hash text not null,
  created_at timestamptz not null default now()
);
revoke all on table private.warning_bootstrap_tokens from public, anon, authenticated;

create or replace function public.bootstrap_first_warning_admin(p_token text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_expected_hash text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtext('star-live-warning-system-first-admin'));
  select token_hash into v_expected_hash from private.warning_bootstrap_tokens where id = true for update;
  if v_expected_hash is null or v_expected_hash <> encode(extensions.digest(p_token, 'sha256'), 'hex') then
    raise exception 'Invalid or already-used setup token';
  end if;
  if exists (select 1 from public.profiles where role = 'system_admin'::public.app_role) then
    raise exception 'A system administrator already exists';
  end if;
  update public.profiles set role = 'system_admin'::public.app_role, is_active = true, updated_at = now() where id = v_user_id;
  if not found then raise exception 'User profile is not ready. Sign out and sign in again.'; end if;
  delete from private.warning_bootstrap_tokens where id = true;
end;
$$;
revoke all on function public.bootstrap_first_warning_admin(text) from public, anon;
grant execute on function public.bootstrap_first_warning_admin(text) to authenticated;
