create or replace function private.bootstrap_first_warning_admin_impl(p_token text)
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
revoke all on function private.bootstrap_first_warning_admin_impl(text) from public, anon;
grant execute on function private.bootstrap_first_warning_admin_impl(text) to authenticated;

create or replace function public.bootstrap_first_warning_admin(p_token text)
returns void language sql security invoker set search_path = ''
as 'select private.bootstrap_first_warning_admin_impl(p_token)';
revoke all on function public.bootstrap_first_warning_admin(text) from public, anon;
grant execute on function public.bootstrap_first_warning_admin(text) to authenticated;
