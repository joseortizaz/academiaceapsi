
REVOKE SELECT ON public.assessment_questions FROM anon, authenticated;
GRANT SELECT (id, assessment_id, enunciado, tipo, opciones, puntaje, orden, created_at)
  ON public.assessment_questions TO authenticated;
GRANT ALL ON public.assessment_questions TO service_role;

REVOKE SELECT ON public.zoom_meetings FROM anon, authenticated;
GRANT SELECT (
  id, programa_id, modulo_id, titulo, docente_nombre, zoom_meeting_id,
  zoom_join_url, start_at, duration_min, status, auto_record,
  recording_url, recording_duration_min, created_by, created_at, updated_at
) ON public.zoom_meetings TO authenticated;
GRANT ALL ON public.zoom_meetings TO service_role;

ALTER TABLE public.enrollments
  ENABLE ALWAYS TRIGGER enrollments_prevent_privileged_updates;
