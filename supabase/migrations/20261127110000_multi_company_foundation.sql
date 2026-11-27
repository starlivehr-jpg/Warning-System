-- Multi-company foundation for Warning System PRO.
-- Additive migration: preserve all existing records and map legacy rows to STAR LIVE ONLINE.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  company_code text not null unique,
  company_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.companies(company_code, company_name)
values
  ('STARLIVE', 'STAR LIVE ONLINE CO., LTD.'),
  ('IAMDP', 'IAMDP CO., LTD.'),
  ('LUMERICX', 'LUMERICX BIOTECHNOLOGY CO., LTD.'),
  ('FLYINGFISH', 'FLYING FISH E-COMMERCE (THAILAND) CO., LTD.'),
  ('THAITELI', 'THAITELI SUPPLY CHAIN CO., LTD.')
on conflict (company_code) do update
set company_name = excluded.company_name, updated_at = now();

create table if not exists public.user_company_access (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, company_id)
);

alter table public.profiles
  add column if not exists default_company_id uuid references public.companies(id) on delete set null;

alter table public.departments
  add column if not exists company_id uuid references public.companies(id);
alter table public.employees
  add column if not exists company_id uuid references public.companies(id);
alter table public.warning_cases
  add column if not exists company_id uuid references public.companies(id);
alter table public.warning_attachments
  add column if not exists company_id uuid references public.companies(id);
alter table public.warning_signatures
  add column if not exists company_id uuid references public.companies(id);
alter table public.audit_logs
  add column if not exists company_id uuid references public.companies(id);

update public.profiles
set default_company_id = (select id from public.companies where company_code='STARLIVE')
where default_company_id is null;

update public.departments
set company_id = (select id from public.companies where company_code='STARLIVE')
where company_id is null;
update public.employees
set company_id = (select id from public.companies where company_code='STARLIVE')
where company_id is null;
update public.warning_cases
set company_id = (select id from public.companies where company_code='STARLIVE')
where company_id is null;

update public.warning_attachments a
set company_id = w.company_id
from public.warning_cases w
where a.warning_id = w.id and a.company_id is null;
update public.warning_signatures s
set company_id = w.company_id
from public.warning_cases w
where s.warning_id = w.id and s.company_id is null;

update public.audit_logs a
set company_id = case
  when a.entity_type = 'employees' then (select e.company_id from public.employees e where e.id::text=a.entity_id)
  when a.entity_type = 'warning_cases' then (select w.company_id from public.warning_cases w where w.id::text=a.entity_id)
  when a.entity_type = 'warning_approvals' then (
    select w.company_id from public.warning_approvals ap
    join public.warning_cases w on w.id=ap.warning_id
    where ap.id::text=a.entity_id
  )
  else null
end
where a.company_id is null;

update public.profiles p
set default_company_id = (select c.id from public.companies c where c.company_code='STARLIVE')
where p.default_company_id is null;

insert into public.user_company_access(profile_id, company_id)
select p.id, c.id
from public.profiles p
cross join public.companies c
where p.is_active = true and c.company_code='STARLIVE'
on conflict do nothing;

alter table public.departments alter column company_id set not null;
alter table public.employees alter column company_id set not null;
alter table public.warning_cases alter column company_id set not null;
alter table public.warning_attachments alter column company_id set not null;
alter table public.warning_signatures alter column company_id set not null;

create index if not exists user_company_access_company_idx on public.user_company_access(company_id, profile_id);
create index if not exists employees_company_status_idx on public.employees(company_id, status);
create index if not exists departments_company_idx on public.departments(company_id);
create index if not exists warning_cases_company_created_idx on public.warning_cases(company_id, created_at desc);
create index if not exists warning_attachments_company_idx on public.warning_attachments(company_id, warning_id);
create index if not exists warning_signatures_company_idx on public.warning_signatures(company_id, warning_id);

create or replace function private.current_company_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.companies c
  where c.is_active = true
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active = true
        and (
          p.role::text = 'system_admin'
          or exists (
            select 1 from public.user_company_access a
            where a.profile_id = p.id and a.company_id = c.id
          )
        )
    );
$$;

create or replace function private.has_company_access(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.companies c
    join public.profiles p on p.id = auth.uid() and p.is_active = true
    where c.id = p_company_id and c.is_active = true
      and (
        p.role::text = 'system_admin'
        or exists (
          select 1 from public.user_company_access a
          where a.profile_id = p.id and a.company_id = c.id
        )
      )
  );
$$;

revoke all on function private.current_company_ids() from public, anon;
revoke all on function private.has_company_access(uuid) from public, anon;
grant execute on function private.current_company_ids() to authenticated;
grant execute on function private.has_company_access(uuid) to authenticated;

alter table public.companies enable row level security;
alter table public.user_company_access enable row level security;
drop policy if exists companies_select_authorized on public.companies;
create policy companies_select_authorized on public.companies
for select to authenticated using (private.has_company_access(id));

