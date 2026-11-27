-- Permit operational warning roles to read employee identities while keeping writes HR-only.
drop policy if exists employees_select_authorized on public.employees;
create policy employees_select_authorized
on public.employees for select to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and (
        p.role::text in (
          'system_admin','hr_officer','approver','viewer',
          'supervisor','hr_manager','executive'
        )
        or (p.role::text = 'employee' and p.employee_id = employees.id)
      )
  )
);
