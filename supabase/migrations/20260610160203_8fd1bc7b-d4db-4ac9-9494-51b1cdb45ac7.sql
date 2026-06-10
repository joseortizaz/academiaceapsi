
-- Restrict Realtime channel subscriptions for notifications and community posts
-- Notifications channel: notif-<user_id> — only the owner may subscribe
CREATE POLICY "Users subscribe to own notifications channel"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() = 'notif-' || auth.uid()::text
);

-- Community posts channel: community-<programa_id> — only students enrolled (or teacher) may subscribe
CREATE POLICY "Enrolled users subscribe to community channel"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() LIKE 'community-%'
  AND EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.user_id = auth.uid()
      AND e.programa_id::text = substring(realtime.topic() from 11)
      AND e.estado IN ('activo','completado','pendiente')
    UNION
    SELECT 1 FROM public.programs p
    JOIN public.teachers t ON t.id = p.docente_id
    WHERE t.user_id = auth.uid()
      AND p.id::text = substring(realtime.topic() from 11)
  )
);
