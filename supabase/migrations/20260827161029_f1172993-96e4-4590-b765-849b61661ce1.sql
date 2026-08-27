CREATE OR REPLACE FUNCTION public.is_teacher_of_program(_programa_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.programs p
    JOIN public.teachers t ON t.id = p.docente_id
    WHERE p.id = _programa_id AND t.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.program_cohorts c
    JOIN public.teachers t ON t.id = c.docente_id
    WHERE c.programa_id = _programa_id AND t.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.program_modules m
    JOIN public.teachers t ON t.id = m.docente_id
    WHERE m.programa_id = _programa_id AND t.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.program_modules_catalog mc
    JOIN public.teachers t ON t.id = mc.docente_id
    WHERE mc.programa_id = _programa_id AND t.user_id = auth.uid()
  )
$function$;

-- Programas del docente autenticado, con el alcance de su asignación
CREATE OR REPLACE FUNCTION public.my_teacher_programs()
 RETURNS TABLE(programa_id uuid, is_owner boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT id FROM public.teachers WHERE user_id = auth.uid())
  SELECT pid, bool_or(owner) FROM (
    SELECT p.id AS pid, true AS owner FROM public.programs p JOIN me ON me.id = p.docente_id
    UNION ALL
    SELECT c.programa_id, false FROM public.program_cohorts c JOIN me ON me.id = c.docente_id
    UNION ALL
    SELECT m.programa_id, false FROM public.program_modules m JOIN me ON me.id = m.docente_id
    UNION ALL
    SELECT mc.programa_id, false FROM public.program_modules_catalog mc JOIN me ON me.id = mc.docente_id
  ) s(pid, owner)
  GROUP BY pid
$function$;

REVOKE ALL ON FUNCTION public.my_teacher_programs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_teacher_programs() TO authenticated;

-- 2) Políticas con comparación de IDs incorrecta
DROP POLICY IF EXISTS "Docentes gestionan preguntas de sus evaluaciones" ON public.assessment_questions;
CREATE POLICY "Docentes gestionan preguntas de sus evaluaciones"
ON public.assessment_questions FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.assessments a
  WHERE a.id = assessment_questions.assessment_id
    AND (a.created_by = auth.uid() OR public.is_teacher_of_program(a.programa_id))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.assessments a
  WHERE a.id = assessment_questions.assessment_id
    AND (a.created_by = auth.uid() OR public.is_teacher_of_program(a.programa_id))
));

DROP POLICY IF EXISTS "Ver comentarios de lecciones" ON public.lesson_comments;
CREATE POLICY "Ver comentarios de lecciones"
ON public.lesson_comments FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR public.is_teacher_of_program(lesson_comments.programa_id)
  OR EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.programa_id = lesson_comments.programa_id
      AND e.user_id = auth.uid()
      AND e.estado = ANY (ARRAY['activo','completado'])
  )
);

DROP POLICY IF EXISTS "Crear comentarios de lecciones" ON public.lesson_comments;
CREATE POLICY "Crear comentarios de lecciones"
ON public.lesson_comments FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR public.is_teacher_of_program(lesson_comments.programa_id)
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.programa_id = lesson_comments.programa_id
        AND e.user_id = auth.uid()
        AND e.estado = ANY (ARRAY['activo','completado'])
    )
  )
);

DROP POLICY IF EXISTS "Docentes gestionan sus evaluaciones" ON public.assessments;
CREATE POLICY "Docentes gestionan sus evaluaciones"
ON public.assessments FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'docente'::app_role)
  AND (created_by = auth.uid() OR public.is_teacher_of_program(assessments.programa_id))
)
WITH CHECK (
  has_role(auth.uid(), 'docente'::app_role)
  AND created_by = auth.uid()
  AND public.is_teacher_of_program(assessments.programa_id)
);

DROP POLICY IF EXISTS "Docentes gestionan reuniones de sus programas" ON public.zoom_meetings;
CREATE POLICY "Docentes gestionan reuniones de sus programas"
ON public.zoom_meetings FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'docente'::app_role)
  AND (created_by = auth.uid() OR public.is_teacher_of_program(zoom_meetings.programa_id))
)
WITH CHECK (
  has_role(auth.uid(), 'docente'::app_role)
  AND created_by = auth.uid()
  AND public.is_teacher_of_program(zoom_meetings.programa_id)
);