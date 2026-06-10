-- Remove student access to assessment_questions base table (which exposes respuesta_correcta).
-- Students must query the public.assessment_questions_student view instead, which omits the answer key.
DROP POLICY IF EXISTS "Estudiantes leen preguntas de evaluaciones publicadas" ON public.assessment_questions;

-- Redefine the student view as security-definer (default) so it does not require
-- a base-table SELECT policy, and embed the enrollment + publication check inline.
DROP VIEW IF EXISTS public.assessment_questions_student;
CREATE VIEW public.assessment_questions_student
WITH (security_invoker = false) AS
SELECT
  q.id,
  q.assessment_id,
  q.tipo,
  q.enunciado,
  q.opciones,
  q.orden,
  q.puntaje,
  q.created_at
FROM public.assessment_questions q
JOIN public.assessments a
  ON a.id = q.assessment_id
 AND a.publicado = true
WHERE EXISTS (
  SELECT 1
  FROM public.enrollments e
  WHERE e.programa_id = a.programa_id
    AND e.user_id = auth.uid()
    AND e.estado = ANY (ARRAY['activo','completado'])
);

GRANT SELECT ON public.assessment_questions_student TO authenticated;