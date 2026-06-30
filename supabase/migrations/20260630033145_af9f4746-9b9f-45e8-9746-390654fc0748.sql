
CREATE TABLE public.events (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  slug text not null unique,
  fecha date,
  descripcion text,
  cover_url text,
  publicado boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published events" ON public.events
  FOR SELECT USING (publicado = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage events" ON public.events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.event_media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  tipo text not null check (tipo in ('image','video')),
  url text not null,
  titulo text,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

CREATE INDEX event_media_event_id_idx ON public.event_media(event_id);

GRANT SELECT ON public.event_media TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_media TO authenticated;
GRANT ALL ON public.event_media TO service_role;

ALTER TABLE public.event_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view media of published events" ON public.event_media
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_media.event_id
            AND (e.publicado = true OR public.has_role(auth.uid(), 'admin'::app_role)))
  );

CREATE POLICY "Admins manage event media" ON public.event_media
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
