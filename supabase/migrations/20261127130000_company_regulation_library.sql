-- Company-specific work-regulation library with searchable verbatim sections.
create table if not exists public.regulation_categories (
  category_code text primary key,
  category_name_th text not null,
  sort_order smallint not null unique
);

insert into public.regulation_categories(category_code,category_name_th,sort_order)
values
 ('general','ข้อบังคับทั่วไป',1),
 ('employment','การจ้างงาน',2),
 ('working_time','วันทำงาน เวลาทำงาน และเวลาพัก',3),
 ('holidays','วันหยุด',4),
 ('wages','ค่าจ้าง เงินเดือน และค่าตอบแทน',5),
 ('overtime','การทำงานล่วงเวลาและการทำงานในวันหยุด',6),
 ('leave','หลักเกณฑ์การลา',7),
 ('welfare_safety','สวัสดิการ การรักษาพยาบาล และความปลอดภัย',8),
 ('development','การพัฒนาบุคลากร',9),
 ('discipline','วินัยและโทษทางวินัย',10),
 ('grievances','การร้องทุกข์',11),
 ('termination','การเลิกจ้าง',12),
 ('severance','ค่าชดเชย',13),
 ('acknowledgment','การรับทราบและความเข้าใจข้อบังคับ',14)
on conflict (category_code) do update
set category_name_th=excluded.category_name_th,sort_order=excluded.sort_order;

create table if not exists public.regulation_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  title text not null,
  document_code text,
  revision text,
  effective_date date,
  original_file_name text,
  storage_path text,
  file_sha256 text,
  source_status text not null default 'uploaded'
    check (source_status in ('uploaded','indexed','needs_review')),
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $
begin
  if not exists (
    select 1 from pg_constraint
    where conname='regulation_documents_id_company_unique'
      and conrelid='public.regulation_documents'::regclass
  ) then
    alter table public.regulation_documents
      add constraint regulation_documents_id_company_unique unique (id, company_id);
  end if;
end;
$;

create table if not exists public.regulation_sections (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.regulation_documents(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  category_code text not null references public.regulation_categories(category_code),
  section_number text,
  heading text not null,
  content_text text not null,
  source_page integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint regulation_sections_doc_company_fk
    foreign key (document_id, company_id)
    references public.regulation_documents(id, company_id)
    on delete cascade
);

create index if not exists regulation_documents_company_idx
on public.regulation_documents(company_id,created_at desc);
create index if not exists regulation_sections_company_category_idx
on public.regulation_sections(company_id,category_code,sort_order);
create index if not exists regulation_sections_document_idx
on public.regulation_sections(document_id,sort_order);

alter table public.regulation_documents enable row level security;
alter table public.regulation_sections enable row level security;
alter table public.regulation_categories enable row level security;

drop policy if exists regulation_categories_read_authenticated on public.regulation_categories;
create policy regulation_categories_read_authenticated on public.regulation_categories
for select to authenticated using (true);

drop policy if exists regulation_documents_read_authorized on public.regulation_documents;
create policy regulation_documents_read_authorized on public.regulation_documents
for select to authenticated using (private.has_company_access(company_id));

drop policy if exists regulation_documents_hr_insert on public.regulation_documents;
create policy regulation_documents_hr_insert on public.regulation_documents
for insert to authenticated
with check (
  private.has_company_access(company_id)
  and private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
  and uploaded_by=(select auth.uid())
);

drop policy if exists regulation_documents_hr_update on public.regulation_documents;
create policy regulation_documents_hr_update on public.regulation_documents
for update to authenticated
using (private.has_company_access(company_id) and private.has_any_role(array['system_admin','hr_officer']::public.app_role[]))
with check (private.has_company_access(company_id) and private.has_any_role(array['system_admin','hr_officer']::public.app_role[]));

drop policy if exists regulation_documents_hr_delete on public.regulation_documents;
create policy regulation_documents_hr_delete on public.regulation_documents
for delete to authenticated
using (private.has_company_access(company_id) and private.has_any_role(array['system_admin','hr_officer']::public.app_role[]));

drop policy if exists regulation_sections_read_authorized on public.regulation_sections;
create policy regulation_sections_read_authorized on public.regulation_sections
for select to authenticated using (private.has_company_access(company_id));

drop policy if exists regulation_sections_hr_insert on public.regulation_sections;
create policy regulation_sections_hr_insert on public.regulation_sections
for insert to authenticated
with check (
  private.has_company_access(company_id)
  and private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
  and exists (
    select 1 from public.regulation_documents d
    where d.id=regulation_sections.document_id
      and d.company_id=regulation_sections.company_id
  )
);

drop policy if exists regulation_sections_hr_update on public.regulation_sections;
create policy regulation_sections_hr_update on public.regulation_sections
for update to authenticated
using (private.has_company_access(company_id) and private.has_any_role(array['system_admin','hr_officer']::public.app_role[]))
with check (
  private.has_company_access(company_id)
  and private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
  and exists (
    select 1 from public.regulation_documents d
    where d.id=regulation_sections.document_id
      and d.company_id=regulation_sections.company_id
  )
);

drop policy if exists regulation_sections_hr_delete on public.regulation_sections;
create policy regulation_sections_hr_delete on public.regulation_sections
for delete to authenticated
using (private.has_company_access(company_id) and private.has_any_role(array['system_admin','hr_officer']::public.app_role[]));

grant select on public.regulation_categories,public.regulation_documents,public.regulation_sections to authenticated;
grant insert,update,delete on public.regulation_documents,public.regulation_sections to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'company-regulations','company-regulations',false,26214400,
  array[
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/pdf',
    'text/plain'
  ]
)
on conflict (id) do update
set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists company_regulations_read on storage.objects;
create policy company_regulations_read on storage.objects
for select to authenticated
using (
  bucket_id='company-regulations'
  and exists (
    select 1 from public.regulation_documents d
    where d.storage_path=objects.name
      and private.has_company_access(d.company_id)
  )
);

drop policy if exists company_regulations_upload on storage.objects;
create policy company_regulations_upload on storage.objects
for insert to authenticated
with check (
  bucket_id='company-regulations'
  and exists (
    select 1 from public.regulation_documents d
    where d.id::text=split_part(objects.name,'/',1)
      and private.has_company_access(d.company_id)
      and private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
  )
);

drop policy if exists company_regulations_update on storage.objects;
create policy company_regulations_update on storage.objects
for update to authenticated
using (
  bucket_id='company-regulations'
  and exists (
    select 1 from public.regulation_documents d
    where d.storage_path=objects.name
      and private.has_company_access(d.company_id)
      and private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
  )
)
with check (
  bucket_id='company-regulations'
  and exists (
    select 1 from public.regulation_documents d
    where d.storage_path=objects.name
      and private.has_company_access(d.company_id)
      and private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
  )
);

drop policy if exists company_regulations_delete on storage.objects;
create policy company_regulations_delete on storage.objects
for delete to authenticated
using (
  bucket_id='company-regulations'
  and exists (
    select 1 from public.regulation_documents d
    where d.storage_path=objects.name
      and private.has_company_access(d.company_id)
      and private.has_any_role(array['system_admin','hr_officer']::public.app_role[])
  )
);
