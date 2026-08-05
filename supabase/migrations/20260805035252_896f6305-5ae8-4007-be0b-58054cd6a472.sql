
CREATE OR REPLACE FUNCTION public.enrollment_only_contact_change(
  _id uuid,
  _user_id uuid,
  _programa_id uuid,
  _estado text,
  _progreso integer,
  _fecha_completado timestamptz,
  _fecha_vencimiento timestamptz,
  _fecha_inscripcion timestamptz,
  _pago_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.id = _id
      AND e.user_id IS NOT DISTINCT FROM _user_id
      AND e.programa_id IS NOT DISTINCT FROM _programa_id
      AND e.estado IS NOT DISTINCT FROM _estado
      AND e.progreso_porcentaje IS NOT DISTINCT FROM _progreso
      AND e.fecha_completado IS NOT DISTINCT FROM _fecha_completado
      AND e.fecha_vencimiento IS NOT DISTINCT FROM _fecha_vencimiento
      AND e.fecha_inscripcion IS NOT DISTINCT FROM _fecha_inscripcion
      AND e.pago_id IS NOT DISTINCT FROM _pago_id
  )
$$;

REVOKE ALL ON FUNCTION public.enrollment_only_contact_change(uuid,uuid,uuid,text,integer,timestamptz,timestamptz,timestamptz,uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.enrollment_only_contact_change(uuid,uuid,uuid,text,integer,timestamptz,timestamptz,timestamptz,uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Estudiantes actualizan contacto propio" ON public.enrollments;

CREATE POLICY "Estudiantes actualizan contacto propio"
ON public.enrollments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND NOT has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (
  auth.uid() = user_id
  AND NOT has_role(auth.uid(), 'admin'::app_role)
  AND public.enrollment_only_contact_change(
        id, user_id, programa_id, estado, progreso_porcentaje,
        fecha_completado, fecha_vencimiento, fecha_inscripcion, pago_id
      )
);
