DROP POLICY IF EXISTS "Enrolled users subscribe to community channel" ON realtime.messages;

CREATE POLICY "Enrolled users subscribe to community channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() LIKE 'community-%')
  AND (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.user_id = auth.uid()
        AND e.programa_id::text = SUBSTRING(realtime.topic() FROM 11)
        AND e.estado IN ('activo', 'completado')
    )
    OR EXISTS (
      SELECT 1
      FROM public.programs p
      JOIN public.teachers t ON t.id = p.docente_id
      WHERE t.user_id = auth.uid()
        AND p.id::text = SUBSTRING(realtime.topic() FROM 11)
    )
  )
);