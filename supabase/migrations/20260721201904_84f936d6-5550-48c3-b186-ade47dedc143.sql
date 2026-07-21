
GRANT SELECT ON public.profiles_public TO authenticated;

CREATE POLICY "Docentes ven perfiles de alumnos inscritos en sus programas"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.enrollments e
    WHERE e.user_id = profiles.id
      AND public.is_teacher_of_program(e.programa_id)
  )
);
