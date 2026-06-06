
-- =============================================================
-- 1. program_access_links: ocultar password a estudiantes
-- =============================================================
REVOKE SELECT ON public.program_access_links FROM authenticated;
GRANT SELECT (id, programa_id, modulo_id, tipo, url, meeting_id, activo, created_at)
  ON public.program_access_links TO authenticated;
-- service_role y admin (via has_role) siguen con acceso total

-- =============================================================
-- 2. enrollments: restringir columnas que pueden actualizar estudiantes
-- =============================================================
REVOKE UPDATE ON public.enrollments FROM authenticated;
GRANT UPDATE (nombre_completo, documento_identidad, email_contacto, telefono_contacto, area_profesional, notas)
  ON public.enrollments TO authenticated;
-- INSERT/SELECT/DELETE permanecen sin cambios; el trigger
-- prevent_enrollment_privileged_updates sigue como defensa en profundidad.
-- Admins escriben via service_role o políticas FOR ALL.

-- =============================================================
-- 3. assessment_questions: permitir leer enunciado pero no la respuesta correcta
-- =============================================================
REVOKE SELECT ON public.assessment_questions FROM authenticated;
GRANT SELECT (id, assessment_id, enunciado, tipo, opciones, puntaje, orden, created_at)
  ON public.assessment_questions TO authenticated;

DROP POLICY IF EXISTS "Estudiantes leen preguntas de evaluaciones publicadas" ON public.assessment_questions;
CREATE POLICY "Estudiantes leen preguntas de evaluaciones publicadas"
  ON public.assessment_questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.assessments a
      JOIN public.enrollments e
        ON e.programa_id = a.programa_id
       AND e.user_id = auth.uid()
       AND e.estado = ANY (ARRAY['activo','completado'])
      WHERE a.id = assessment_questions.assessment_id
        AND a.publicado = true
    )
  );
