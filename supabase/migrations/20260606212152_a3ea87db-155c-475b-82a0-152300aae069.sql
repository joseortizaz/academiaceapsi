-- 1) Restringir lectura de course-materials por docentes a SUS carpetas
DROP POLICY IF EXISTS "course-materials staff read" ON storage.objects;

CREATE POLICY "course-materials staff read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'course-materials'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_role(auth.uid(), 'docente'::app_role)
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
  )
);

-- 2) program_access_links: garantizar que authenticated solo lee columnas no sensibles
REVOKE ALL ON public.program_access_links FROM authenticated, anon;

GRANT SELECT (id, programa_id, modulo_id, tipo, url, meeting_id, activo, created_at)
  ON public.program_access_links TO authenticated;

GRANT ALL ON public.program_access_links TO service_role;
