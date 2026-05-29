
-- 1. Recreate views with security_invoker=on (fixes SECURITY DEFINER view warning)
ALTER VIEW public.profiles_public SET (security_invoker = on);
ALTER VIEW public.teachers_public SET (security_invoker = on);
ALTER VIEW public.program_modules_catalog SET (security_invoker = on);
ALTER VIEW public.assessment_questions_student SET (security_invoker = on);

-- Ensure views remain readable
GRANT SELECT ON public.teachers_public TO anon, authenticated;
GRANT SELECT ON public.profiles_public TO anon, authenticated;
GRANT SELECT ON public.program_modules_catalog TO anon, authenticated;
GRANT SELECT ON public.assessment_questions_student TO authenticated;

-- 2. Restrict teachers base table: hide email/telefono from non-admins
DROP POLICY IF EXISTS "Auth ve docentes (sin contacto sensible para no-admin)" ON public.teachers;
-- Only admins can read raw teachers (with email/phone). Everyone else uses teachers_public view.
CREATE POLICY "Admins leen tabla teachers"
  ON public.teachers FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. course-materials storage: restrict SELECT to admin/docente.
-- Students access materials via signed URLs embedded in module records (bypass RLS).
DROP POLICY IF EXISTS "course-materials authenticated read" ON storage.objects;
CREATE POLICY "course-materials staff read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'course-materials'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'docente'::app_role))
  );
