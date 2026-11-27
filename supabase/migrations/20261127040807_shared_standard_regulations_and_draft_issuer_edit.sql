ALTER TABLE public.regulation_documents
  ADD COLUMN IF NOT EXISTS is_shared_standard boolean NOT NULL DEFAULT false;

UPDATE public.regulation_documents
SET is_shared_standard = true
WHERE company_id = '3242719e-4cd2-44d5-8943-60e7fc1fb267'::uuid
  AND title ~ '^หมวดที่[[:space:]]*[0-9]+$';

UPDATE public.regulation_sections AS s
SET category_code = CASE substring(coalesce(d.title, '') || ' ' || coalesce(d.original_file_name, '') FROM 'หมวดที่[[:space:]]*([0-9]+)')::integer
  WHEN 1 THEN 'general' WHEN 2 THEN 'employment' WHEN 3 THEN 'working_time' WHEN 4 THEN 'holidays'
  WHEN 5 THEN 'wages' WHEN 6 THEN 'overtime' WHEN 7 THEN 'leave' WHEN 8 THEN 'welfare_safety'
  WHEN 9 THEN 'development' WHEN 10 THEN 'discipline' WHEN 11 THEN 'grievances' WHEN 12 THEN 'termination'
  WHEN 13 THEN 'severance' WHEN 14 THEN 'acknowledgment' ELSE s.category_code END,
sort_order = CASE substring(coalesce(d.title, '') || ' ' || coalesce(d.original_file_name, '') FROM 'หมวดที่[[:space:]]*([0-9]+)')::integer
  WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 3 WHEN 4 THEN 4 WHEN 5 THEN 5 WHEN 6 THEN 6 WHEN 7 THEN 7
  WHEN 8 THEN 8 WHEN 9 THEN 9 WHEN 10 THEN 10 WHEN 11 THEN 11 WHEN 12 THEN 12 WHEN 13 THEN 13 WHEN 14 THEN 14
  ELSE s.sort_order END
FROM public.regulation_documents AS d
WHERE d.id = s.document_id AND d.is_shared_standard = true
  AND substring(coalesce(d.title, '') || ' ' || coalesce(d.original_file_name, '') FROM 'หมวดที่[[:space:]]*([0-9]+)') IS NOT NULL
  AND substring(coalesce(d.title, '') || ' ' || coalesce(d.original_file_name, '') FROM 'หมวดที่[[:space:]]*([0-9]+)')::integer BETWEEN 1 AND 14;

CREATE POLICY regulation_documents_read_shared_standard
ON public.regulation_documents FOR SELECT TO authenticated
USING (is_shared_standard = true);

CREATE POLICY regulation_sections_read_shared_standard
ON public.regulation_sections FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.regulation_documents AS d WHERE d.id = regulation_sections.document_id AND d.is_shared_standard = true));

CREATE POLICY warnings_draft_issuer_update
ON public.warning_cases FOR UPDATE TO authenticated
USING (private.has_company_access(company_id) AND status = 'draft' AND created_by = (SELECT auth.uid())
  AND NOT EXISTS (SELECT 1 FROM public.warning_signatures AS ws WHERE ws.warning_id = warning_cases.id))
WITH CHECK (private.has_company_access(company_id) AND created_by = (SELECT auth.uid()) AND status IN ('draft','pending_approval')
  AND NOT EXISTS (SELECT 1 FROM public.warning_signatures AS ws WHERE ws.warning_id = warning_cases.id));
