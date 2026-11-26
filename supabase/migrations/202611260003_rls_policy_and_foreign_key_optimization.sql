-- Consolidate RLS policies and add foreign-key covering indexes.
drop policy if exists "profiles_read_self_or_admin" on public.profiles;
drop policy if exists "profiles_hr_read" on public.profiles;
drop policy if exists "profiles_admin_manage" on public.profiles;
create policy "profiles_select_authorized" on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.has_any_role(array['system_admin','hr_officer']::public.app_role[])));
create policy "profiles_admin_insert" on public.profiles for insert to authenticated
with check ((select private.has_any_role(array['system_admin']::public.app_role[])));
create policy "profiles_admin_update" on public.profiles for update to authenticated
using ((select private.has_any_role(array['system_admin']::public.app_role[])))
with check ((select private.has_any_role(array['system_admin']::public.app_role[])));
create policy "profiles_admin_delete" on public.profiles for delete to authenticated
using ((select private.has_any_role(array['system_admin']::public.app_role[])));

drop policy if exists "departments_read_authenticated" on public.departments;
drop policy if exists "departments_admin_hr_manage" on public.departments;
create policy "departments_select_authenticated" on public.departments for select to authenticated
using ((select private.current_app_role()) is not null);
create policy "departments_hr_insert" on public.departments for insert to authenticated
with check ((select private.has_any_role(array['system_admin','hr_officer']::public.app_role[])));
create policy "departments_hr_update" on public.departments for update to authenticated
using ((select private.has_any_role(array['system_admin','hr_officer']::public.app_role[])))
with check ((select private.has_any_role(array['system_admin','hr_officer']::public.app_role[])));
create policy "departments_hr_delete" on public.departments for delete to authenticated
using ((select private.has_any_role(array['system_admin','hr_officer']::public.app_role[])));

drop policy if exists "employees_read_authorized" on public.employees;
drop policy if exists "employees_hr_manage" on public.employees;
create policy "employees_select_authorized" on public.employees for select to authenticated
using ((select private.has_any_role(array['system_admin','hr_officer','approver','viewer']::public.app_role[])));
create policy "employees_hr_insert" on public.employees for insert to authenticated
with check ((select private.has_any_role(array['system_admin','hr_officer']::public.app_role[])));
create policy "employees_hr_update" on public.employees for update to authenticated
using ((select private.has_any_role(array['system_admin','hr_officer']::public.app_role[])))
with check ((select private.has_any_role(array['system_admin','hr_officer']::public.app_role[])));
create policy "employees_hr_delete" on public.employees for delete to authenticated
using ((select private.has_any_role(array['system_admin','hr_officer']::public.app_role[])));

drop policy if exists "warnings_read_authorized" on public.warning_cases;
drop policy if exists "warnings_hr_insert" on public.warning_cases;
drop policy if exists "warnings_hr_update" on public.warning_cases;
create policy "warnings_select_authorized" on public.warning_cases for select to authenticated
using ((select private.has_any_role(array['system_admin','hr_officer','approver','viewer']::public.app_role[])));
create policy "warnings_hr_insert" on public.warning_cases for insert to authenticated
with check ((select private.has_any_role(array['system_admin','hr_officer']::public.app_role[])) and created_by = (select auth.uid()));
create policy "warnings_hr_update" on public.warning_cases for update to authenticated
using ((select private.has_any_role(array['system_admin','hr_officer']::public.app_role[])))
with check ((select private.has_any_role(array['system_admin','hr_officer']::public.app_role[])));

drop policy if exists "approvals_read_authorized" on public.warning_approvals;
drop policy if exists "approvals_hr_assign" on public.warning_approvals;
drop policy if exists "approvals_assigned_update" on public.warning_approvals;
create policy "approvals_select_authorized" on public.warning_approvals for select to authenticated
using (approver_id = (select auth.uid()) or (select private.has_any_role(array['system_admin','hr_officer']::public.app_role[])));
create policy "approvals_hr_insert" on public.warning_approvals for insert to authenticated
with check ((select private.has_any_role(array['system_admin','hr_officer']::public.app_role[])));
create policy "approvals_assigned_update" on public.warning_approvals for update to authenticated
using (approver_id = (select auth.uid()) or (select private.has_any_role(array['system_admin']::public.app_role[])))
with check (approver_id = (select auth.uid()) or (select private.has_any_role(array['system_admin']::public.app_role[])));

drop policy if exists "attachments_read_authorized" on public.warning_attachments;
drop policy if exists "attachments_hr_manage" on public.warning_attachments;
create policy "attachments_select_authorized" on public.warning_attachments for select to authenticated
using ((select private.has_any_role(array['system_admin','hr_officer','approver']::public.app_role[])));
create policy "attachments_hr_insert" on public.warning_attachments for insert to authenticated
with check ((select private.has_any_role(array['system_admin','hr_officer']::public.app_role[])) and uploaded_by = (select auth.uid()));
create policy "attachments_hr_update" on public.warning_attachments for update to authenticated
using ((select private.has_any_role(array['system_admin','hr_officer']::public.app_role[])))
with check ((select private.has_any_role(array['system_admin','hr_officer']::public.app_role[])) and uploaded_by = (select auth.uid()));
create policy "attachments_hr_delete" on public.warning_attachments for delete to authenticated
using ((select private.has_any_role(array['system_admin','hr_officer']::public.app_role[])));

create index if not exists audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index if not exists employees_created_by_idx on public.employees(created_by);
create index if not exists warning_attachments_warning_id_idx on public.warning_attachments(warning_id);
create index if not exists warning_attachments_uploaded_by_idx on public.warning_attachments(uploaded_by);
create index if not exists warning_cases_created_by_idx on public.warning_cases(created_by);
create index if not exists warning_cases_updated_by_idx on public.warning_cases(updated_by);
