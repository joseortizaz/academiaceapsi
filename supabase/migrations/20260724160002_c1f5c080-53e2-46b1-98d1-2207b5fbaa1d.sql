DROP VIEW IF EXISTS public.zoom_meetings_student;

CREATE VIEW public.zoom_meetings_student
WITH (security_invoker=off) AS
SELECT
  zm.id,
  zm.programa_id,
  zm.modulo_id,
  zm.titulo,
  zm.status,
  zm.zoom_meeting_id,
  zm.start_at,
  zm.duration_min,
  zm.docente_nombre,
  zm.recording_share_url,
  zm.recording_duration_min,
  zm.cohort_id,
  pc.nombre AS cohort_nombre,
  zm.created_at,
  zm.updated_at
FROM public.zoom_meetings zm
LEFT JOIN public.program_cohorts pc ON pc.id = zm.cohort_id
WHERE
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_teacher_of_program(zm.programa_id)
  OR EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.programa_id = zm.programa_id
      AND e.user_id = auth.uid()
  );

GRANT SELECT ON public.zoom_meetings_student TO authenticated;
GRANT SELECT ON public.zoom_meetings_student TO service_role;