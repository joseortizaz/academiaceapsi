-- Las notificaciones "Nueva entrega" del docente ahora enlazan a la entrega
-- concreta (?assessmentId=...&submissionId=...) para que el panel la abra
-- directamente, en vez de solo filtrar la lista por evaluación.

CREATE OR REPLACE FUNCTION public.notify_teacher_on_assessment_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assessment_titulo text;
  v_programa_id uuid;
  v_teacher_user uuid;
  v_student_name text;
  v_base text;
  v_enlace text;
  v_mensaje text;
BEGIN
  SELECT a.titulo, a.programa_id INTO v_assessment_titulo, v_programa_id
  FROM public.assessments a WHERE a.id = NEW.assessment_id;

  IF v_programa_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.user_id INTO v_teacher_user
  FROM public.programs p
  JOIN public.teachers t ON t.id = p.docente_id
  WHERE p.id = v_programa_id;

  IF v_teacher_user IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT btrim(COALESCE(pr.nombre, '') || ' ' || COALESCE(pr.apellido, ''))
    INTO v_student_name
  FROM public.profiles pr WHERE pr.id = NEW.user_id;

  IF v_student_name IS NULL OR v_student_name = '' THEN
    SELECT e.nombre_completo INTO v_student_name
    FROM public.enrollments e
    WHERE e.user_id = NEW.user_id AND e.programa_id = v_programa_id
    LIMIT 1;
  END IF;

  v_base := '/docente/calificaciones?assessmentId=' || NEW.assessment_id::text;
  v_enlace := v_base || '&submissionId=' || NEW.id::text;
  v_mensaje := COALESCE(NULLIF(v_student_name, ''), 'Un estudiante') || ' entregó su evaluación.';

  INSERT INTO public.notifications (user_id, tipo, titulo, mensaje, enlace, programa_id)
  SELECT
    v_teacher_user,
    'assessment_submission',
    'Nueva entrega: ' || COALESCE(v_assessment_titulo, 'Evaluación'),
    v_mensaje,
    v_enlace,
    v_programa_id
  WHERE NOT EXISTS (
    -- Misma deduplicación que antes (evaluación + alumno), aceptando enlaces
    -- antiguos (solo assessmentId) y nuevos (con submissionId).
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = v_teacher_user
      AND n.tipo = 'assessment_submission'
      AND (n.enlace = v_base OR n.enlace LIKE v_base || '&submissionId=%')
      AND n.mensaje = v_mensaje
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- Completar las notificaciones existentes con la entrega correspondiente
-- (mismo docente, misma evaluación y mismo nombre de alumno en el mensaje).
-- Si hay ambigüedad (más de una entrega coincide), se deja el enlace como está.
WITH candidatos AS (
  SELECT
    n.id AS notif_id,
    (array_agg(s.id ORDER BY s.fecha_entrega DESC))[1] AS submission_id,
    count(*) AS coincidencias
  FROM public.notifications n
  JOIN public.assessment_submissions s
    ON n.enlace = '/docente/calificaciones?assessmentId=' || s.assessment_id::text
  LEFT JOIN public.profiles pr ON pr.id = s.user_id
  WHERE n.tipo = 'assessment_submission'
    AND n.enlace NOT LIKE '%submissionId=%'
    AND n.mensaje = COALESCE(
      NULLIF(btrim(COALESCE(pr.nombre, '') || ' ' || COALESCE(pr.apellido, '')), ''),
      'Un estudiante'
    ) || ' entregó su evaluación.'
  GROUP BY n.id
)
UPDATE public.notifications n
SET enlace = n.enlace || '&submissionId=' || c.submission_id::text
FROM candidatos c
WHERE n.id = c.notif_id
  AND c.coincidencias = 1;
