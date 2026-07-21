
CREATE TABLE public.assessment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  respuestas jsonb NOT NULL DEFAULT '{}'::jsonb,
  puntaje_obtenido numeric,
  puntaje_maximo numeric,
  porcentaje numeric,
  estado text NOT NULL DEFAULT 'entregado' CHECK (estado IN ('entregado','calificado','revision')),
  auto_calificado boolean NOT NULL DEFAULT false,
  feedback text,
  calificado_por uuid,
  fecha_entrega timestamptz NOT NULL DEFAULT now(),
  fecha_calificacion timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assessment_submissions_assessment ON public.assessment_submissions(assessment_id);
CREATE INDEX idx_assessment_submissions_user ON public.assessment_submissions(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_submissions TO authenticated;
GRANT ALL ON public.assessment_submissions TO service_role;

ALTER TABLE public.assessment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Estudiantes ven sus entregas"
  ON public.assessment_submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Estudiantes crean sus entregas"
  ON public.assessment_submissions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.assessments a
      JOIN public.enrollments e ON e.programa_id = a.programa_id
      WHERE a.id = assessment_id
        AND a.publicado = true
        AND e.user_id = auth.uid()
        AND e.estado IN ('activo','completado')
    )
  );

CREATE POLICY "Docentes y admins ven entregas de sus evaluaciones"
  ON public.assessment_submissions FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_id
        AND (a.created_by = auth.uid() OR public.is_teacher_of_program(a.programa_id))
    )
  );

CREATE POLICY "Docentes y admins califican entregas"
  ON public.assessment_submissions FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_id
        AND (a.created_by = auth.uid() OR public.is_teacher_of_program(a.programa_id))
    )
  );

CREATE TRIGGER update_assessment_submissions_updated_at
  BEFORE UPDATE ON public.assessment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grading function: security definer so it can read respuesta_correcta
CREATE OR REPLACE FUNCTION public.submit_assessment(_assessment_id uuid, _respuestas jsonb)
RETURNS TABLE(submission_id uuid, puntaje_obtenido numeric, puntaje_maximo numeric, porcentaje numeric, auto_calificado boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_enrolled boolean;
  v_all_auto boolean := true;
  v_total numeric := 0;
  v_got numeric := 0;
  v_sub_id uuid;
  q record;
  ans text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM assessments a
    JOIN enrollments e ON e.programa_id = a.programa_id
    WHERE a.id = _assessment_id
      AND a.publicado = true
      AND e.user_id = v_user
      AND e.estado IN ('activo','completado')
  ) INTO v_enrolled;

  IF NOT v_enrolled THEN
    RAISE EXCEPTION 'No autorizado para esta evaluación';
  END IF;

  FOR q IN SELECT id, tipo, respuesta_correcta, puntaje FROM assessment_questions WHERE assessment_id = _assessment_id LOOP
    v_total := v_total + q.puntaje;
    ans := _respuestas ->> q.id::text;
    IF q.tipo IN ('opcion_multiple','verdadero_falso') THEN
      IF ans IS NOT NULL AND lower(trim(ans)) = lower(trim(coalesce(q.respuesta_correcta,''))) THEN
        v_got := v_got + q.puntaje;
      END IF;
    ELSE
      v_all_auto := false;
    END IF;
  END LOOP;

  INSERT INTO assessment_submissions (
    assessment_id, user_id, respuestas, puntaje_obtenido, puntaje_maximo, porcentaje,
    estado, auto_calificado, fecha_calificacion
  ) VALUES (
    _assessment_id, v_user, _respuestas,
    CASE WHEN v_all_auto THEN v_got ELSE NULL END,
    v_total,
    CASE WHEN v_all_auto AND v_total > 0 THEN round((v_got / v_total) * 100, 2) ELSE NULL END,
    CASE WHEN v_all_auto THEN 'calificado' ELSE 'revision' END,
    v_all_auto,
    CASE WHEN v_all_auto THEN now() ELSE NULL END
  ) RETURNING id INTO v_sub_id;

  RETURN QUERY SELECT v_sub_id, 
    CASE WHEN v_all_auto THEN v_got ELSE NULL END::numeric,
    v_total,
    CASE WHEN v_all_auto AND v_total > 0 THEN round((v_got / v_total) * 100, 2) ELSE NULL END::numeric,
    v_all_auto;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_assessment(uuid, jsonb) TO authenticated;
