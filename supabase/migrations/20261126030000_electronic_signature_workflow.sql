-- Electronic acknowledgment workflow for Warning System PRO.
-- Additive only: preserves existing tables and records.
alter type public.app_role add value if not exists 'supervisor';
alter type public.app_role add value if not exists 'hr_manager';
alter type public.app_role add value if not exists 'executive';
alter type public.app_role add value if not exists 'employee';

alter table public.profiles
  add column if not exists employee_id uuid references public.employees(id) on delete set null;

alter table public.warning_cases
  add column if not exists executive_ack_required boolean not null default false;

drop policy if exists warnings_hr_insert on public.warning_cases;
create policy warnings_authorized_insert on public.warning_cases for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
    or (
      (select p.role::text from public.profiles p where p.id=(select auth.uid()) and p.is_active=true) = 'supervisor'
      and warning_level = 'verbal'
    )
  )
);

create table if not exists public.warning_signatures (
  id uuid primary key default gen_random_uuid(),
  warning_id uuid not null references public.warning_cases(id) on delete restrict,
  signer_id uuid not null references public.profiles(id) on delete restrict,
  signature_step text not null check (signature_step in ('issuer','hr_manager_ack','executive_ack','employee_ack')),
  signer_name text not null,
  consent_text text not null,
  document_digest text not null,
  signed_at timestamptz not null default now(),
  unique (warning_id, signature_step)
);

create index if not exists warning_signatures_signer_idx
  on public.warning_signatures(signer_id, signed_at desc);
create index if not exists warning_signatures_warning_idx
  on public.warning_signatures(warning_id, signed_at);

drop policy if exists warnings_select_authorized on public.warning_cases;
drop policy if exists warnings_read_authorized on public.warning_cases;
create policy warnings_read_authorized on public.warning_cases for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.is_active=true
      and (
        p.role::text in ('system_admin','hr_officer','approver','viewer','supervisor','hr_manager','executive')
        or (p.role::text='employee' and p.employee_id=warning_cases.employee_id)
      )
  )
);

alter table public.warning_signatures enable row level security;
drop policy if exists warning_signatures_read_authorized on public.warning_signatures;
create policy warning_signatures_read_authorized
on public.warning_signatures for select to authenticated
using (
  signer_id = (select auth.uid())
  or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and p.role::text in ('system_admin','hr_officer','hr_manager'))
);

revoke insert, update, delete on public.warning_signatures from anon, authenticated;
grant select on public.warning_signatures to authenticated;

