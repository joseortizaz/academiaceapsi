
-- Restrict student UPDATE on enrollments to contact columns only via column-level grants
REVOKE UPDATE ON public.enrollments FROM authenticated;
GRANT UPDATE (nombre_completo, email_contacto, telefono_contacto, area_profesional) ON public.enrollments TO authenticated;

-- Tighten module_progress policies to require active/completed enrollment
DROP POLICY IF EXISTS "Insertar progreso propio" ON public.module_progress;
DROP POLICY IF EXISTS "Actualizar progreso propio" ON public.module_progress;

CREATE POLICY "Insertar progreso propio"
ON public.module_progress
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.id = module_progress.enrollment_id
      AND e.user_id = auth.uid()
      AND e.estado = ANY (ARRAY['activo','completado'])
  )
);

CREATE POLICY "Actualizar progreso propio"
ON public.module_progress
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.id = module_progress.enrollment_id
      AND e.user_id = auth.uid()
      AND e.estado = ANY (ARRAY['activo','completado'])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.id = module_progress.enrollment_id
      AND e.user_id = auth.uid()
      AND e.estado = ANY (ARRAY['activo','completado'])
  )
);
