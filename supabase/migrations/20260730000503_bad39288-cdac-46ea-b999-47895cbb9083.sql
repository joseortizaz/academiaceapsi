GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_progress TO authenticated;
GRANT ALL ON public.module_progress TO service_role;

DROP POLICY IF EXISTS "Docentes ven progreso de sus programas" ON public.module_progress;
CREATE POLICY "Docentes ven progreso de sus programas"
ON public.module_progress FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.program_modules pm
    WHERE pm.id = module_progress.modulo_id
      AND public.is_teacher_of_program(pm.programa_id)
  )
);

-- Recalcular progreso de inscripciones existentes
DO $$
DECLARE r record; v_total int; v_done int; v_pct int;
BEGIN
  FOR r IN SELECT id, programa_id FROM public.enrollments LOOP
    SELECT count(*) INTO v_total FROM public.program_modules WHERE programa_id = r.programa_id;
    SELECT count(*) INTO v_done FROM public.module_progress mp
      JOIN public.program_modules pm ON pm.id = mp.modulo_id
     WHERE mp.enrollment_id = r.id AND mp.completado AND pm.programa_id = r.programa_id;
    v_pct := CASE WHEN v_total > 0 THEN round((v_done::numeric / v_total) * 100)::int ELSE 0 END;
    PERFORM set_config('app.bypass_enrollment_guard', '1', true);
    UPDATE public.enrollments SET progreso_porcentaje = v_pct WHERE id = r.id AND progreso_porcentaje IS DISTINCT FROM v_pct;
    PERFORM set_config('app.bypass_enrollment_guard', '0', true);
  END LOOP;
END $$;