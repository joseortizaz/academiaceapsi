-- Prevent students from querying zoom_meetings base table (which exposes host start_url and recording passwords). Access is via the security_invoker view zoom_meetings_student instead.
DROP POLICY IF EXISTS "Estudiantes inscritos ven reuniones (via view)" ON public.zoom_meetings;
REVOKE SELECT (cohort_id) ON public.zoom_meetings FROM authenticated;