-- 1) Notificar a estudiantes cuando se publica una evaluación
CREATE OR REPLACE FUNCTION public.notify_students_on_assessment_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_programa_titulo text;
  v_enlace text;
  v_titulo text;
BEGIN
  SELECT titulo INTO v_programa_titulo FROM public.programs WHERE id = NEW.programa_id;

  v_enlace := '/estudiante/evaluaciones?assessmentId=' || NEW.id::text;
  v_titulo := CASE WHEN NEW.tipo = 'tarea' THEN 'Nueva tarea: ' ELSE 'Nueva evaluación: ' END || NEW.titulo;

  INSERT INTO public.notifications (user_id, tipo, titulo, mensaje, enlace, programa_id)
  SELECT
    e.user_id,
    'assessment_published',
    v_titulo,
    COALESCE(v_programa_titulo, 'Tu curso')
      || COALESCE(' — ' || left(regexp_replace(COALESCE(NEW.descripcion, ''), '<[^>]+>', '', 'g'), 140), ''),
    v_enlace,
    NEW.programa_id
  FROM public.enrollments e
  WHERE e.programa_id = NEW.programa_id
    AND e.estado IN ('activo','pendiente')
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = e.user_id
        AND n.tipo = 'assessment_published'
        AND n.enlace = v_enlace
    );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assessments_notify_students ON public.assessments;
CREATE TRIGGER assessments_notify_students
AFTER INSERT OR UPDATE ON public.assessments
FOR EACH ROW
WHEN ((pg_trigger_depth() >= 0) AND NEW.publicado)
EXECUTE FUNCTION public.notify_students_on_assessment_published();

-- 2) Notificar al docente cuando un estudiante entrega
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
  v_enlace text;
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

  v_enlace := '/docente/calificaciones?assessmentId=' || NEW.assessment_id::text;

  INSERT INTO public.notifications (user_id, tipo, titulo, mensaje, enlace, programa_id)
  SELECT
    v_teacher_user,
    'assessment_submission',
    'Nueva entrega: ' || COALESCE(v_assessment_titulo, 'Evaluación'),
    COALESCE(NULLIF(v_student_name, ''), 'Un estudiante') || ' entregó su evaluación.',
    v_enlace,
    v_programa_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = v_teacher_user
      AND n.tipo = 'assessment_submission'
      AND n.enlace = v_enlace
      AND n.mensaje = COALESCE(NULLIF(v_student_name, ''), 'Un estudiante') || ' entregó su evaluación.'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assessment_submissions_notify_teacher ON public.assessment_submissions;
CREATE TRIGGER assessment_submissions_notify_teacher
AFTER INSERT ON public.assessment_submissions
FOR EACH ROW EXECUTE FUNCTION public.notify_teacher_on_assessment_submission();