DROP VIEW IF EXISTS public.teachers_public;

CREATE VIEW public.teachers_public AS
SELECT id, nombre, apellido, titulo, especialidad, biografia, avatar_url, linkedin_url, visible, orden
FROM public.teachers
WHERE visible = true;

GRANT SELECT ON public.teachers_public TO anon, authenticated;