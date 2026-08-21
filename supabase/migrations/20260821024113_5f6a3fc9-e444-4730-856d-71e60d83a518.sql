-- 1) Announcements: restrict general announcements to authenticated users
DROP POLICY IF EXISTS "Ver anuncios generales activos" ON public.announcements;
CREATE POLICY "Ver anuncios generales activos"
ON public.announcements
FOR SELECT
TO authenticated
USING (
  activo = true
  AND (fecha_expiracion IS NULL OR fecha_expiracion > now())
  AND programa_id IS NULL
);

-- 2) Storage course-materials: exact path match instead of LIKE on full URL
DROP POLICY IF EXISTS "course-materials enrolled students read" ON storage.objects;
CREATE POLICY "course-materials enrolled students read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'course-materials'
  AND EXISTS (
    SELECT 1
    FROM public.lesson_materials lm
    JOIN public.enrollments e
      ON e.programa_id = lm.programa_id
     AND e.user_id = auth.uid()
     AND e.estado = ANY (ARRAY['activo'::text, 'completado'::text])
    WHERE split_part(split_part(lm.url, '?', 1), '/course-materials/', 2) = objects.name
  )
);

-- 3) event_media: simplify public policy to published events only
DROP POLICY IF EXISTS "Public can view media of published events" ON public.event_media;
CREATE POLICY "Public can view media of published events"
ON public.event_media
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_media.event_id AND e.publicado = true
  )
);