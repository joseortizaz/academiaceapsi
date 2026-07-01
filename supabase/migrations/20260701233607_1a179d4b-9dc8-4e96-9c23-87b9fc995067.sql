
-- 1) Ampliar modalidad
ALTER TABLE public.programs DROP CONSTRAINT IF EXISTS programs_modalidad_check;
ALTER TABLE public.programs ADD CONSTRAINT programs_modalidad_check
  CHECK (modalidad = ANY (ARRAY['sincrono','asincrono','mixto','presencial']));

-- 2) Tabla de cohortes
CREATE TABLE public.program_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  modalidad text NOT NULL CHECK (modalidad = ANY (ARRAY['sincrono','asincrono','mixto','presencial'])),
  nivel_actual text,
  docente_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  horario text,
  fecha_inicio date,
  fecha_fin date,
  dias_clase jsonb NOT NULL DEFAULT '[]'::jsonb,
  ubicacion text,
  cupo_maximo integer,
  estado text NOT NULL DEFAULT 'planificado' CHECK (estado = ANY (ARRAY['planificado','activo','finalizado','cancelado'])),
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_cohorts TO authenticated;
GRANT ALL ON public.program_cohorts TO service_role;

ALTER TABLE public.program_cohorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins CRUD cohorts" ON public.program_cohorts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Teachers view their cohorts" ON public.program_cohorts
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = program_cohorts.docente_id AND t.user_id = auth.uid())
    OR public.is_teacher_of_program(program_cohorts.programa_id)
  );

CREATE POLICY "Teachers update limited fields on their cohorts" ON public.program_cohorts
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = program_cohorts.docente_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = program_cohorts.docente_id AND t.user_id = auth.uid()));

CREATE TRIGGER trg_program_cohorts_updated_at
  BEFORE UPDATE ON public.program_cohorts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: es docente de la cohorte
CREATE OR REPLACE FUNCTION public.is_teacher_of_cohort(_cohort_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.program_cohorts c
    JOIN public.teachers t ON t.id = c.docente_id
    WHERE c.id = _cohort_id AND t.user_id = auth.uid()
  );
$$;

-- 3) Relación alumno <-> cohorte
CREATE TABLE public.cohort_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.program_cohorts(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  estado text NOT NULL DEFAULT 'activo' CHECK (estado = ANY (ARRAY['activo','retirado','trasladado'])),
  fecha_asignacion timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, enrollment_id)
);

-- Solo una asignación activa por inscripción
CREATE UNIQUE INDEX cohort_enrollments_one_active_per_enrollment
  ON public.cohort_enrollments (enrollment_id)
  WHERE estado = 'activo';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohort_enrollments TO authenticated;
GRANT ALL ON public.cohort_enrollments TO service_role;

ALTER TABLE public.cohort_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins CRUD cohort_enrollments" ON public.cohort_enrollments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Teachers view students of their cohorts" ON public.cohort_enrollments
  FOR SELECT TO authenticated
  USING (public.is_teacher_of_cohort(cohort_id));

CREATE POLICY "Students view own cohort membership" ON public.cohort_enrollments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_cohort_enrollments_updated_at
  BEFORE UPDATE ON public.cohort_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
