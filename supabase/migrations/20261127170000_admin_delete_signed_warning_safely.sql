CREATE OR REPLACE FUNCTION private.prevent_warning_signature_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_setting('app.admin_delete_warning', true) = 'on'
     AND auth.uid() IS NOT NULL
     AND private.has_any_role(ARRAY['system_admin'::public.app_role]) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Electronic signature records are immutable';
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_delete_warning(p_warning_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_warning public.warning_cases;
  v_attachment_count integer;
  v_signature_count integer;
  v_signature_snapshot jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_any_role(ARRAY['system_admin'::public.app_role]) THEN
    RAISE EXCEPTION 'Only System Admin can delete warning documents' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_warning FROM public.warning_cases WHERE id=p_warning_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Warning document not found' USING ERRCODE = 'P0002'; END IF;
  SELECT count(*) INTO v_attachment_count FROM public.warning_attachments WHERE warning_id=p_warning_id;
  SELECT count(*) INTO v_signature_count FROM public.warning_signatures WHERE warning_id=p_warning_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'signature_id',s.id,'signature_step',s.signature_step,'signer_id',s.signer_id,
    'signer_name',s.signer_name,'consent_text',s.consent_text,'document_digest',s.document_digest,
    'signed_at',s.signed_at,'company_id',s.company_id,'signature_artifact_present',(a.signature_id IS NOT NULL)
  ) ORDER BY s.signed_at),'[]'::jsonb)
  INTO v_signature_snapshot FROM public.warning_signatures s
  LEFT JOIN public.warning_signature_artifacts a ON a.signature_id=s.id
  WHERE s.warning_id=p_warning_id;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,details,company_id)
  VALUES(auth.uid(),'warning.deleted','warning_case',v_warning.id::text,
    jsonb_build_object('case_number',v_warning.case_number,'employee_id',v_warning.employee_id,
    'company_id',v_warning.company_id,'status',v_warning.status,'warning_level',v_warning.warning_level,
    'attachment_count',v_attachment_count,'signature_count',v_signature_count,
    'signature_snapshot',v_signature_snapshot,'deleted_at',now()),v_warning.company_id);
  PERFORM set_config('app.admin_delete_warning','on',true);
  DELETE FROM public.warning_signature_artifacts a USING public.warning_signatures s
    WHERE a.signature_id=s.id AND s.warning_id=p_warning_id;
  DELETE FROM public.warning_signatures WHERE warning_id=p_warning_id;
  DELETE FROM public.warning_approvals WHERE warning_id=p_warning_id;
  DELETE FROM public.warning_attachments WHERE warning_id=p_warning_id;
  DELETE FROM public.warning_cases WHERE id=p_warning_id;
  PERFORM set_config('app.admin_delete_warning','off',true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_warning(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_warning(uuid) TO authenticated;