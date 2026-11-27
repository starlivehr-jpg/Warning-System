-- Defense in depth: SECURITY DEFINER signature RPCs must not bypass company membership.
create or replace function private.guard_warning_signature_company_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or new.signer_id is distinct from auth.uid() then
    raise exception 'Authenticated signer identity is required';
  end if;
  if new.company_id is null or not private.has_company_access(new.company_id) then
    raise exception 'No access to the company for this warning';
  end if;
  return new;
end;
$$;

drop trigger if exists warning_signatures_z_company_access_guard on public.warning_signatures;
create trigger warning_signatures_z_company_access_guard
before insert on public.warning_signatures
for each row execute function private.guard_warning_signature_company_access();
