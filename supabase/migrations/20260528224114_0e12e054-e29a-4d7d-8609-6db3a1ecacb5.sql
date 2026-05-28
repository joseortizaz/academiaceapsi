
CREATE TABLE public.zoom_meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  programa_id UUID NOT NULL,
  modulo_id UUID,
  titulo TEXT NOT NULL,
  docente_nombre TEXT,
  zoom_meeting_id TEXT NOT NULL,
  zoom_join_url TEXT NOT NULL,
  zoom_start_url TEXT,
  zoom_password TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'scheduled',
  auto_record BOOLEAN NOT NULL DEFAULT true,
  recording_url TEXT,
  recording_share_url TEXT,
  recording_password TEXT,
  recording_duration_min INTEGER,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_zoom_meetings_programa ON public.zoom_meetings(programa_id);
CREATE INDEX idx_zoom_meetings_status ON public.zoom_meetings(status);
CREATE UNIQUE INDEX idx_zoom_meetings_zoom_id ON public.zoom_meetings(zoom_meeting_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zoom_meetings TO authenticated;
GRANT ALL ON public.zoom_meetings TO service_role;

ALTER TABLE public.zoom_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestionan reuniones zoom"
ON public.zoom_meetings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Docentes gestionan reuniones de sus programas"
ON public.zoom_meetings FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'docente'::app_role) AND (
    created_by = auth.uid() OR EXISTS (
      SELECT 1 FROM programs p WHERE p.id = zoom_meetings.programa_id AND p.docente_id = auth.uid()
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'docente'::app_role) AND created_by = auth.uid()
);

CREATE POLICY "Estudiantes inscritos ven reuniones"
ON public.zoom_meetings FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM enrollments e
    WHERE e.programa_id = zoom_meetings.programa_id
      AND e.user_id = auth.uid()
      AND e.estado IN ('activo','completado')
  )
);

CREATE TRIGGER update_zoom_meetings_updated_at
BEFORE UPDATE ON public.zoom_meetings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.zoom_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event TEXT NOT NULL,
  event_ts BIGINT,
  zoom_meeting_id TEXT,
  payload JSONB NOT NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT false,
  processed BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_zoom_webhook_logs_event ON public.zoom_webhook_logs(event);
CREATE INDEX idx_zoom_webhook_logs_meeting ON public.zoom_webhook_logs(zoom_meeting_id);
CREATE UNIQUE INDEX idx_zoom_webhook_logs_dedupe ON public.zoom_webhook_logs(event, event_ts, zoom_meeting_id) WHERE event_ts IS NOT NULL;

GRANT SELECT ON public.zoom_webhook_logs TO authenticated;
GRANT ALL ON public.zoom_webhook_logs TO service_role;

ALTER TABLE public.zoom_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins ven logs zoom"
ON public.zoom_webhook_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
