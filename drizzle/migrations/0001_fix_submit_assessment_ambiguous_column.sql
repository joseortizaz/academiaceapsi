CREATE OR REPLACE FUNCTION public.submit_assessment(_assessment_id uuid, _respuestas jsonb)
 RETURNS TABLE(submission_id uuid, puntaje_obtenido numeric, puntaje_maximo numeric, porcentaje numeric, auto_calificado boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_enrolled boolean;
  v_all_auto boolean := true;
  v_total numeric := 0;
  v_got numeric := 0;
  v_count int := 0;
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
    v_count := v_count + 1;
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

  IF v_count = 0 THEN
    v_all_auto := false;
    SELECT coalesce(a.puntaje_maximo, 0) INTO v_total FROM assessments a WHERE a.id = _assessment_id;
  END IF;

  INSERT INTO assessment_submissions AS s (
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
  ) RETURNING s.id INTO v_sub_id;

  RETURN QUERY SELECT v_sub_id,
    CASE WHEN v_all_auto THEN v_got ELSE NULL END::numeric,
    v_total,
    CASE WHEN v_all_auto AND v_total > 0 THEN round((v_got / v_total) * 100, 2) ELSE NULL END::numeric,
    v_all_auto;
END;
$function$;