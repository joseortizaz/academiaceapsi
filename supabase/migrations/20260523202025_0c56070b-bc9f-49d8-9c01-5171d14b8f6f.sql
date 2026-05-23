CREATE TABLE public.lesson_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  modulo_id UUID NOT NULL,
  programa_id UUID NOT NULL,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.lesson_comments(id) ON DELETE CASCADE,
  contenido TEXT NOT NULL,
  es_respuesta_docente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_comments_modulo ON public.lesson_comments(modulo_id, created_at);
CREATE INDEX idx_lesson_comments_parent ON public.lesson_comments(parent_id);
CREATE INDEX idx_lesson_comments_programa ON public.lesson_comments(programa_id);

ALTER TABLE public.lesson_comments ENABLE ROW LEVEL SECURITY;

-- View: enrolled students, the program teacher, or admins
CREATE POLICY "Ver comentarios de lecciones"
ON public.lesson_comments FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = lesson_comments.programa_id AND p.docente_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.programa_id = lesson_comments.programa_id
      AND e.user_id = auth.uid()
      AND e.estado IN ('activo','completado')
  )
);

-- Insert: same audience, must be own user_id
CREATE POLICY "Crear comentarios de lecciones"
ON public.lesson_comments FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.programs p
      WHERE p.id = lesson_comments.programa_id AND p.docente_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.programa_id = lesson_comments.programa_id
        AND e.user_id = auth.uid()
        AND e.estado IN ('activo','completado')
    )
  )
);

CREATE POLICY "Editar comentarios propios"
ON public.lesson_comments FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Eliminar comentarios propios"
ON public.lesson_comments FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_lesson_comments_updated_at
BEFORE UPDATE ON public.lesson_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.lesson_comments;