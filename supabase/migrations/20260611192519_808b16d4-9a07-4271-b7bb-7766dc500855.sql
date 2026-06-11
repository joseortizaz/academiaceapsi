
DROP POLICY IF EXISTS "Ver anuncios activos" ON public.announcements;

CREATE POLICY "Ver anuncios generales activos"
ON public.announcements FOR SELECT
USING (
  activo = true
  AND (fecha_expiracion IS NULL OR fecha_expiracion > now())
  AND programa_id IS NULL
);

CREATE POLICY "Ver anuncios de programa (inscritos/docente/admin)"
ON public.announcements FOR SELECT
TO authenticated
USING (
  activo = true
  AND (fecha_expiracion IS NULL OR fecha_expiracion > now())
  AND programa_id IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR public.is_teacher_of_program(programa_id)
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.programa_id = announcements.programa_id
        AND e.user_id = auth.uid()
        AND e.estado IN ('activo','completado')
    )
  )
);

DROP POLICY IF EXISTS "Estudiantes inscritos ven publicaciones del curso" ON public.community_posts;

CREATE POLICY "Estudiantes inscritos ven publicaciones del curso"
ON public.community_posts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.programa_id = community_posts.programa_id
      AND e.user_id = auth.uid()
      AND e.estado IN ('activo','completado')
  )
);
