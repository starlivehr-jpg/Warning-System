drop policy if exists "warning_evidence_read" on storage.objects;
create policy "warning_evidence_read" on storage.objects
for select to authenticated
using (
  bucket_id = 'warning-evidence'
  and (
    (select private.has_any_role(array['system_admin','hr_officer']::public.app_role[]))
    or exists (
      select 1
      from public.warning_attachments wa
      join public.warning_approvals a on a.warning_id = wa.warning_id
      where wa.storage_path = name and a.approver_id = (select auth.uid())
    )
  )
);
