
-- 1. Tabla course_modules (módulos agrupadores)
CREATE TABLE public.course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descripcion text,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_modules_programa ON public.course_modules(programa_id, orden);

GRANT SELECT ON public.course_modules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_modules TO authenticated;
GRANT ALL ON public.course_modules TO service_role;

ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestionan course_modules"
ON public.course_modules FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Docentes gestionan course_modules de sus programas"
ON public.course_modules FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'docente'::app_role)
  AND EXISTS (SELECT 1 FROM public.programs p WHERE p.id = course_modules.programa_id AND p.docente_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'docente'::app_role)
  AND EXISTS (SELECT 1 FROM public.programs p WHERE p.id = course_modules.programa_id AND p.docente_id = auth.uid())
);

CREATE POLICY "Estudiantes inscritos ven course_modules"
ON public.course_modules FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.programa_id = course_modules.programa_id
      AND e.user_id = auth.uid()
      AND e.estado = ANY (ARRAY['activo'::text, 'completado'::text])
  )
);

CREATE POLICY "Ver course_modules de programas publicados"
ON public.course_modules FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = course_modules.programa_id
      AND p.estado = ANY (ARRAY['publicado'::text, 'en_curso'::text, 'finalizado'::text])
  )
);

CREATE TRIGGER course_modules_updated_at
BEFORE UPDATE ON public.course_modules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Añadir modulo_id a program_modules (lecciones)
ALTER TABLE public.program_modules
ADD COLUMN modulo_id uuid REFERENCES public.course_modules(id) ON DELETE SET NULL;

CREATE INDEX idx_program_modules_modulo ON public.program_modules(modulo_id, orden);

-- 3. Trigger de validación: diplomados requieren modulo_id; cursos no.
CREATE OR REPLACE FUNCTION public.validate_lesson_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  p_tipo text;
BEGIN
  SELECT tipo INTO p_tipo FROM public.programs WHERE id = NEW.programa_id;
  IF p_tipo = 'diplomado' AND NEW.modulo_id IS NULL THEN
    RAISE EXCEPTION 'Las lecciones de un diplomado deben pertenecer a un módulo';
  END IF;
  IF p_tipo = 'curso' AND NEW.modulo_id IS NOT NULL THEN
    RAISE EXCEPTION 'Las lecciones de un curso no pueden pertenecer a un módulo agrupador';
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Migración de datos: por cada diplomado con lecciones, crear "Módulo 1"
DO $$
DECLARE
  prog record;
  new_mod_id uuid;
BEGIN
  FOR prog IN
    SELECT DISTINCT p.id
    FROM public.programs p
    JOIN public.program_modules pm ON pm.programa_id = p.id
    WHERE p.tipo = 'diplomado' AND pm.modulo_id IS NULL
  LOOP
    INSERT INTO public.course_modules (programa_id, titulo, orden)
    VALUES (prog.id, 'Módulo 1', 0)
    RETURNING id INTO new_mod_id;

    UPDATE public.program_modules
    SET modulo_id = new_mod_id
    WHERE programa_id = prog.id AND modulo_id IS NULL;
  END LOOP;
END $$;

-- 5. Aplicar trigger después de migrar datos existentes
CREATE TRIGGER validate_program_modules_hierarchy
BEFORE INSERT OR UPDATE ON public.program_modules
FOR EACH ROW EXECUTE FUNCTION public.validate_lesson_hierarchy();
