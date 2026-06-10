
-- ============ community_posts ============
CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  contenido text NOT NULL,
  imagen_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX community_posts_programa_idx ON public.community_posts(programa_id, created_at DESC);
CREATE INDEX community_posts_autor_idx ON public.community_posts(autor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

-- Docente del programa: CRUD propio
CREATE POLICY "Docentes gestionan publicaciones de sus cursos"
ON public.community_posts
FOR ALL
TO authenticated
USING (public.is_teacher_of_program(programa_id) AND autor_id = auth.uid())
WITH CHECK (public.is_teacher_of_program(programa_id) AND autor_id = auth.uid());

-- Admin total
CREATE POLICY "Admins gestionan todas las publicaciones"
ON public.community_posts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Estudiantes inscritos pueden ver
CREATE POLICY "Estudiantes inscritos ven publicaciones del curso"
ON public.community_posts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.programa_id = community_posts.programa_id
      AND e.user_id = auth.uid()
      AND e.estado IN ('activo','completado','pendiente')
  )
);

CREATE TRIGGER update_community_posts_updated_at
BEFORE UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ notifications ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'community_post',
  titulo text NOT NULL,
  mensaje text,
  enlace text,
  programa_id uuid REFERENCES public.programs(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE,
  leida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_idx ON public.notifications(user_id, leida, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus notificaciones"
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Usuarios actualizan sus notificaciones"
ON public.notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuarios eliminan sus notificaciones"
ON public.notifications
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============ Fan-out trigger ============
CREATE OR REPLACE FUNCTION public.notify_enrolled_students_on_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_programa_titulo text;
  v_slug text;
BEGIN
  SELECT titulo, slug INTO v_programa_titulo, v_slug
  FROM public.programs WHERE id = NEW.programa_id;

  INSERT INTO public.notifications (user_id, tipo, titulo, mensaje, enlace, programa_id, post_id)
  SELECT
    e.user_id,
    'community_post',
    'Nueva publicación: ' || NEW.titulo,
    COALESCE(v_programa_titulo, 'Tu curso') || ' — ' || left(regexp_replace(NEW.contenido, '<[^>]+>', '', 'g'), 140),
    '/mis-cursos/' || v_slug,
    NEW.programa_id,
    NEW.id
  FROM public.enrollments e
  WHERE e.programa_id = NEW.programa_id
    AND e.estado IN ('activo','pendiente')
    AND e.user_id <> NEW.autor_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER community_posts_notify_students
AFTER INSERT ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.notify_enrolled_students_on_post();

-- ============ Realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
