-- Bloqueo por mora (content_access_allowed, migración 0012) en las vías de
-- contenido que no pasan por RLS: vistas security definer y funciones de
-- evaluaciones. También aplica el cierre de cohorte (0016) a esas funciones.
-- Antes, un alumno restringido por mora (o de un grupo cerrado) podía ver
-- clases y grabaciones, leer preguntas y enviar evaluaciones.
-- Idempotente.

-- ============================================================
-- 1. Clases y grabaciones del alumno
-- ============================================================
create or replace view public.zoom_meetings_student
with (security_invoker = off) as
 select zm.id,
    zm.programa_id,
    zm.modulo_id,
    zm.titulo,
    zm.status,
    zm.zoom_meeting_id,
    zm.start_at,
    zm.duration_min,
    zm.docente_nombre,
    zm.recording_share_url,
    zm.recording_duration_min,
    zm.cohort_id,
    pc.nombre as cohort_nombre,
    zm.created_at,
    zm.updated_at
   from public.zoom_meetings zm
     left join public.program_cohorts pc on pc.id = zm.cohort_id
  where (public.has_role(auth.uid(), 'admin'::app_role)
         or public.is_teacher_of_program(zm.programa_id)
         or exists (select 1
                      from public.enrollments e
                     where e.programa_id = zm.programa_id
                       and e.user_id = auth.uid()))
    and public.content_access_allowed(auth.uid())
    and public.cohort_access_open(zm.programa_id, auth.uid());

-- ============================================================
-- 2. Preguntas de evaluaciones (vista y función)
-- ============================================================
create or replace view public.assessment_questions_student
with (security_invoker = false) as
 select q.id,
    q.assessment_id,
    q.tipo,
    q.enunciado,
    q.opciones,
    q.orden,
    q.puntaje,
    q.created_at
   from public.assessment_questions q
     join public.assessments a on a.id = q.assessment_id and a.publicado = true
  where exists (select 1
                  from public.enrollments e
                 where e.programa_id = a.programa_id
                   and e.user_id = auth.uid()
                   and e.estado = any (array['activo'::text, 'completado'::text]))
    and public.content_access_allowed(auth.uid())
    and public.cohort_access_open(a.programa_id, auth.uid());

create or replace function public.get_assessment_questions_for_student(_assessment_id uuid)
returns table(id uuid, assessment_id uuid, enunciado text, tipo text, opciones jsonb, puntaje integer, orden integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select q.id, q.assessment_id, q.enunciado, q.tipo, q.opciones, q.puntaje, q.orden
  from public.assessment_questions q
  join public.assessments a on a.id = q.assessment_id
  join public.enrollments e on e.programa_id = a.programa_id
  where q.assessment_id = _assessment_id
    and a.publicado = true
    and e.user_id = auth.uid()
    and e.estado in ('activo','completado')
    and public.content_access_allowed(auth.uid())
    and public.cohort_access_open(a.programa_id, auth.uid())
  order by q.orden;
$function$;

-- ============================================================
-- 3. Envío de evaluaciones
-- ============================================================
create or replace function public.submit_assessment(_assessment_id uuid, _respuestas jsonb)
returns table(submission_id uuid, puntaje_obtenido numeric, puntaje_maximo numeric, porcentaje numeric, auto_calificado boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_user uuid := auth.uid();
  v_enrolled boolean;
  v_programa uuid;
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

  IF NOT public.content_access_allowed(v_user) THEN
    RAISE EXCEPTION 'Su acceso a los contenidos ha sido restringido. Comuníquese con la dirección para regularizar su situación.';
  END IF;

  SELECT a.programa_id INTO v_programa FROM assessments a WHERE a.id = _assessment_id;
  IF NOT public.cohort_access_open(v_programa, v_user) THEN
    RAISE EXCEPTION 'El acceso a este programa finalizó: tu grupo cerró 10 días después de su fecha de término.';
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
