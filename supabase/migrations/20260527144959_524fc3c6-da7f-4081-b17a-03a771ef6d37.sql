
-- 1. PROFILES: drop broad "see other profiles" policy; expose only safe columns via view
DROP POLICY IF EXISTS "Ver otros perfiles" ON public.profiles;

CREATE OR REPLACE VIEW public.profiles_public AS
SELECT id, nombre, apellido, avatar_url, bio, especialidad, ciudad, pais, linkedin_url, is_active
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- 2. TEACHERS: drop anon access to full row (exposes email/telefono); expose public view
DROP POLICY IF EXISTS "Anon ve docentes públicos" ON public.teachers;
DROP POLICY IF EXISTS "Auth ve docentes" ON public.teachers;

-- authenticated can still read full row (needed for docente self-lookup, admin lookups)
CREATE POLICY "Auth ve docentes (sin contacto sensible para no-admin)"
ON public.teachers FOR SELECT TO authenticated
USING (visible = true);

CREATE OR REPLACE VIEW public.teachers_public AS
SELECT id, nombre, apellido, titulo, especialidad, biografia, avatar_url, linkedin_url, orden, visible
FROM public.teachers
WHERE visible = true;

GRANT SELECT ON public.teachers_public TO anon, authenticated;

-- 3. PROGRAM_MODULES: stop exposing video_url/material_url/audio_url to anon and non-enrolled users
DROP POLICY IF EXISTS "Ver módulos de programas publicados" ON public.program_modules;

-- Authenticated: admins, docentes (program owner), and enrolled students see full row
CREATE POLICY "Ver módulos si inscrito o docente o admin"
ON public.program_modules FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = program_modules.programa_id AND p.docente_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.programa_id = program_modules.programa_id
      AND e.user_id = auth.uid()
      AND e.estado = ANY (ARRAY['activo','completado'])
  )
);

-- Public catalog view (no video/material/audio URLs)
CREATE OR REPLACE VIEW public.program_modules_catalog AS
SELECT m.id, m.programa_id, m.titulo, m.descripcion, m.orden, m.duracion_minutos,
       m.es_en_vivo, m.fecha_sesion, m.docente_id, m.created_at, m.updated_at
FROM public.program_modules m
WHERE EXISTS (
  SELECT 1 FROM public.programs p
  WHERE p.id = m.programa_id
    AND p.estado = ANY (ARRAY['publicado','en_curso','finalizado'])
);

GRANT SELECT ON public.program_modules_catalog TO anon, authenticated;

-- 4. ASSESSMENT_QUESTIONS: stop exposing respuesta_correcta to students; expose safe view
DROP POLICY IF EXISTS "Estudiantes ven preguntas de evaluaciones publicadas" ON public.assessment_questions;

CREATE OR REPLACE VIEW public.assessment_questions_student AS
SELECT q.id, q.assessment_id, q.tipo, q.enunciado, q.opciones, q.orden, q.puntaje, q.created_at
FROM public.assessment_questions q
WHERE EXISTS (
  SELECT 1 FROM public.assessments a
  JOIN public.enrollments e ON e.programa_id = a.programa_id
  WHERE a.id = q.assessment_id
    AND a.publicado = true
    AND e.user_id = auth.uid()
    AND e.estado = ANY (ARRAY['activo','completado'])
);

GRANT SELECT ON public.assessment_questions_student TO authenticated;

-- 5. STORAGE: make course-materials bucket private and require auth to read
UPDATE storage.buckets SET public = false WHERE id = 'course-materials';

DROP POLICY IF EXISTS "course-materials public read" ON storage.objects;

CREATE POLICY "course-materials authenticated read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'course-materials');

-- 6. SECURITY DEFINER trigger functions: not meant to be called by clients
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_certificate_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
