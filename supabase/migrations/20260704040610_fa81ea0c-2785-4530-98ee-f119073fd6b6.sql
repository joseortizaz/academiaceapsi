CREATE POLICY "Docentes ven inscripciones de sus programas"
ON public.enrollments
FOR SELECT
TO authenticated
USING (public.is_teacher_of_program(programa_id));