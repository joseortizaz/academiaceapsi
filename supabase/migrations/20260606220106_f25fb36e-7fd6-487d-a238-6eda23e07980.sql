DROP POLICY IF EXISTS "Ver programas publicados" ON public.programs;

CREATE POLICY "Ver programas publicados o inscritos"
ON public.programs
FOR SELECT
TO anon, authenticated
USING (
  estado IN ('publicado', 'en_curso', 'finalizado')
  OR (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.enrollments e
      WHERE e.programa_id = programs.id
        AND e.user_id = auth.uid()
    )
  )
);