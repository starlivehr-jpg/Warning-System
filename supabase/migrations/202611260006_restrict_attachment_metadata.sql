drop policy if exists "attachments_select_authorized" on public.warning_attachments;
create policy "attachments_select_authorized" on public.warning_attachments
for select to authenticated
using (
  (select private.has_any_role(array['system_admin','hr_officer']::public.app_role[]))
  or exists (
    select 1 from public.warning_approvals a
    where a.warning_id = warning_attachments.warning_id
      and a.approver_id = (select auth.uid())
  )
);
