-- 1) Remove student SELECT on zoom_meetings base table; students must use zoom_meetings_student view
DROP POLICY IF EXISTS "Estudiantes inscritos ven reuniones (via view)" ON public.zoom_meetings;

-- 2) Hide plaintext password in program_access_links from non-admin readers via column-level privileges
REVOKE SELECT (password) ON public.program_access_links FROM authenticated, anon;
GRANT SELECT (id, programa_id, modulo_id, tipo, url, meeting_id, activo, created_at) ON public.program_access_links TO authenticated;

-- 3) Narrow enrollments student UPDATE via column-level privileges (defense-in-depth alongside trigger)
REVOKE UPDATE ON public.enrollments FROM authenticated;
GRANT UPDATE (nombre_completo, documento_identidad, email_contacto, telefono_contacto, area_profesional, notas) ON public.enrollments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.enrollments TO authenticated;

-- 4) Realtime channel authorization: restrict lesson-comments-<moduloId> topics to enrolled users
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lesson comments realtime read" ON realtime.messages;
CREATE POLICY "Lesson comments realtime read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'lesson-comments-%' THEN
      EXISTS (
        SELECT 1
        FROM public.program_modules pm
        JOIN public.enrollments e ON e.programa_id = pm.programa_id
        WHERE pm.id::text = substring(realtime.topic() from 'lesson-comments-(.*)')
          AND e.user_id = auth.uid()
          AND e.estado IN ('activo','completado')
      )
      OR EXISTS (
        SELECT 1
        FROM public.program_modules pm
        JOIN public.programs p ON p.id = pm.programa_id
        WHERE pm.id::text = substring(realtime.topic() from 'lesson-comments-(.*)')
          AND p.docente_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    ELSE false
  END
);
