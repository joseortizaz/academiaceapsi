-- course_requests: submissions only go through the server endpoint (validated + service role).
DROP POLICY IF EXISTS "Anyone can submit a course request" ON public.course_requests;
REVOKE INSERT ON public.course_requests FROM anon, authenticated;

-- contact_messages: keep open submissions, but only well-formed, unread messages.
DROP POLICY IF EXISTS "Cualquiera puede enviar mensajes" ON public.contact_messages;
CREATE POLICY "Cualquiera puede enviar mensajes validos"
ON public.contact_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  char_length(btrim(nombre)) BETWEEN 2 AND 120
  AND char_length(email) <= 160
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND (telefono IS NULL OR char_length(telefono) <= 30)
  AND char_length(btrim(asunto)) BETWEEN 2 AND 200
  AND char_length(btrim(mensaje)) BETWEEN 2 AND 5000
  AND coalesce(leido, false) = false
  AND coalesce(respondido, false) = false
);

-- mora_config: only admins, or students who have a payment-status record, can read it.
DROP POLICY IF EXISTS "mora_config lectura" ON public.mora_config;
CREATE POLICY "mora_config lectura"
ON public.mora_config
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.mora_estado me WHERE me.user_id = auth.uid())
);