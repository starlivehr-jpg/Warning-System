-- Align evidence metadata and Storage object policies with company isolation.
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
    or exists (
      select 1 from public.warning_cases w
      where w.id=warning_attachments.warning_id and w.created_by=(select auth.uid())
    )
  )
);

drop policy if exists attachments_hr_insert on public.warning_attachments;
create policy attachments_hr_insert on public.warning_attachments
for insert to authenticated
with check (
  private.has_company_access(company_id)
  and uploaded_by=(select auth.uid())
  and exists (
    select 1 from public.warning_cases w
    where w.id=warning_attachments.warning_id
      and w.company_id=warning_attachments.company_id
      and (
        private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
        or (
          w.created_by=(select auth.uid())
          and w.warning_level='verbal'
          and (select p.role::text from public.profiles p where p.id=(select auth.uid()) and p.is_active=true)='supervisor'
        )
      )
  )
);

drop policy if exists warning_evidence_read on storage.objects;
create policy warning_evidence_read on storage.objects
for select to authenticated
using (
  bucket_id='warning-evidence'
  and exists (
    select 1
    from public.warning_attachments wa
    join public.warning_cases w on w.id=wa.warning_id
    where wa.storage_path=objects.name
      and wa.company_id=w.company_id
      and private.has_company_access(w.company_id)
      and (
        private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
        or exists (
          select 1 from public.warning_approvals a
          where a.warning_id=w.id and a.approver_id=(select auth.uid())
        )
        or w.created_by=(select auth.uid())
      )
  )
);

drop policy if exists warning_evidence_upload on storage.objects;
create policy warning_evidence_upload on storage.objects
for insert to authenticated
with check (
  bucket_id='warning-evidence'
  and exists (
    select 1 from public.warning_cases w
    where w.id::text=split_part(objects.name,'/',1)
      and private.has_company_access(w.company_id)
      and (
        private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
        or (
          w.created_by=(select auth.uid())
          and w.warning_level='verbal'
          and (select p.role::text from public.profiles p where p.id=(select auth.uid()) and p.is_active=true)='supervisor'
        )
      )
  )
);

drop policy if exists warning_evidence_update on storage.objects;
create policy warning_evidence_update on storage.objects
for update to authenticated
using (
  bucket_id='warning-evidence'
  and exists (
    select 1 from public.warning_attachments wa
    where wa.storage_path=objects.name
      and private.has_company_access(wa.company_id)
      and private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
  )
)
with check (
  bucket_id='warning-evidence'
  and exists (
    select 1 from public.warning_attachments wa
    where wa.storage_path=objects.name
      and private.has_company_access(wa.company_id)
      and private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
  )
);

drop policy if exists warning_evidence_delete on storage.objects;
create policy warning_evidence_delete on storage.objects
for delete to authenticated
using (
  bucket_id='warning-evidence'
  and exists (
    select 1 from public.warning_attachments wa
    where wa.storage_path=objects.name
      and private.has_company_access(wa.company_id)
      and private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
  )
);
