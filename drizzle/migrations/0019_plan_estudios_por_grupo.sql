-- Versiones del plan de estudios por módulo y por grupo/cohorte.
--
-- Contexto: en noviembre de 2026 se actualizaron 7 diplomados. Los módulos y
-- lecciones pertenecen al programa (no al grupo), así que los grupos que siguen el
-- programa anterior y los que empiezan con el nuevo compartirían la misma lista.
--
-- Reglas (las mismas que src/lib/plan-estudios.ts):
--   - Módulo sin versión (NULL): lo ven todos los grupos.
--   - Grupo sin versión (NULL): ve todos los módulos (comportamiento anterior).
--   - Si ambos tienen versión, el grupo solo ve los módulos de su misma versión.
--
-- Idempotente: se puede aplicar más de una vez.

-- 1. Columnas
ALTER TABLE public.course_modules  ADD COLUMN IF NOT EXISTS plan_version smallint;
ALTER TABLE public.program_cohorts ADD COLUMN IF NOT EXISTS plan_version smallint;

COMMENT ON COLUMN public.course_modules.plan_version IS
  'Versión del plan de estudios a la que pertenece el módulo. NULL = visible para todos los grupos.';
COMMENT ON COLUMN public.program_cohorts.plan_version IS
  'Versión del plan de estudios que sigue el grupo. NULL = ve todos los módulos.';

-- 2. Plan del grupo activo de una inscripción
CREATE OR REPLACE FUNCTION public.enrollment_plan_version(_enrollment_id uuid)
RETURNS smallint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT pc.plan_version
    FROM public.cohort_enrollments ce
    JOIN public.program_cohorts pc ON pc.id = ce.cohort_id
   WHERE ce.enrollment_id = _enrollment_id
     AND ce.estado = 'activo'
   ORDER BY ce.fecha_asignacion DESC NULLS LAST
   LIMIT 1;
$$;

-- 3. ¿Una lección (por su módulo) cuenta para un plan dado?
CREATE OR REPLACE FUNCTION public.leccion_visible_para_plan(_modulo_id uuid, _plan smallint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _plan IS NULL
      OR _modulo_id IS NULL
      OR COALESCE(
           (SELECT cm.plan_version IS NULL OR cm.plan_version = _plan
              FROM public.course_modules cm
             WHERE cm.id = _modulo_id),
           true);
$$;

-- 4. El progreso de la inscripción cuenta solo las lecciones de su plan.
--    Igual a la versión en producción salvo los dos filtros por plan.
CREATE OR REPLACE FUNCTION public.recalc_enrollment_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_enrollment_id uuid;
  v_programa_id uuid;
  v_plan smallint;
  v_total int;
  v_done int;
  v_pct int;
BEGIN
  v_enrollment_id := COALESCE(NEW.enrollment_id, OLD.enrollment_id);
  IF v_enrollment_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT programa_id INTO v_programa_id FROM public.enrollments WHERE id = v_enrollment_id;
  IF v_programa_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_plan := public.enrollment_plan_version(v_enrollment_id);

  SELECT count(*) INTO v_total
    FROM public.program_modules pm
   WHERE pm.programa_id = v_programa_id
     AND public.leccion_visible_para_plan(pm.modulo_id, v_plan);
  SELECT count(*) INTO v_done
    FROM public.module_progress mp
    JOIN public.program_modules pm ON pm.id = mp.modulo_id
   WHERE mp.enrollment_id = v_enrollment_id
     AND mp.completado = true
     AND pm.programa_id = v_programa_id
     AND public.leccion_visible_para_plan(pm.modulo_id, v_plan);

  v_pct := CASE WHEN v_total > 0 THEN round((v_done::numeric / v_total) * 100)::int ELSE 0 END;

  PERFORM set_config('app.bypass_enrollment_guard', '1', true);
  UPDATE public.enrollments
     SET progreso_porcentaje = v_pct,
         estado = CASE
                    WHEN v_pct >= 100 THEN 'completado'
                    WHEN estado = 'completado' AND v_pct < 100 THEN 'activo'
                    ELSE estado
                  END,
         fecha_completado = CASE WHEN v_pct >= 100 THEN COALESCE(fecha_completado, now()) ELSE NULL END
   WHERE id = v_enrollment_id;
  PERFORM set_config('app.bypass_enrollment_guard', '0', true);

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 5. Solo un admin puede cambiar el plan de un grupo (los docentes editan otros campos).
CREATE OR REPLACE FUNCTION public.prevent_cohort_teacher_privileged_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.programa_id IS DISTINCT FROM OLD.programa_id
     OR NEW.docente_id IS DISTINCT FROM OLD.docente_id
     OR NEW.estado IS DISTINCT FROM OLD.estado
     OR NEW.cupo_maximo IS DISTINCT FROM OLD.cupo_maximo
     OR NEW.nombre IS DISTINCT FROM OLD.nombre
     OR NEW.modalidad IS DISTINCT FROM OLD.modalidad
     OR NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio
     OR NEW.fecha_fin IS DISTINCT FROM OLD.fecha_fin
     OR NEW.plan_version IS DISTINCT FROM OLD.plan_version THEN
    RAISE EXCEPTION 'No autorizado a modificar campos sensibles del grupo/cohorte';
  END IF;
  RETURN NEW;
END;
$function$;
