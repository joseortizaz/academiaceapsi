-- =====================================================================
-- Comunidad: imágenes de docentes, ventana de visibilidad y notificación
-- programada de publicaciones.
-- =====================================================================

-- ---------- 1. Ventana de visibilidad ----------
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS visible_desde timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS visible_hasta timestamptz,
  ADD COLUMN IF NOT EXISTS notificado_at timestamptz;

-- Publicaciones existentes: visibles desde su creación y ya notificadas.
UPDATE public.community_posts
SET visible_desde = created_at,
    notificado_at = COALESCE(notificado_at, created_at);

ALTER TABLE public.community_posts
  DROP CONSTRAINT IF EXISTS community_posts_ventana_valida;
ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_ventana_valida
  CHECK (visible_hasta IS NULL OR visible_hasta > visible_desde);

CREATE INDEX IF NOT EXISTS community_posts_visibilidad_idx
  ON public.community_posts (programa_id, visible_desde, visible_hasta);
CREATE INDEX IF NOT EXISTS community_posts_pendientes_idx
  ON public.community_posts (visible_desde) WHERE notificado_at IS NULL;

-- updated_at solo cambia cuando el docente edita algo visible, no cuando el
-- sistema marca la publicación como notificada.
DROP TRIGGER IF EXISTS update_community_posts_updated_at ON public.community_posts;
CREATE TRIGGER update_community_posts_updated_at
BEFORE UPDATE ON public.community_posts
FOR EACH ROW
WHEN (
  OLD.titulo IS DISTINCT FROM NEW.titulo
  OR OLD.contenido IS DISTINCT FROM NEW.contenido
  OR OLD.imagen_url IS DISTINCT FROM NEW.imagen_url
  OR OLD.visible_desde IS DISTINCT FROM NEW.visible_desde
  OR OLD.visible_hasta IS DISTINCT FROM NEW.visible_hasta
)
EXECUTE FUNCTION public.update_updated_at_column();

-- El cliente no decide el estado de notificación.
CREATE OR REPLACE FUNCTION public.community_posts_guard_notificado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.notificado_at := NULL;
  ELSIF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    NEW.notificado_at := OLD.notificado_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_posts_guard_notificado ON public.community_posts;
CREATE TRIGGER community_posts_guard_notificado
BEFORE INSERT OR UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.community_posts_guard_notificado();

-- ---------- 2. Alumnos: solo ven publicaciones dentro de su ventana ----------
DROP POLICY IF EXISTS "Estudiantes inscritos ven publicaciones del curso" ON public.community_posts;
CREATE POLICY "Estudiantes inscritos ven publicaciones del curso"
ON public.community_posts FOR SELECT
TO authenticated
USING (
  visible_desde <= now()
  AND (visible_hasta IS NULL OR visible_hasta > now())
  AND EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.programa_id = community_posts.programa_id
      AND e.user_id = auth.uid()
      AND e.estado IN ('activo','completado')
  )
);

-- ---------- 3. Notificaciones: al publicarse, no al crearse ----------
-- Notifica todas las publicaciones que ya entraron en su ventana y aún no se
-- han anunciado. Marca cada una para no notificar dos veces.
CREATE OR REPLACE FUNCTION public.publicar_community_posts_pendientes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post record;
  v_total integer := 0;
BEGIN
  FOR v_post IN
    SELECT cp.*, p.titulo AS programa_titulo, p.slug AS programa_slug
    FROM public.community_posts cp
    JOIN public.programs p ON p.id = cp.programa_id
    WHERE cp.notificado_at IS NULL
      AND cp.visible_desde <= now()
      AND (cp.visible_hasta IS NULL OR cp.visible_hasta > now())
    FOR UPDATE OF cp SKIP LOCKED
  LOOP
    INSERT INTO public.notifications (user_id, tipo, titulo, mensaje, enlace, programa_id, post_id)
    SELECT
      e.user_id,
      'community_post',
      'Nueva publicación: ' || v_post.titulo,
      COALESCE(v_post.programa_titulo, 'Tu curso') || ' — '
        || left(regexp_replace(v_post.contenido, '<[^>]+>', '', 'g'), 140),
      '/mis-cursos/' || v_post.programa_slug,
      v_post.programa_id,
      v_post.id
    FROM public.enrollments e
    WHERE e.programa_id = v_post.programa_id
      AND e.estado = 'activo'
      AND e.user_id <> v_post.autor_id;

    UPDATE public.community_posts SET notificado_at = now() WHERE id = v_post.id;
    v_total := v_total + 1;
  END LOOP;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.publicar_community_posts_pendientes() FROM PUBLIC, anon, authenticated;

-- Al crear o editar: si ya está en ventana, notificar de inmediato.
CREATE OR REPLACE FUNCTION public.notify_enrolled_students_on_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.notificado_at IS NULL
     AND NEW.visible_desde <= now()
     AND (NEW.visible_hasta IS NULL OR NEW.visible_hasta > now()) THEN
    PERFORM public.publicar_community_posts_pendientes();
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS community_posts_notify_students ON public.community_posts;
CREATE TRIGGER community_posts_notify_students
AFTER INSERT OR UPDATE OF visible_desde, visible_hasta ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.notify_enrolled_students_on_post();

-- Publicaciones programadas: revisar cada 5 minutos.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'publicar-community-posts';
    PERFORM cron.schedule(
      'publicar-community-posts',
      '*/5 * * * *',
      'SELECT public.publicar_community_posts_pendientes()'
    );
  END IF;
END;
$$;

-- ---------- 4. Bucket de imágenes de la comunidad ----------
-- Ruta esperada: {auth.uid()}/{programa_id}/{archivo}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community-images', 'community-images', true, 5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.can_upload_community_image(_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parts text[] := storage.foldername(_object_name);
BEGIN
  IF auth.uid() IS NULL OR array_length(v_parts, 1) IS NULL OR array_length(v_parts, 1) < 2 THEN
    RETURN false;
  END IF;
  IF v_parts[1] <> auth.uid()::text THEN
    RETURN false;
  END IF;
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN true;
  END IF;
  IF v_parts[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  RETURN public.is_teacher_of_program(v_parts[2]::uuid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_upload_community_image(text) TO authenticated;

DROP POLICY IF EXISTS "Comunidad: lectura pública de imágenes" ON storage.objects;
CREATE POLICY "Comunidad: lectura pública de imágenes"
ON storage.objects FOR SELECT
USING (bucket_id = 'community-images');

DROP POLICY IF EXISTS "Comunidad: docentes suben imágenes de sus cursos" ON storage.objects;
CREATE POLICY "Comunidad: docentes suben imágenes de sus cursos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'community-images' AND public.can_upload_community_image(name));

DROP POLICY IF EXISTS "Comunidad: autores actualizan sus imágenes" ON storage.objects;
CREATE POLICY "Comunidad: autores actualizan sus imágenes"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'community-images' AND public.can_upload_community_image(name))
WITH CHECK (bucket_id = 'community-images' AND public.can_upload_community_image(name));

DROP POLICY IF EXISTS "Comunidad: autores eliminan sus imágenes" ON storage.objects;
CREATE POLICY "Comunidad: autores eliminan sus imágenes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'community-images'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);
