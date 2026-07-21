
CREATE OR REPLACE FUNCTION public.prevent_cohort_teacher_privileged_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
     OR NEW.fecha_fin IS DISTINCT FROM OLD.fecha_fin THEN
    RAISE EXCEPTION 'No autorizado a modificar campos sensibles del grupo/cohorte';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_cohort_teacher_privileged_updates ON public.program_cohorts;
CREATE TRIGGER trg_prevent_cohort_teacher_privileged_updates
  BEFORE UPDATE ON public.program_cohorts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_cohort_teacher_privileged_updates();