create or replace function private.sign_warning(
  p_warning_id uuid,
  p_signature_step text,
  p_signer_name text,
  p_consent_text text
) returns public.warning_signatures
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.app_role;
  v_profile_name text;
  v_employee_id uuid;
  v_warning public.warning_cases;
  v_digest text;
  v_result public.warning_signatures;
  v_issuer boolean;
  v_hr boolean;
  v_exec boolean;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select p.role, p.full_name, p.employee_id
    into v_role, v_profile_name, v_employee_id
    from public.profiles p where p.id = v_uid and p.is_active = true;
  if v_role is null then raise exception 'Active user profile required'; end if;
  if nullif(trim(p_signer_name), '') is null or trim(p_signer_name) <> trim(v_profile_name) then
    raise exception 'Signer name must match the authenticated profile name';
  end if;
  if coalesce(trim(p_consent_text), '') = '' then
    raise exception 'Explicit electronic signature consent is required';
  end if;

  select * into v_warning from public.warning_cases where id = p_warning_id for update;
  if not found then raise exception 'Warning document not found'; end if;

  select exists(select 1 from public.warning_signatures s where s.warning_id=p_warning_id and s.signature_step='issuer'),
         exists(select 1 from public.warning_signatures s where s.warning_id=p_warning_id and s.signature_step='hr_manager_ack'),
         exists(select 1 from public.warning_signatures s where s.warning_id=p_warning_id and s.signature_step='executive_ack')
    into v_issuer, v_hr, v_exec;

  v_digest := encode(extensions.digest(convert_to(jsonb_build_object(
    'id',v_warning.id,'case_number',v_warning.case_number,'employee_id',v_warning.employee_id,
    'incident_date',v_warning.incident_date,'category',v_warning.category,
    'incident_description',v_warning.incident_description,'warning_level',v_warning.warning_level,
    'executive_ack_required',v_warning.executive_ack_required
  )::text,'UTF8'),'sha256'),'hex');

  if p_signature_step = 'issuer' then
    if v_role::text not in ('supervisor','hr_officer') then raise exception 'Only supervisor or HR officer can sign as issuer'; end if;
    if v_warning.status not in ('draft','approved') then raise exception 'Document is not ready for issuer signature'; end if;
  elsif p_signature_step = 'hr_manager_ack' then
    if v_role::text <> 'hr_manager' then raise exception 'HR Manager role required'; end if;
    if not v_issuer then raise exception 'Issuer signature is required first'; end if;
  elsif p_signature_step = 'executive_ack' then
    if v_role::text <> 'executive' then raise exception 'Executive role required'; end if;
    if not v_warning.executive_ack_required then raise exception 'Executive acknowledgment was not requested for this document'; end if;
    if not v_issuer or not v_hr then raise exception 'Issuer and HR Manager signatures are required first'; end if;
  elsif p_signature_step = 'employee_ack' then
    if v_role::text <> 'employee' or v_employee_id is distinct from v_warning.employee_id then
      raise exception 'Only the employee assigned to this warning can acknowledge it';
    end if;
    if not v_issuer or not v_hr then raise exception 'Issuer and HR Manager signatures are required first'; end if;
    if v_warning.executive_ack_required and not v_exec then raise exception 'Executive acknowledgment is required first'; end if;
  else
    raise exception 'Invalid signature step';
  end if;

  insert into public.warning_signatures(warning_id,signer_id,signature_step,signer_name,consent_text,document_digest)
  values(p_warning_id,v_uid,p_signature_step,trim(p_signer_name),trim(p_consent_text),v_digest)
  returning * into v_result;

  if p_signature_step in ('hr_manager_ack','executive_ack') then
    select exists(select 1 from public.warning_signatures s where s.warning_id=p_warning_id and s.signature_step='issuer'),
           exists(select 1 from public.warning_signatures s where s.warning_id=p_warning_id and s.signature_step='hr_manager_ack'),
           exists(select 1 from public.warning_signatures s where s.warning_id=p_warning_id and s.signature_step='executive_ack')
      into v_issuer,v_hr,v_exec;
    if v_issuer and v_hr and (not v_warning.executive_ack_required or v_exec) then
      update public.warning_cases set status='issued', issued_at=coalesce(issued_at,now()), updated_at=now(), updated_by=v_uid
      where id=p_warning_id;
    end if;
  elsif p_signature_step = 'employee_ack' then
    update public.warning_cases set status='acknowledged', acknowledged_at=now(), updated_at=now(), updated_by=v_uid
    where id=p_warning_id;
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(v_uid,'warning_electronically_signed','warning_case',p_warning_id::text,
    jsonb_build_object('signature_step',p_signature_step,'document_digest',v_digest));
  return v_result;
end;
$$;

revoke all on function private.sign_warning(uuid,text,text,text) from public, anon;
grant execute on function private.sign_warning(uuid,text,text,text) to authenticated;

create or replace function public.sign_warning(
  p_warning_id uuid,
  p_signature_step text,
  p_signer_name text,
  p_consent_text text
) returns public.warning_signatures
language sql
security invoker
set search_path = ''
as $$ select private.sign_warning(p_warning_id,p_signature_step,p_signer_name,p_consent_text); $$;
revoke all on function public.sign_warning(uuid,text,text,text) from public, anon;
grant execute on function public.sign_warning(uuid,text,text,text) to authenticated;

create or replace function private.prevent_warning_signature_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Electronic signature records are immutable';
end;
$$;
drop trigger if exists warning_signatures_immutable on public.warning_signatures;
create trigger warning_signatures_immutable
before update or delete on public.warning_signatures
for each row execute function private.prevent_warning_signature_mutation();

comment on table public.warning_signatures is
'Append-only electronic signature and acknowledgment evidence. Each signature is bound to a SHA-256 digest of the warning document snapshot.';
comment on column public.warning_cases.executive_ack_required is
'Selected by HR when creating or routing the warning; executive acknowledgment is required only when true.';