drop policy if exists company_access_select_authorized on public.user_company_access;
create policy company_access_select_authorized on public.user_company_access
for select to authenticated
using (profile_id = (select auth.uid()) or private.has_any_role(array['system_admin']::public.app_role[]));

drop policy if exists company_access_admin_manage on public.user_company_access;
create policy company_access_admin_manage on public.user_company_access
for all to authenticated
using (private.has_any_role(array['system_admin']::public.app_role[]))
with check (private.has_any_role(array['system_admin']::public.app_role[]));

grant select on public.companies to authenticated;
grant select on public.user_company_access to authenticated;
grant insert, update, delete on public.user_company_access to authenticated;

-- Company-scoped employee and department visibility.
drop policy if exists employees_select_authorized on public.employees;
create policy employees_select_authorized on public.employees
for select to authenticated
using (
  private.has_company_access(company_id)
  and exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.is_active=true
      and (
        p.role::text in ('system_admin','hr_officer','approver','viewer','supervisor','hr_manager','executive')
        or (p.role::text='employee' and p.employee_id=employees.id)
      )
  )
);
drop policy if exists employees_hr_insert on public.employees;
create policy employees_hr_insert on public.employees
for insert to authenticated
with check (
  private.has_company_access(company_id)
  and private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
);
drop policy if exists employees_hr_update on public.employees;
create policy employees_hr_update on public.employees
for update to authenticated
using (private.has_company_access(company_id) and private.has_any_role(array['system_admin','hr_officer']::public.app_role[]))
with check (private.has_company_access(company_id) and private.has_any_role(array['system_admin','hr_officer']::public.app_role[]));
drop policy if exists employees_hr_delete on public.employees;
create policy employees_hr_delete on public.employees
for delete to authenticated
using (private.has_company_access(company_id) and private.has_any_role(array['system_admin','hr_officer']::public.app_role[]));

drop policy if exists departments_select_authenticated on public.departments;
create policy departments_select_authenticated on public.departments
for select to authenticated
using (private.has_company_access(company_id) and private.current_app_role() is not null);
drop policy if exists departments_hr_insert on public.departments;
create policy departments_hr_insert on public.departments
for insert to authenticated
with check (private.has_company_access(company_id) and private.has_any_role(array['system_admin','hr_officer']::public.app_role[]));
drop policy if exists departments_hr_update on public.departments;
create policy departments_hr_update on public.departments
for update to authenticated
using (private.has_company_access(company_id) and private.has_any_role(array['system_admin','hr_officer']::public.app_role[]))
with check (private.has_company_access(company_id) and private.has_any_role(array['system_admin','hr_officer']::public.app_role[]));
drop policy if exists departments_hr_delete on public.departments;
create policy departments_hr_delete on public.departments
for delete to authenticated
using (private.has_company_access(company_id) and private.has_any_role(array['system_admin','hr_officer']::public.app_role[]));

-- Company-scope warning documents and assigned approval actions.
drop policy if exists warnings_read_authorized on public.warning_cases;
create policy warnings_read_authorized on public.warning_cases
for select to authenticated
using (
  private.has_company_access(company_id)
  and exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.is_active=true
      and (
        p.role::text in ('system_admin','hr_officer','approver','viewer','supervisor','hr_manager','executive')
        or (p.role::text='employee' and p.employee_id=warning_cases.employee_id)
      )
  )
);

drop policy if exists warnings_authorized_insert on public.warning_cases;
create policy warnings_authorized_insert on public.warning_cases
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_company_access(company_id)
  and exists (
    select 1 from public.employees e
    where e.id=warning_cases.employee_id and e.company_id=warning_cases.company_id
  )
  and (
    private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
    or (
      (select p.role::text from public.profiles p where p.id=(select auth.uid()) and p.is_active=true)='supervisor'
      and warning_level='verbal'
    )
  )
);

drop policy if exists warnings_hr_update on public.warning_cases;
create policy warnings_hr_update on public.warning_cases
for update to authenticated
using (private.has_company_access(company_id) and private.has_any_role(array['system_admin','hr_officer']::public.app_role[]))
with check (private.has_company_access(company_id) and private.has_any_role(array['system_admin','hr_officer']::public.app_role[]));

drop policy if exists attachments_select_authorized on public.warning_attachments;
create policy attachments_select_authorized on public.warning_attachments
for select to authenticated
using (
  private.has_company_access(company_id)
  and (
    private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
    or exists (
      select 1 from public.warning_approvals a
      where a.warning_id=warning_attachments.warning_id and a.approver_id=(select auth.uid())
    )
  )
);
drop policy if exists attachments_hr_insert on public.warning_attachments;
create policy attachments_hr_insert on public.warning_attachments
for insert to authenticated
with check (
  private.has_company_access(company_id)
  and private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
  and uploaded_by=(select auth.uid())
  and exists (
    select 1 from public.warning_cases w
    where w.id=warning_attachments.warning_id and w.company_id=warning_attachments.company_id
  )
);
drop policy if exists attachments_hr_update on public.warning_attachments;
create policy attachments_hr_update on public.warning_attachments
for update to authenticated
using (private.has_company_access(company_id) and private.has_any_role(array['system_admin','hr_officer']::public.app_role[]))
with check (
  private.has_company_access(company_id)
  and private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
  and uploaded_by=(select auth.uid())
);
drop policy if exists attachments_hr_delete on public.warning_attachments;
create policy attachments_hr_delete on public.warning_attachments
for delete to authenticated
using (private.has_company_access(company_id) and private.has_any_role(array['system_admin','hr_officer']::public.app_role[]));

