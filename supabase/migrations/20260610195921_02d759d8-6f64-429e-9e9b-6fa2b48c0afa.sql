-- Tighten course-materials storage read policy: require the file to be referenced
-- by a lesson_materials row whose programa_id is one the student is actively enrolled in.
DROP POLICY IF EXISTS "course-materials enrolled students read" ON storage.objects;

CREATE POLICY "course-materials enrolled students read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'course-materials'
  AND EXISTS (
    SELECT 1
    FROM public.lesson_materials lm
    JOIN public.enrollments e
      ON e.programa_id = lm.programa_id
     AND e.user_id = auth.uid()
     AND e.estado = ANY (ARRAY['activo','completado'])
    WHERE lm.url LIKE '%' || storage.objects.name || '%'
  )
);