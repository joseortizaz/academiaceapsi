
CREATE TABLE public.lesson_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  modulo_id uuid NOT NULL REFERENCES public.program_modules(id) ON DELETE CASCADE,
  programa_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  url text NOT NULL,
  tipo text NOT NULL DEFAULT 'otro',
  tamano_bytes bigint,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_materials_modulo ON public.lesson_materials(modulo_id);
CREATE INDEX idx_lesson_materials_programa ON public.lesson_materials(programa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_materials TO authenticated;
GRANT ALL ON public.lesson_materials TO service_role;

ALTER TABLE public.lesson_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestionan lesson_materials"
ON public.lesson_materials FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Docentes gestionan lesson_materials de sus programas"
ON public.lesson_materials FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'docente'::app_role) AND EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = lesson_materials.programa_id AND p.docente_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'docente'::app_role) AND EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = lesson_materials.programa_id AND p.docente_id = auth.uid()
  )
);

CREATE POLICY "Estudiantes inscritos ven lesson_materials"
ON public.lesson_materials FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.programa_id = lesson_materials.programa_id
      AND e.user_id = auth.uid()
      AND e.estado = ANY (ARRAY['activo'::text, 'completado'::text])
  )
);

-- Migrar materiales existentes
INSERT INTO public.lesson_materials (modulo_id, programa_id, nombre, url, tipo, orden)
SELECT
  pm.id,
  pm.programa_id,
  COALESCE(NULLIF(regexp_replace(pm.material_url, '^.*/', ''), ''), 'Material'),
  pm.material_url,
  CASE
    WHEN pm.material_url ILIKE '%.pdf' THEN 'pdf'
    WHEN pm.material_url ILIKE '%.doc' OR pm.material_url ILIKE '%.docx' THEN 'word'
    WHEN pm.material_url ILIKE '%.xls' OR pm.material_url ILIKE '%.xlsx' OR pm.material_url ILIKE '%.csv' THEN 'excel'
    WHEN pm.material_url ILIKE '%.ppt' OR pm.material_url ILIKE '%.pptx' THEN 'ppt'
    ELSE 'otro'
  END,
  0
FROM public.program_modules pm
WHERE pm.material_url IS NOT NULL AND pm.material_url <> '';
