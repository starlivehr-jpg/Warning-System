-- Permanent warning deletion is restricted to active System Admin accounts.
-- Preserve an audit snapshot before removing the warning and its dependent records.
CREATE OR REPLACE FUNCTION public.admin_delete_warning(p_warning_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_warning public.warning_cases;
  v_attachment_count integer;
  v_signature_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_any_role(ARRAY['system_admin'::app_role]) THEN
    RAISE EXCEPTION 'Only System Admin can delete warning documents' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_warning
  FROM public.warning_cases
  WHERE id = p_warning_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warning document not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*) INTO v_attachment_count
  FROM public.warning_attachments WHERE warning_id = p_warning_id;
  SELECT count(*) INTO v_signature_count
  FROM public.warning_signatures WHERE warning_id = p_warning_id;

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details, company_id)
  VALUES (
    auth.uid(),
    'warning.deleted',
    'warning_case',
    v_warning.id::text,
    jsonb_build_object(
      'case_number', v_warning.case_number,
      'employee_id', v_warning.employee_id,
      'company_id', v_warning.company_id,
      'status', v_warning.status,
      'warning_level', v_warning.warning_level,
      'attachment_count', v_attachment_count,
      'signature_count', v_signature_count,
      'deleted_at', now()
    ),
    v_warning.company_id
  );

  DELETE FROM public.warning_signature_artifacts a
  USING public.warning_signatures s
  WHERE a.signature_id = s.id AND s.warning_id = p_warning_id;

  DELETE FROM public.warning_signatures WHERE warning_id = p_warning_id;
  DELETE FROM public.warning_approvals WHERE warning_id = p_warning_id;
  DELETE FROM public.warning_attachments WHERE warning_id = p_warning_id;
  DELETE FROM public.warning_cases WHERE id = p_warning_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_warning(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_warning(uuid) TO authenticated;
