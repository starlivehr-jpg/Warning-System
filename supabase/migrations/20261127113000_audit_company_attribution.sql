-- Attribute audit records to the company of the related entity, including RPC-written signatures.
create or replace function private.assign_audit_company_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.company_id is not null then return new; end if;

  if new.entity_type in ('warning_case','warning_cases') then
    select w.company_id into new.company_id
    from public.warning_cases w
    where w.id::text = new.entity_id;
  elsif new.entity_type = 'employees' then
    select e.company_id into new.company_id
    from public.employees e
    where e.id::text = new.entity_id;
  elsif new.entity_type = 'warning_approvals' then
    select w.company_id into new.company_id
    from public.warning_approvals a
    join public.warning_cases w on w.id = a.warning_id
    where a.id::text = new.entity_id;
  end if;

  return new;
end;
$$;

drop trigger if exists audit_logs_company_attribution on public.audit_logs;
create trigger audit_logs_company_attribution
before insert on public.audit_logs
for each row execute function private.assign_audit_company_id();
