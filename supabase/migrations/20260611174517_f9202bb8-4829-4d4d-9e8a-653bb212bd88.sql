
-- Permitir bypass interno controlado en el trigger protector
CREATE OR REPLACE FUNCTION public.prevent_enrollment_privileged_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bypass interno (recálculo automático del progreso)
  IF current_setting('app.bypass_enrollment_guard', true) = '1' THEN
    RETURN NEW;
  END IF;

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

-- Recalcula el progreso de la inscripción a partir de module_progress
CREATE OR REPLACE FUNCTION public.recalc_enrollment_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment_id uuid;
  v_programa_id uuid;
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

  SELECT count(*) INTO v_total FROM public.program_modules WHERE programa_id = v_programa_id;
  SELECT count(*) INTO v_done
    FROM public.module_progress mp
    JOIN public.program_modules pm ON pm.id = mp.modulo_id
   WHERE mp.enrollment_id = v_enrollment_id
     AND mp.completado = true
     AND pm.programa_id = v_programa_id;

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
$$;

DROP TRIGGER IF EXISTS trg_recalc_enrollment_progress ON public.module_progress;
CREATE TRIGGER trg_recalc_enrollment_progress
AFTER INSERT OR UPDATE OR DELETE ON public.module_progress
FOR EACH ROW EXECUTE FUNCTION public.recalc_enrollment_progress();

-- Backfill de inscripciones existentes
DO $$
DECLARE r record; v_total int; v_done int; v_pct int;
BEGIN
  PERFORM set_config('app.bypass_enrollment_guard', '1', true);
  FOR r IN SELECT id, programa_id FROM public.enrollments LOOP
    SELECT count(*) INTO v_total FROM public.program_modules WHERE programa_id = r.programa_id;
    SELECT count(*) INTO v_done
      FROM public.module_progress mp
      JOIN public.program_modules pm ON pm.id = mp.modulo_id
     WHERE mp.enrollment_id = r.id AND mp.completado = true AND pm.programa_id = r.programa_id;
    v_pct := CASE WHEN v_total > 0 THEN round((v_done::numeric / v_total) * 100)::int ELSE 0 END;

    UPDATE public.enrollments e
       SET progreso_porcentaje = v_pct,
           estado = CASE
                      WHEN v_pct >= 100 THEN 'completado'
                      WHEN e.estado = 'completado' AND v_pct < 100 THEN 'activo'
                      ELSE e.estado
                    END,
           fecha_completado = CASE WHEN v_pct >= 100 THEN COALESCE(e.fecha_completado, now()) ELSE NULL END
     WHERE e.id = r.id;
  END LOOP;
  PERFORM set_config('app.bypass_enrollment_guard', '0', true);
END $$;
