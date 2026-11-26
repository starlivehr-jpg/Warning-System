-- Approval lifecycle, audit trail, and private evidence storage.
create or replace function private.sync_warning_status_from_approval()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.decision = 'rejected' then
    update public.warning_cases set status = 'rejected', updated_at = now() where id = new.warning_id;
  elsif not exists (select 1 from public.warning_approvals where warning_id = new.warning_id and decision = 'pending')
    and exists (select 1 from public.warning_approvals where warning_id = new.warning_id)
    and not exists (select 1 from public.warning_approvals where warning_id = new.warning_id and decision <> 'approved') then
    update public.warning_cases set status = 'approved', updated_at = now() where id = new.warning_id;
  else
    update public.warning_cases set status = 'pending_approval', updated_at = now() where id = new.warning_id;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_warning_status_from_approval() from public, anon, authenticated;
drop trigger if exists warning_approval_status_sync on public.warning_approvals;
create trigger warning_approval_status_sync after insert or update of decision on public.warning_approvals
for each row execute function private.sync_warning_status_from_approval();

create or replace function private.write_warning_audit_log()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_id text;
begin
  if tg_op = 'DELETE' then v_id := old.id::text; else v_id := new.id::text; end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), lower(tg_op), tg_table_name, v_id, jsonb_build_object('source','database_trigger'));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.write_warning_audit_log() from public, anon, authenticated;
drop trigger if exists employees_audit_log on public.employees;
create trigger employees_audit_log after insert or update or delete on public.employees for each row execute function private.write_warning_audit_log();
drop trigger if exists warning_cases_audit_log on public.warning_cases;
create trigger warning_cases_audit_log after insert or update or delete on public.warning_cases for each row execute function private.write_warning_audit_log();
drop trigger if exists warning_approvals_audit_log on public.warning_approvals;
create trigger warning_approvals_audit_log after insert or update or delete on public.warning_approvals for each row execute function private.write_warning_audit_log();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('warning-evidence', 'warning-evidence', false, 10485760, array['application/pdf','image/png','image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "warning_evidence_read" on storage.objects;
create policy "warning_evidence_read" on storage.objects for select to authenticated
using (bucket_id = 'warning-evidence' and private.has_any_role(array['system_admin','hr_officer','approver']::public.app_role[]));
drop policy if exists "warning_evidence_upload" on storage.objects;
create policy "warning_evidence_upload" on storage.objects for insert to authenticated
with check (bucket_id = 'warning-evidence' and private.has_any_role(array['system_admin','hr_officer']::public.app_role[]));
drop policy if exists "warning_evidence_update" on storage.objects;
create policy "warning_evidence_update" on storage.objects for update to authenticated
using (bucket_id = 'warning-evidence' and private.has_any_role(array['system_admin','hr_officer']::public.app_role[]))
with check (bucket_id = 'warning-evidence' and private.has_any_role(array['system_admin','hr_officer']::public.app_role[]));
drop policy if exists "warning_evidence_delete" on storage.objects;
create policy "warning_evidence_delete" on storage.objects for delete to authenticated
using (bucket_id = 'warning-evidence' and private.has_any_role(array['system_admin','hr_officer']::public.app_role[]));
