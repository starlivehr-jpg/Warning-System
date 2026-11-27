-- Keep the standard regulation text readable in-app, but prevent downloading source files.
DROP POLICY IF EXISTS company_regulations_read ON storage.objects;
DROP POLICY IF EXISTS company_regulations_read_shared_standard ON storage.objects;

-- Only unsigned drafts can be edited. Signed content remains immutable.
DROP POLICY IF EXISTS warnings_hr_update ON public.warning_cases;
CREATE POLICY warnings_hr_update
ON public.warning_cases
FOR UPDATE TO authenticated
USING (
  private.has_company_access(company_id)
  AND status = 'draft'
  AND private.has_any_role(ARRAY['system_admin'::public.app_role, 'hr_officer'::public.app_role])
  AND NOT EXISTS (
    SELECT 1 FROM public.warning_signatures ws WHERE ws.warning_id = warning_cases.id
  )
)
WITH CHECK (
  private.has_company_access(company_id)
  AND status IN ('draft', 'pending_approval')
  AND private.has_any_role(ARRAY['system_admin'::public.app_role, 'hr_officer'::public.app_role])
  AND NOT EXISTS (
    SELECT 1 FROM public.warning_signatures ws WHERE ws.warning_id = warning_cases.id
  )
);

-- Issuer signatures are collected only after the draft has been approved.
-- This keeps new drafts editable and prevents signatures being attached too early.
CREATE OR REPLACE FUNCTION private.prevent_issuer_signature_on_draft()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.signature_step = 'issuer'
     AND EXISTS (
       SELECT 1
       FROM public.warning_cases wc
       WHERE wc.id = NEW.warning_id
         AND wc.status = 'draft'
     ) THEN
    RAISE EXCEPTION 'Draft warning must be approved before issuer signature';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_issuer_signature_on_draft ON public.warning_signatures;
CREATE TRIGGER prevent_issuer_signature_on_draft
BEFORE INSERT ON public.warning_signatures
FOR EACH ROW
EXECUTE FUNCTION private.prevent_issuer_signature_on_draft();
