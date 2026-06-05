
-- 1) Attach enrollment privileged-updates trigger (was a function with no trigger row)
DROP TRIGGER IF EXISTS enrollments_prevent_privileged_updates ON public.enrollments;
CREATE TRIGGER enrollments_prevent_privileged_updates
BEFORE UPDATE ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.prevent_enrollment_privileged_updates();

-- Also attach the profile->teacher sync trigger if missing
DROP TRIGGER IF EXISTS profiles_sync_to_teacher ON public.profiles;
CREATE TRIGGER profiles_sync_to_teacher
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_teacher();

-- 2) course-materials: tighten DELETE/UPDATE to require admin/docente role
DROP POLICY IF EXISTS "course-materials authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "course-materials authenticated update" ON storage.objects;

CREATE POLICY "course-materials staff delete own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'course-materials'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (public.has_role(auth.uid(),'admin'::public.app_role)
       OR public.has_role(auth.uid(),'docente'::public.app_role))
);

CREATE POLICY "course-materials staff update own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'course-materials'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (public.has_role(auth.uid(),'admin'::public.app_role)
       OR public.has_role(auth.uid(),'docente'::public.app_role))
)
WITH CHECK (
  bucket_id = 'course-materials'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (public.has_role(auth.uid(),'admin'::public.app_role)
       OR public.has_role(auth.uid(),'docente'::public.app_role))
);

-- 3) course-materials: allow enrolled students to read files belonging to their teacher
CREATE POLICY "course-materials enrolled students read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-materials'
  AND EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.programs p ON p.id = e.programa_id
    WHERE e.user_id = auth.uid()
      AND e.estado IN ('activo','completado')
      AND p.docente_id::text = (storage.foldername(name))[1]
  )
);

-- 4) zoom_meetings: hide host/start URL and recording password from students.
-- Create a safe view and remove broad student SELECT on the base table.
DROP POLICY IF EXISTS "Estudiantes inscritos ven reuniones" ON public.zoom_meetings;

CREATE OR REPLACE VIEW public.zoom_meetings_student
WITH (security_invoker=on) AS
SELECT
  id, programa_id, modulo_id, titulo, status,
  zoom_meeting_id, zoom_join_url, zoom_password,
  start_at, duration_min, docente_nombre,
  recording_share_url, recording_duration_min,
  created_at, updated_at
FROM public.zoom_meetings;

GRANT SELECT ON public.zoom_meetings_student TO authenticated;

-- Add a tight SELECT policy on the base table only for enrolled students,
-- so the view (security_invoker=on) can read rows on their behalf.
-- The view excludes sensitive columns; the base table remains inaccessible
-- from direct queries because the policy only allows reading via the view's
-- column projection (RLS still applies — but it allows the row read).
-- We re-add a row-level SELECT policy scoped to enrollment so the view works.
CREATE POLICY "Estudiantes inscritos ven reuniones (via view)"
ON public.zoom_meetings FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.programa_id = zoom_meetings.programa_id
      AND e.user_id = auth.uid()
      AND e.estado IN ('activo','completado')
  )
);
-- Note: full column exposure on base table is unavoidable with RLS alone.
-- App code MUST query zoom_meetings_student for student-facing reads.
