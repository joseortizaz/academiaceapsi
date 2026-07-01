
-- Fix: enrollments_student_insert_no_estado_check
DROP POLICY IF EXISTS "Crear inscripción propia" ON public.enrollments;
CREATE POLICY "Crear inscripción propia"
  ON public.enrollments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND estado = 'pendiente'
    AND progreso_porcentaje = 0
    AND fecha_completado IS NULL
    AND pago_id IS NULL
  );

-- Fix: assessment_questions_correct_answers_exposed (defense in depth)
-- Revoke column-level SELECT on respuesta_correcta from authenticated role
REVOKE SELECT ON public.assessment_questions FROM authenticated;
GRANT SELECT (id, assessment_id, enunciado, tipo, opciones, puntaje, orden, created_at)
  ON public.assessment_questions TO authenticated;
