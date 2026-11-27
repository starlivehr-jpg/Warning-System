-- Strengthen signature evidence integrity and allow authorized readers to view the complete chain.
-- Additive-only migration. No existing rows or tables are deleted.

drop policy if exists warning_signatures_read_authorized on public.warning_signatures;
create policy warning_signatures_read_authorized
on public.warning_signatures for select to authenticated
using (
  exists (
    select 1
    from public.warning_cases w
    where w.id = warning_signatures.warning_id
  )
);

create or replace function private.prevent_signed_warning_document_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.warning_signatures s where s.warning_id = old.id
  ) and (
    new.case_number is distinct from old.case_number
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
    raise exception 'Signed warning document content is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists warning_document_immutable_after_signature on public.warning_cases;
create trigger warning_document_immutable_after_signature
before update on public.warning_cases
for each row execute function private.prevent_signed_warning_document_mutation();

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
  v_issuer_digest text;
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

  select * into v_warning
    from public.warning_cases
    where id = p_warning_id
    for update;
  if not found then raise exception 'Warning document not found'; end if;

  select
    exists(select 1 from public.warning_signatures s where s.warning_id=p_warning_id and s.signature_step='issuer'),
    exists(select 1 from public.warning_signatures s where s.warning_id=p_warning_id and s.signature_step='hr_manager_ack'),
    exists(select 1 from public.warning_signatures s where s.warning_id=p_warning_id and s.signature_step='executive_ack')
    into v_issuer, v_hr, v_exec;

  v_digest := encode(extensions.digest(convert_to(jsonb_build_object(
    'id', v_warning.id,
    'case_number', v_warning.case_number,
    'employee_id', v_warning.employee_id,
    'incident_date', v_warning.incident_date,
    'incident_time', v_warning.incident_time,
    'incident_location', v_warning.incident_location,
    'category', v_warning.category,
    'incident_description', v_warning.incident_description,
    'employee_explanation', v_warning.employee_explanation,
    'warning_level', v_warning.warning_level,
    'proposed_action', v_warning.proposed_action,
    'executive_ack_required', v_warning.executive_ack_required
  )::text, 'UTF8'), 'sha256'), 'hex');

  if v_issuer then
    select s.document_digest into v_issuer_digest
      from public.warning_signatures s
      where s.warning_id=p_warning_id and s.signature_step='issuer';
    if v_digest is distinct from v_issuer_digest then
      raise exception 'Warning document has changed since issuer signature';
    end if;
  end if;

  if p_signature_step = 'issuer' then
    if v_role::text not in ('supervisor','hr_officer') then
      raise exception 'Only supervisor or HR officer can sign as issuer';
    end if;
    if v_warning.status not in ('draft','approved') then
      raise exception 'Document is not ready for issuer signature';
    end if;
  elsif p_signature_step = 'hr_manager_ack' then
    if v_role::text <> 'hr_manager' then raise exception 'HR Manager role required'; end if;
    if not v_issuer then raise exception 'Issuer signature is required first'; end if;
  elsif p_signature_step = 'executive_ack' then
    if v_role::text <> 'executive' then raise exception 'Executive role required'; end if;
    if not v_warning.executive_ack_required then
      raise exception 'Executive acknowledgment was not requested for this document';
    end if;
    if not v_issuer or not v_hr then
      raise exception 'Issuer and HR Manager signatures are required first';
    end if;
  elsif p_signature_step = 'employee_ack' then
    if v_role::text <> 'employee' or v_employee_id is distinct from v_warning.employee_id then
      raise exception 'Only the employee assigned to this warning can acknowledge it';
    end if;
    if not v_issuer or not v_hr then
      raise exception 'Issuer and HR Manager signatures are required first';
    end if;
    if v_warning.executive_ack_required and not v_exec then
      raise exception 'Executive acknowledgment is required first';
    end if;
  else
    raise exception 'Invalid signature step';
  end if;

  insert into public.warning_signatures(
    warning_id, signer_id, signature_step, signer_name, consent_text, document_digest
  )
  values (
    p_warning_id, v_uid, p_signature_step, trim(p_signer_name), trim(p_consent_text), v_digest
  )
  returning * into v_result;

  if p_signature_step in ('hr_manager_ack','executive_ack') then
    select
      exists(select 1 from public.warning_signatures s where s.warning_id=p_warning_id and s.signature_step='issuer'),
      exists(select 1 from public.warning_signatures s where s.warning_id=p_warning_id and s.signature_step='hr_manager_ack'),
      exists(select 1 from public.warning_signatures s where s.warning_id=p_warning_id and s.signature_step='executive_ack')
      into v_issuer, v_hr, v_exec;

    if v_issuer and v_hr and (not v_warning.executive_ack_required or v_exec) then
      update public.warning_cases
      set status='issued', issued_at=coalesce(issued_at,now()), updated_at=now(), updated_by=v_uid
      where id=p_warning_id;
    end if;
  elsif p_signature_step = 'employee_ack' then
    update public.warning_cases
    set status='acknowledged', acknowledged_at=now(), updated_at=now(), updated_by=v_uid
    where id=p_warning_id;
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(
    v_uid,
    'warning_electronically_signed',
    'warning_case',
    p_warning_id::text,
    jsonb_build_object(
      'signature_step', p_signature_step,
      'document_digest', v_digest
    )
  );

  return v_result;
end;
$$;

revoke all on function private.sign_warning(uuid,text,text,text) from public, anon;
grant execute on function private.sign_warning(uuid,text,text,text) to authenticated;
