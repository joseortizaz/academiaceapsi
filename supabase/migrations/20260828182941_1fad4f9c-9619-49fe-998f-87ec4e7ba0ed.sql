CREATE TABLE public.zoom_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  zoom_user_id text,
  teacher_id uuid UNIQUE REFERENCES public.teachers(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.zoom_licenses TO service_role;

ALTER TABLE public.zoom_licenses ENABLE ROW LEVEL SECURITY;

INSERT INTO public.zoom_licenses (email, zoom_user_id, teacher_id, created_at) VALUES
  ('ceapsi.rd@gmail.com', 'lFvrBw4ORReT6IE0wujNyA', NULL, now()),
  ('seminario.orpe@gmail.com', 'qeDMt4CqRTiU22MGCd0MIQ', NULL, now() + interval '1 second');

ALTER TABLE public.zoom_meetings ADD COLUMN IF NOT EXISTS zoom_host_email text;