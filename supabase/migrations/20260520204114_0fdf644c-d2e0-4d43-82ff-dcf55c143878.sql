CREATE POLICY "Estudiantes emiten su certificado al completar"
ON public.certificates
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.id = certificates.enrollment_id
      AND e.user_id = auth.uid()
      AND e.progreso_porcentaje = 100
  )
);