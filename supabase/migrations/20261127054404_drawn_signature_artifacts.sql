-- Store the hand-drawn signature image separately from immutable signature evidence.
-- Existing signature rows and the original four-argument signing RPC remain unchanged.
CREATE TABLE IF NOT EXISTS public.warning_signature_artifacts (
  signature_id uuid PRIMARY KEY REFERENCES public.warning_signatures(id) ON DELETE RESTRICT,
  signature_data text NOT NULL CHECK (
    signature_data ~ '^data:image/png;base64,[A-Za-z0-9+/]+=*$'
    AND length(signature_data) <= 1500000
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.warning_signature_artifacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS warning_signature_artifacts_read_authorized ON public.warning_signature_artifacts;
CREATE POLICY warning_signature_artifacts_read_authorized
ON public.warning_signature_artifacts FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.warning_signatures s
    JOIN public.warning_cases w ON w.id = s.warning_id
    WHERE s.id = warning_signature_artifacts.signature_id
  )
);
REVOKE INSERT, UPDATE, DELETE ON public.warning_signature_artifacts FROM anon, authenticated;
GRANT SELECT ON public.warning_signature_artifacts TO authenticated;

CREATE OR REPLACE FUNCTION public.sign_warning(
  p_warning_id uuid,
  p_signature_step text,
  p_signer_name text,
  p_consent_text text,
  p_signature_data text
) RETURNS public.warning_signatures
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_signature public.warning_signatures;
BEGIN
  IF p_signature_data IS NULL
     OR p_signature_data !~ '^data:image/png;base64,[A-Za-z0-9+/]+=*$'
     OR length(p_signature_data) > 1500000 THEN
    RAISE EXCEPTION 'A valid drawn PNG signature is required (maximum 1.5 MB)';
  END IF;

  v_signature := private.sign_warning(
    p_warning_id, p_signature_step, p_signer_name, p_consent_text
  );

  INSERT INTO public.warning_signature_artifacts(signature_id, signature_data)
  VALUES (v_signature.id, p_signature_data);

  RETURN v_signature;
END;
$$;

REVOKE ALL ON FUNCTION public.sign_warning(uuid,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sign_warning(uuid,text,text,text,text) TO authenticated;
