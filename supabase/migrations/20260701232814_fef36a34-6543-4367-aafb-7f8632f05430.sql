
-- Table for admin-managed form options (courses/diplomas listed in public request form)
CREATE TABLE IF NOT EXISTS public.course_request_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('curso','diplomado')),
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.course_request_options TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.course_request_options TO authenticated;
GRANT ALL ON public.course_request_options TO service_role;

ALTER TABLE public.course_request_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active options"
  ON public.course_request_options FOR SELECT
  USING (activo = true OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admins manage options"
  ON public.course_request_options FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_course_request_options_updated
  BEFORE UPDATE ON public.course_request_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.course_request_options (tipo, nombre, orden) VALUES
  ('curso', 'Curso de Marketing Digital', 1),
  ('curso', 'Curso de Excel Avanzado para Negocios', 2),
  ('curso', 'Curso de Introducción a la Programación Web', 3),
  ('curso', 'Curso de Gestión de Proyectos con Scrum', 4),
  ('diplomado', 'Diplomado en Ciencia de Datos y Analítica', 1),
  ('diplomado', 'Diplomado en Gestión Empresarial', 2),
  ('diplomado', 'Diplomado en Ciberseguridad', 3),
  ('diplomado', 'Diplomado en Recursos Humanos', 4);
