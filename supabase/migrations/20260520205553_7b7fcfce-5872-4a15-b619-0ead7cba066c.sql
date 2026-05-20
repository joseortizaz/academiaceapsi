
CREATE TABLE public.hero_slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imagen_url TEXT NOT NULL,
  enlace_url TEXT,
  alt TEXT,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hero_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver hero slides activos"
  ON public.hero_slides FOR SELECT
  TO anon, authenticated
  USING (activo = true);

CREATE POLICY "Admins gestionan hero slides"
  ON public.hero_slides FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_hero_slides_updated_at
  BEFORE UPDATE ON public.hero_slides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('hero-slides', 'hero-slides', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Hero slides públicas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hero-slides');

CREATE POLICY "Admins suben hero slides"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'hero-slides' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins actualizan hero slides"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'hero-slides' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins eliminan hero slides"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'hero-slides' AND public.has_role(auth.uid(), 'admin'::public.app_role));
