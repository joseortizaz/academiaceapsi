
-- 1. COUPONS: only admins can read
DROP POLICY IF EXISTS "Ver cupones activos" ON public.coupons;

-- Server-side coupon validation function (safe to expose)
CREATE OR REPLACE FUNCTION public.validate_coupon(_codigo text)
RETURNS TABLE(valid boolean, porcentaje_descuento integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.coupons c
      WHERE c.codigo = _codigo
        AND c.activo = true
        AND (c.fecha_expiracion IS NULL OR c.fecha_expiracion > now())
        AND (c.usos_maximos IS NULL OR c.usos_actuales < c.usos_maximos)
    ) AS valid,
    (SELECT c.porcentaje_descuento FROM public.coupons c
      WHERE c.codigo = _codigo
        AND c.activo = true
        AND (c.fecha_expiracion IS NULL OR c.fecha_expiracion > now())
        AND (c.usos_maximos IS NULL OR c.usos_actuales < c.usos_maximos)
      LIMIT 1) AS porcentaje_descuento;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(text) TO authenticated, anon;

-- 2. ENROLLMENTS: restrict student UPDATE to contact info only via trigger
DROP POLICY IF EXISTS "Actualizar propias inscripciones" ON public.enrollments;

CREATE POLICY "Estudiantes actualizan contacto propio"
ON public.enrollments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND NOT has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = user_id AND NOT has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.prevent_enrollment_privileged_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass this check
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado
     OR NEW.progreso_porcentaje IS DISTINCT FROM OLD.progreso_porcentaje
     OR NEW.fecha_completado IS DISTINCT FROM OLD.fecha_completado
     OR NEW.fecha_vencimiento IS DISTINCT FROM OLD.fecha_vencimiento
     OR NEW.fecha_inscripcion IS DISTINCT FROM OLD.fecha_inscripcion
     OR NEW.pago_id IS DISTINCT FROM OLD.pago_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.programa_id IS DISTINCT FROM OLD.programa_id THEN
    RAISE EXCEPTION 'No autorizado a modificar campos sensibles de la inscripción';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enrollments_prevent_privileged_updates ON public.enrollments;
CREATE TRIGGER enrollments_prevent_privileged_updates
BEFORE UPDATE ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.prevent_enrollment_privileged_updates();

-- 3. TEACHERS: remove public access to base table (email/telefono exposed).
-- Public continues to read non-sensitive columns via the teachers_public view.
DROP POLICY IF EXISTS "Public can view visible teachers" ON public.teachers;

-- Allow docentes to read their own teacher row (used by docente dashboards)
CREATE POLICY "Docentes leen su perfil docente"
ON public.teachers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 4. PROGRAM_MODULES: allow docentes to manage modules of their own programs
CREATE POLICY "Docentes gestionan módulos de sus programas"
ON public.program_modules
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'docente'::app_role) AND EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = program_modules.programa_id AND p.docente_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'docente'::app_role) AND EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = program_modules.programa_id AND p.docente_id = auth.uid()
  )
);
