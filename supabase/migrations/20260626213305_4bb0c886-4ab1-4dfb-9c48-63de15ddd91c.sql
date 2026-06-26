
-- 1) Fix mutable search_path on email queue helpers
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pgmq
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pgmq
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pgmq
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pgmq
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$function$;

-- 2) Defense-in-depth: revoke anon access to assessment_questions and zoom_meetings.
-- No anon policies exist for these tables, so RLS already denies; this removes the
-- table-level privilege so a future permissive policy cannot accidentally expose them.
REVOKE ALL ON public.assessment_questions FROM anon;
REVOKE ALL ON public.zoom_meetings FROM anon;

-- 3) Defensive SECURITY DEFINER RPC for future student quiz-taking flows.
-- Returns assessment questions WITHOUT the correct answer, only for users with an
-- active/completed enrollment in the program that owns the assessment.
CREATE OR REPLACE FUNCTION public.get_assessment_questions_for_student(_assessment_id uuid)
 RETURNS TABLE(id uuid, assessment_id uuid, enunciado text, tipo text, opciones jsonb, puntaje integer, orden integer)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $$
  SELECT q.id, q.assessment_id, q.enunciado, q.tipo, q.opciones, q.puntaje, q.orden
  FROM public.assessment_questions q
  JOIN public.assessments a ON a.id = q.assessment_id
  JOIN public.enrollments e ON e.programa_id = a.programa_id
  WHERE q.assessment_id = _assessment_id
    AND a.publicado = true
    AND e.user_id = auth.uid()
    AND e.estado IN ('activo','completado')
  ORDER BY q.orden;
$$;

REVOKE ALL ON FUNCTION public.get_assessment_questions_for_student(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_assessment_questions_for_student(uuid) TO authenticated;
