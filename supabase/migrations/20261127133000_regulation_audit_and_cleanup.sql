-- Audit regulation changes and allow safe cleanup of partially uploaded source files.
drop trigger if exists regulation_documents_audit_log on public.regulation_documents;
create trigger regulation_documents_audit_log
after insert or update or delete on public.regulation_documents
for each row execute function private.write_warning_audit_log();

drop trigger if exists regulation_sections_audit_log on public.regulation_sections;
create trigger regulation_sections_audit_log
after insert or update or delete on public.regulation_sections
for each row execute function private.write_warning_audit_log();

drop policy if exists company_regulations_delete on storage.objects;
create policy company_regulations_delete on storage.objects
for delete to authenticated
using (
  bucket_id='company-regulations'
  and exists (
    select 1 from public.regulation_documents d
    where (
      d.storage_path=objects.name
      or d.id::text=split_part(objects.name,'/',1)
    )
      and private.has_company_access(d.company_id)
      and private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
  )
);
