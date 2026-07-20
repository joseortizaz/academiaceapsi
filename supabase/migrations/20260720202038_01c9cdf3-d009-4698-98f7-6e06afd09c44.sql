
ALTER TABLE public.zoom_meetings
  ADD COLUMN IF NOT EXISTS cohort_id UUID NULL
  REFERENCES public.program_cohorts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_zoom_meetings_cohort ON public.zoom_meetings(cohort_id);

GRANT SELECT (cohort_id) ON public.zoom_meetings TO authenticated;

DROP VIEW IF EXISTS public.zoom_meetings_student;
CREATE VIEW public.zoom_meetings_student
WITH (security_invoker=on) AS
SELECT
  zm.id, zm.programa_id, zm.modulo_id, zm.titulo, zm.status,
  zm.zoom_meeting_id, zm.zoom_join_url, zm.zoom_password,
  zm.start_at, zm.duration_min, zm.docente_nombre,
  zm.recording_share_url, zm.recording_duration_min,
  zm.cohort_id, pc.nombre AS cohort_nombre,
  zm.created_at, zm.updated_at
FROM public.zoom_meetings zm
LEFT JOIN public.program_cohorts pc ON pc.id = zm.cohort_id;

GRANT SELECT ON public.zoom_meetings_student TO authenticated;

DROP POLICY IF EXISTS "Estudiantes inscritos ven reuniones (via view)" ON public.zoom_meetings;
CREATE POLICY "Estudiantes inscritos ven reuniones (via view)"
ON public.zoom_meetings FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.programa_id = zoom_meetings.programa_id
      AND e.user_id = auth.uid()
      AND e.estado IN ('activo','completado')
  )
  AND (
    zoom_meetings.cohort_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.cohort_enrollments ce
      WHERE ce.cohort_id = zoom_meetings.cohort_id
        AND ce.user_id = auth.uid()
        AND ce.estado = 'activo'
    )
  )
);
