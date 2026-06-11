
CREATE TABLE public.course_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo text NOT NULL,
  email text NOT NULL,
  codigo_pais text NOT NULL DEFAULT '+1',
  telefono text NOT NULL,
  tipo_documento text NOT NULL CHECK (tipo_documento IN ('cedula','pasaporte')),
  numero_documento text NOT NULL,
  nivel_estudios text NOT NULL,
  provincia text NOT NULL,
  tipo_formacion text NOT NULL CHECK (tipo_formacion IN ('curso','diplomado')),
  programa text NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente',
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.course_requests TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.course_requests TO authenticated;
GRANT ALL ON public.course_requests TO service_role;

ALTER TABLE public.course_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a course request"
  ON public.course_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins manage course requests"
  ON public.course_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update course requests"
  ON public.course_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete course requests"
  ON public.course_requests FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_course_requests_updated_at
  BEFORE UPDATE ON public.course_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
