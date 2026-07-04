
-- 1) Enrollments: tighten WITH CHECK to keep sensitive columns immutable for students (defense-in-depth alongside existing trigger)
DROP POLICY IF EXISTS "Estudiantes actualizan contacto propio" ON public.enrollments;
CREATE POLICY "Estudiantes actualizan contacto propio"
ON public.enrollments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND NOT has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (
  auth.uid() = user_id
  AND NOT has_role(auth.uid(), 'admin'::app_role)
  AND estado                IS NOT DISTINCT FROM (SELECT e.estado                FROM public.enrollments e WHERE e.id = enrollments.id)
  AND progreso_porcentaje   IS NOT DISTINCT FROM (SELECT e.progreso_porcentaje   FROM public.enrollments e WHERE e.id = enrollments.id)
  AND fecha_completado      IS NOT DISTINCT FROM (SELECT e.fecha_completado      FROM public.enrollments e WHERE e.id = enrollments.id)
  AND fecha_vencimiento     IS NOT DISTINCT FROM (SELECT e.fecha_vencimiento     FROM public.enrollments e WHERE e.id = enrollments.id)
  AND fecha_inscripcion     IS NOT DISTINCT FROM (SELECT e.fecha_inscripcion     FROM public.enrollments e WHERE e.id = enrollments.id)
  AND pago_id               IS NOT DISTINCT FROM (SELECT e.pago_id               FROM public.enrollments e WHERE e.id = enrollments.id)
  AND user_id               IS NOT DISTINCT FROM (SELECT e.user_id               FROM public.enrollments e WHERE e.id = enrollments.id)
  AND programa_id           IS NOT DISTINCT FROM (SELECT e.programa_id           FROM public.enrollments e WHERE e.id = enrollments.id)
);

-- 2) Assessments: enforce program ownership in WITH CHECK
DROP POLICY IF EXISTS "Docentes gestionan sus evaluaciones" ON public.assessments;
CREATE POLICY "Docentes gestionan sus evaluaciones"
ON public.assessments
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'docente'::app_role)
  AND (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.programs p WHERE p.id = assessments.programa_id AND p.docente_id = auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'docente'::app_role)
  AND created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.programs p WHERE p.id = assessments.programa_id AND p.docente_id = auth.uid())
);

-- 3) Zoom meetings: enforce program ownership in WITH CHECK
DROP POLICY IF EXISTS "Docentes gestionan reuniones de sus programas" ON public.zoom_meetings;
CREATE POLICY "Docentes gestionan reuniones de sus programas"
ON public.zoom_meetings
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'docente'::app_role)
  AND (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.programs p WHERE p.id = zoom_meetings.programa_id AND p.docente_id = auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'docente'::app_role)
  AND created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.programs p WHERE p.id = zoom_meetings.programa_id AND p.docente_id = auth.uid())
);

-- 4) Storage: replace fragile LIKE substring match with exact path suffix match
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
     AND e.estado = ANY (ARRAY['activo','completado'])
    WHERE
      lm.url LIKE '%/course-materials/' || objects.name
      OR lm.url LIKE '%/course-materials/' || objects.name || '?%'
  )
);
