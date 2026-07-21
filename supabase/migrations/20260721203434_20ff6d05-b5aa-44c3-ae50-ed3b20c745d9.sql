CREATE POLICY "Docentes de cohorte ven inscripciones de su cohorte"
ON public.enrollments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.cohort_enrollments ce
    WHERE ce.enrollment_id = enrollments.id
      AND public.is_teacher_of_cohort(ce.cohort_id)
  )
);

CREATE POLICY "Docentes de cohorte ven perfiles de alumnos del cohorte"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.cohort_enrollments ce
    JOIN public.enrollments e ON e.id = ce.enrollment_id
    WHERE e.user_id = profiles.id
      AND public.is_teacher_of_cohort(ce.cohort_id)
  )
);