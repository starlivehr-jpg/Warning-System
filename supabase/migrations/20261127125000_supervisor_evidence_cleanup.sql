-- Permit a supervisor to clean up only their own verbal-warning evidence object if metadata insertion fails.
drop policy if exists warning_evidence_delete on storage.objects;
create policy warning_evidence_delete on storage.objects
for delete to authenticated
using (
  bucket_id='warning-evidence'
  and (
    exists (
      select 1 from public.warning_attachments wa
      where wa.storage_path=objects.name
        and private.has_company_access(wa.company_id)
        and private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
    )
    or exists (
      select 1 from public.warning_cases w
      where w.id::text=split_part(objects.name,'/',1)
        and w.created_by=(select auth.uid())
        and w.warning_level='verbal'
        and private.has_company_access(w.company_id)
        and (select p.role::text from public.profiles p where p.id=(select auth.uid()) and p.is_active=true)='supervisor'
    )
  )
);
