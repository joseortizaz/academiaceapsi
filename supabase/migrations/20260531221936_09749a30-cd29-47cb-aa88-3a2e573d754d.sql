
DROP VIEW IF EXISTS public.program_modules_catalog;

CREATE VIEW public.program_modules_catalog
WITH (security_invoker = on)
AS
SELECT
  m.id,
  m.programa_id,
  m.modulo_id,
  m.titulo,
  m.descripcion,
  m.orden,
  m.duracion_minutos,
  m.es_en_vivo,
  m.fecha_sesion,
  m.docente_id,
  m.created_at,
  m.updated_at
FROM public.program_modules m
WHERE EXISTS (
  SELECT 1 FROM public.programs p
  WHERE p.id = m.programa_id
    AND p.estado = ANY (ARRAY['publicado'::text, 'en_curso'::text, 'finalizado'::text])
);

GRANT SELECT ON public.program_modules_catalog TO anon, authenticated;