drop policy if exists approvals_select_authorized on public.warning_approvals;
create policy approvals_select_authorized on public.warning_approvals
for select to authenticated
using (
  exists (
    select 1 from public.warning_cases w
    where w.id=warning_approvals.warning_id
      and private.has_company_access(w.company_id)
  )
  and (
    approver_id=(select auth.uid())
    or private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
  )
);
drop policy if exists approvals_hr_insert on public.warning_approvals;
create policy approvals_hr_insert on public.warning_approvals
for insert to authenticated
with check (
  private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
  and exists (
    select 1 from public.warning_cases w
    where w.id=warning_approvals.warning_id
      and private.has_company_access(w.company_id)
  )
);
drop policy if exists approvals_assigned_update on public.warning_approvals;
create policy approvals_assigned_update on public.warning_approvals
for update to authenticated
using (
  (approver_id=(select auth.uid()) or private.has_any_role(array['system_admin']::public.app_role[]))
  and exists (
    select 1 from public.warning_cases w
    where w.id=warning_approvals.warning_id
      and private.has_company_access(w.company_id)
  )
)
with check (
  (approver_id=(select auth.uid()) or private.has_any_role(array['system_admin']::public.app_role[]))
  and exists (
    select 1 from public.warning_cases w
    where w.id=warning_approvals.warning_id
      and private.has_company_access(w.company_id)
  )
);

-- Child records inherit the company of their warning and cannot be moved across companies.
create or replace function private.sync_warning_child_company_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  select w.company_id into v_company_id
  from public.warning_cases w
  where w.id = new.warning_id;

  if v_company_id is null then
    raise exception 'Parent warning company is required';
  end if;
  if new.company_id is not null and new.company_id is distinct from v_company_id then
    raise exception 'Child record company must match its warning';
  end if;
  new.company_id := v_company_id;
  return new;
end;
$$;

drop trigger if exists warning_attachments_company_sync on public.warning_attachments;
create trigger warning_attachments_company_sync
before insert or update of warning_id, company_id on public.warning_attachments
for each row execute function private.sync_warning_child_company_id();

drop trigger if exists warning_signatures_company_sync on public.warning_signatures;
create trigger warning_signatures_company_sync
before insert or update of warning_id, company_id on public.warning_signatures
for each row execute function private.sync_warning_child_company_id();

-- Keep company attribution on audit events generated by database triggers.
create or replace function private.write_warning_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text;
  v_row jsonb;
  v_company_id uuid;
begin
  if tg_op = 'DELETE' then
    v_id := old.id::text;
    v_row := to_jsonb(old);
  else
    v_id := new.id::text;
    v_row := to_jsonb(new);
  end if;

  if tg_table_name = 'warning_approvals' then
    select w.company_id into v_company_id
    from public.warning_cases w
    where w.id = (v_row->>'warning_id')::uuid;
  else
    v_company_id := nullif(v_row->>'company_id','')::uuid;
  end if;

  insert into public.audit_logs(company_id, actor_id, action, entity_type, entity_id, details)
  values (v_company_id, auth.uid(), lower(tg_op), tg_table_name, v_id, jsonb_build_object('source','database_trigger'));

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop policy if exists audit_logs_read_admin_hr on public.audit_logs;
create policy audit_logs_read_admin_hr on public.audit_logs
for select to authenticated
using (
  private.has_any_role(array['system_admin']::public.app_role[])
  or (
    private.has_any_role(array['hr_officer']::public.app_role[])
    and company_id is not null
    and private.has_company_access(company_id)
  )
);

-- Company scope is part of the signed-document identity and cannot change after signing.
create or replace function private.prevent_signed_warning_document_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.warning_signatures s where s.warning_id=old.id)
    and (
      new.company_id is distinct from old.company_id
      or new.case_number is distinct from old.case_number
      or new.employee_id is distinct from old.employee_id
      or new.incident_date is distinct from old.incident_date
      or new.incident_time is distinct from old.incident_time
      or new.incident_location is distinct from old.incident_location
      or new.category is distinct from old.category
      or new.incident_description is distinct from old.incident_description
      or new.employee_explanation is distinct from old.employee_explanation
      or new.warning_level is distinct from old.warning_level
      or new.proposed_action is distinct from old.proposed_action
      or new.executive_ack_required is distinct from old.executive_ack_required
    ) then
    raise exception 'Signed warning document content and company are immutable';
  end if;
  return new;
end;
$$;
