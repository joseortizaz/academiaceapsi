
ALTER TABLE public.program_modules
  ADD COLUMN IF NOT EXISTS disponible_offset_dias integer;

CREATE OR REPLACE FUNCTION public.is_module_available_for_user(
  _user_id uuid, _modulo_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH m AS (
    SELECT pm.programa_id, pm.disponible_desde, pm.disponible_offset_dias
    FROM public.program_modules pm WHERE pm.id = _modulo_id
  )
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM m WHERE public.is_teacher_of_program(m.programa_id))
    OR EXISTS (
      SELECT 1 FROM public.enrollments e, m
      WHERE e.user_id = _user_id AND e.programa_id = m.programa_id
        AND e.estado = 'completado'
    )
    OR EXISTS (
      SELECT 1
      FROM public.enrollments e
      JOIN public.cohort_enrollments ce ON ce.enrollment_id = e.id AND ce.estado = 'activo'
      JOIN public.program_cohorts c ON c.id = ce.cohort_id
      , m
      WHERE e.user_id = _user_id
        AND e.programa_id = m.programa_id
        AND e.estado IN ('activo','completado')
        AND (
          (m.disponible_offset_dias IS NOT NULL
             AND c.fecha_inicio IS NOT NULL
             AND now()::date >= c.fecha_inicio + (m.disponible_offset_dias || ' days')::interval)
          OR (m.disponible_offset_dias IS NULL
             AND (m.disponible_desde IS NULL OR now() >= m.disponible_desde))
        )
    )
    OR EXISTS (
      -- Sin cohortes: comportamiento previo con disponible_desde
      SELECT 1 FROM public.enrollments e, m
      WHERE e.user_id = _user_id
        AND e.programa_id = m.programa_id
        AND e.estado IN ('activo','completado')
        AND NOT EXISTS (
          SELECT 1 FROM public.cohort_enrollments ce2
          WHERE ce2.enrollment_id = e.id AND ce2.estado = 'activo'
        )
        AND m.disponible_offset_dias IS NULL
        AND (m.disponible_desde IS NULL OR now() >= m.disponible_desde)
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_module_available_for_user(uuid, uuid) TO authenticated;
