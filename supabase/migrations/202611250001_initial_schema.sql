-- STAR LIVE ONLINE Warning System
-- Apply only to a dedicated Warning System Supabase project.
-- No employee records or sample personal data are inserted by this migration.

create extension if not exists pgcrypto;

create type public.app_role as enum ('system_admin', 'hr_officer', 'approver', 'viewer');
create type public.employee_status as enum ('active', 'resigned', 'terminated', 'suspended');
create type public.warning_status as enum ('draft', 'pending_approval', 'approved', 'rejected', 'issued', 'acknowledged', 'cancelled');
create type public.warning_level as enum ('verbal', 'written_1', 'written_2', 'final_written');
create type public.approval_decision as enum ('pending', 'approved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  first_name text not null,
  last_name text not null,
  department_id uuid references public.departments(id) on delete restrict,
  job_title text,
  employment_start_date date,
  employment_end_date date,
  status public.employee_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create table public.warning_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  employee_id uuid not null references public.employees(id) on delete restrict,
  incident_date date not null,
  incident_time time,
  incident_location text,
  category text not null,
  incident_description text not null,
  employee_explanation text,
  warning_level public.warning_level not null,
  status public.warning_status not null default 'draft',
  proposed_action text,
  issued_at timestamptz,
  acknowledged_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.warning_approvals (
  id uuid primary key default gen_random_uuid(),
  warning_id uuid not null references public.warning_cases(id) on delete cascade,
  approver_id uuid not null references public.profiles(id) on delete restrict,
  decision public.approval_decision not null default 'pending',
  comments text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (warning_id, approver_id)
);

create table public.warning_attachments (
  id uuid primary key default gen_random_uuid(),
  warning_id uuid not null references public.warning_cases(id) on delete cascade,
  storage_path text not null,
  original_file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index employees_department_idx on public.employees(department_id);
create index employees_status_idx on public.employees(status);
create index warning_cases_employee_idx on public.warning_cases(employee_id);
create index warning_cases_status_idx on public.warning_cases(status);
create index warning_cases_incident_date_idx on public.warning_cases(incident_date desc);
create index warning_approvals_approver_idx on public.warning_approvals(approver_id, decision);
create index audit_logs_created_at_idx on public.audit_logs(created_at desc);

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles
  where id = auth.uid() and is_active = true
$$;

create or replace function public.has_any_role(allowed public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = any(allowed), false)
$$;

alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.employees enable row level security;
alter table public.warning_cases enable row level security;
alter table public.warning_approvals enable row level security;
alter table public.warning_attachments enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles: users can read their own profile; administrators manage profiles.
create policy "profiles_read_self_or_admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.has_any_role(array['system_admin']::public.app_role[]));
create policy "profiles_admin_manage" on public.profiles for all to authenticated
using (public.has_any_role(array['system_admin']::public.app_role[]))
with check (public.has_any_role(array['system_admin']::public.app_role[]));

create policy "departments_read_authenticated" on public.departments for select to authenticated
using (public.current_app_role() is not null);
create policy "departments_admin_hr_manage" on public.departments for all to authenticated
using (public.has_any_role(array['system_admin','hr_officer']::public.app_role[]))
with check (public.has_any_role(array['system_admin','hr_officer']::public.app_role[]));

create policy "employees_read_authorized" on public.employees for select to authenticated
using (public.has_any_role(array['system_admin','hr_officer','approver','viewer']::public.app_role[]));
create policy "employees_hr_manage" on public.employees for all to authenticated
using (public.has_any_role(array['system_admin','hr_officer']::public.app_role[]))
with check (public.has_any_role(array['system_admin','hr_officer']::public.app_role[]));

create policy "warnings_read_authorized" on public.warning_cases for select to authenticated
using (public.has_any_role(array['system_admin','hr_officer','approver','viewer']::public.app_role[]));
create policy "warnings_hr_insert" on public.warning_cases for insert to authenticated
with check (public.has_any_role(array['system_admin','hr_officer']::public.app_role[]) and created_by = auth.uid());
create policy "warnings_hr_update" on public.warning_cases for update to authenticated
using (public.has_any_role(array['system_admin','hr_officer']::public.app_role[]))
with check (public.has_any_role(array['system_admin','hr_officer']::public.app_role[]));

create policy "approvals_read_authorized" on public.warning_approvals for select to authenticated
using (approver_id = auth.uid() or public.has_any_role(array['system_admin','hr_officer']::public.app_role[]));
create policy "approvals_assigned_insert" on public.warning_approvals for insert to authenticated
with check (public.has_any_role(array['system_admin','hr_officer']::public.app_role[]) or approver_id = auth.uid());
create policy "approvals_assigned_update" on public.warning_approvals for update to authenticated
using (approver_id = auth.uid() or public.has_any_role(array['system_admin']::public.app_role[]))
with check (approver_id = auth.uid() or public.has_any_role(array['system_admin']::public.app_role[]));

create policy "attachments_read_authorized" on public.warning_attachments for select to authenticated
using (public.has_any_role(array['system_admin','hr_officer','approver']::public.app_role[]));
create policy "attachments_hr_manage" on public.warning_attachments for all to authenticated
using (public.has_any_role(array['system_admin','hr_officer']::public.app_role[]))
with check (public.has_any_role(array['system_admin','hr_officer']::public.app_role[]) and uploaded_by = auth.uid());

create policy "audit_logs_read_admin_hr" on public.audit_logs for select to authenticated
using (public.has_any_role(array['system_admin','hr_officer']::public.app_role[]));
create policy "audit_logs_insert_authenticated" on public.audit_logs for insert to authenticated
with check (actor_id = auth.uid());

-- Audit rows are append-only: no UPDATE or DELETE policies are intentionally provided.
