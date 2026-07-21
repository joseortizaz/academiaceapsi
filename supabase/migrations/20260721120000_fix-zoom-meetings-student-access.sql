-- Fix: the 2026-07-20 migrations dropped the only RLS SELECT policy on
-- public.zoom_meetings ("Estudiantes inscritos ven reuniones (via view)")
-- and revoked the only column grant that existed (cohort_id), leaving the
-- `authenticated` role with zero SELECT privilege on zoom_meetings.
-- Because public.zoom_meetings_student is a security_invoker view, this
-- broke it for every student: queries returned 403 Forbidden instead of
-- their upcoming/live classes, so the "Unirse a la clase" button never
-- appeared. This restores column-level SELECT (matching the view's
-- column list; zoom_start_url/created_by stay hidden) and the cohort-aware
-- RLS policy.

GRANT SELECT (id, programa_id, modulo_id, titulo, status, zoom_meeting_id, zoom_join_url, zoom_password, start_at, duration_min, docente_nombre, recording_share_url, recording_duration_min, cohort_id, created_at, updated_at) ON public.zoom_meetings TO authenticated;

DROP POLICY IF EXISTS "Estudiantes inscritos ven reuniones (via view)" ON public.zoom_meetings;

CREATE POLICY "Estudiantes inscritos ven reuniones (via view)" ON public.zoom_meetings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.enrollments e WHERE e.programa_id = zoom_meetings.programa_id AND e.user_id = auth.uid() AND e.estado IN ('activo','completado')) AND (zoom_meetings.cohort_id IS NULL OR EXISTS (SELECT 1 FROM public.cohort_enrollments ce WHERE ce.cohort_id = zoom_meetings.cohort_id AND ce.user_id = auth.uid() AND ce.estado = 'activo')));
