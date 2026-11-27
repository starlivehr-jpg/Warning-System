-- Backward-compatible defaults keep the currently deployed UI operational during rollout.
do $$
declare
  v_star uuid;
begin
  select id into v_star from public.companies where company_code='STARLIVE';
  if v_star is null then raise exception 'STARLIVE company seed missing'; end if;
  execute format('alter table public.employees alter column company_id set default %L::uuid', v_star);
  execute format('alter table public.departments alter column company_id set default %L::uuid', v_star);
  execute format('alter table public.warning_cases alter column company_id set default %L::uuid', v_star);
  execute format('alter table public.profiles alter column default_company_id set default %L::uuid', v_star);
end;
$$;

create or replace function private.assign_default_company_to_new_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_star uuid;
begin
  select id into v_star from public.companies where company_code='STARLIVE';
  if new.default_company_id is null then
    new.default_company_id := v_star;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_default_company_before_insert on public.profiles;
create trigger profiles_default_company_before_insert
before insert on public.profiles
for each row execute function private.assign_default_company_to_new_profile();

create or replace function private.grant_default_company_to_new_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.default_company_id is not null then
    insert into public.user_company_access(profile_id,company_id)
    values(new.id,new.default_company_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_default_company_access_after_insert on public.profiles;
create trigger profiles_default_company_access_after_insert
after insert on public.profiles
for each row execute function private.grant_default_company_to_new_profile();
