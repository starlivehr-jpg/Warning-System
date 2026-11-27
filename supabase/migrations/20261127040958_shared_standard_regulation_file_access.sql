CREATE POLICY company_regulations_read_shared_standard
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'company-regulations'
  AND EXISTS (
    SELECT 1
    FROM public.regulation_documents AS d
    WHERE d.storage_path = objects.name
      AND d.is_shared_standard = true
  )
);