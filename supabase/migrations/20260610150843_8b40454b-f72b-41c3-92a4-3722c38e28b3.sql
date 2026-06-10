
-- Helper: ¿el usuario autenticado es el docente del programa?
CREATE OR REPLACE FUNCTION public.is_teacher_of_program(_programa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.programs p
    JOIN public.teachers t ON t.id = p.docente_id
    WHERE p.id = _programa_id
      AND t.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_teacher_of_program(uuid) TO authenticated;

-- program_modules: corregir políticas docente y SELECT
DROP POLICY IF EXISTS "Docentes gestionan módulos de sus programas" ON public.program_modules;
DROP POLICY IF EXISTS "Ver módulos si inscrito o docente o admin" ON public.program_modules;

CREATE POLICY "Docentes gestionan lecciones de sus programas"
ON public.program_modules
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'docente'::app_role) AND public.is_teacher_of_program(programa_id))
WITH CHECK (public.has_role(auth.uid(), 'docente'::app_role) AND public.is_teacher_of_program(programa_id));

CREATE POLICY "Ver lecciones si inscrito o docente o admin"
ON public.program_modules
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_teacher_of_program(programa_id)
  OR EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.programa_id = program_modules.programa_id
      AND e.user_id = auth.uid()
      AND e.estado = ANY (ARRAY['activo'::text, 'completado'::text])
  )
);

-- course_modules: corregir política docente
DROP POLICY IF EXISTS "Docentes gestionan course_modules de sus programas" ON public.course_modules;

CREATE POLICY "Docentes gestionan course_modules de sus programas"
ON public.course_modules
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'docente'::app_role) AND public.is_teacher_of_program(programa_id))
WITH CHECK (public.has_role(auth.uid(), 'docente'::app_role) AND public.is_teacher_of_program(programa_id));

-- lesson_materials: corregir política docente
DROP POLICY IF EXISTS "Docentes gestionan lesson_materials de sus programas" ON public.lesson_materials;

CREATE POLICY "Docentes gestionan lesson_materials de sus programas"
ON public.lesson_materials
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'docente'::app_role) AND public.is_teacher_of_program(programa_id))
WITH CHECK (public.has_role(auth.uid(), 'docente'::app_role) AND public.is_teacher_of_program(programa_id));

-- Storage: permitir al docente leer/borrar/actualizar archivos en course-materials
-- que estén bajo su propio uid (lo que sube él mismo desde la app).
-- Las políticas existentes ya cubren staff (admin/docente) cuando foldername[1] = uid del que sube.
-- No se requieren cambios adicionales aquí.
