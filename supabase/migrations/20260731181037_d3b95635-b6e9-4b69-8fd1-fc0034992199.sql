DROP POLICY IF EXISTS "Estudiantes actualizan contacto propio" ON public.enrollments;

CREATE POLICY "Estudiantes actualizan contacto propio"
ON public.enrollments
FOR UPDATE
TO authenticated
USING ((auth.uid() = user_id) AND (NOT has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK ((auth.uid() = user_id) AND (NOT has_role(auth.uid(), 'admin'::app_role)));