
CREATE TABLE public.assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  programa_id UUID NOT NULL,
  modulo_id UUID,
  created_by UUID NOT NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  instrucciones TEXT,
  tipo TEXT NOT NULL DEFAULT 'tarea' CHECK (tipo IN ('examen','quiz','tarea')),
  puntaje_maximo INTEGER NOT NULL DEFAULT 100,
  peso_porcentaje INTEGER NOT NULL DEFAULT 0,
  duracion_minutos INTEGER,
  fecha_limite TIMESTAMP WITH TIME ZONE,
  publicado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.assessment_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  enunciado TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'opcion_multiple' CHECK (tipo IN ('opcion_multiple','verdadero_falso','respuesta_corta','desarrollo')),
  opciones JSONB,
  respuesta_correcta TEXT,
  puntaje INTEGER NOT NULL DEFAULT 1,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_assessments_programa ON public.assessments(programa_id);
CREATE INDEX idx_assessments_modulo ON public.assessments(modulo_id);
CREATE INDEX idx_assessment_questions_assessment ON public.assessment_questions(assessment_id);

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;

-- assessments policies
CREATE POLICY "Admins gestionan evaluaciones"
  ON public.assessments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Docentes gestionan sus evaluaciones"
  ON public.assessments FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'docente'::app_role) AND (
      created_by = auth.uid() OR
      EXISTS (SELECT 1 FROM public.programs p WHERE p.id = assessments.programa_id AND p.docente_id = auth.uid())
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'docente'::app_role) AND created_by = auth.uid()
  );

CREATE POLICY "Estudiantes ven evaluaciones publicadas"
  ON public.assessments FOR SELECT TO authenticated
  USING (
    publicado = true AND EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.user_id = auth.uid()
        AND e.programa_id = assessments.programa_id
        AND e.estado IN ('activo','completado')
    )
  );

-- assessment_questions policies
CREATE POLICY "Admins gestionan preguntas"
  ON public.assessment_questions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Docentes gestionan preguntas de sus evaluaciones"
  ON public.assessment_questions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_questions.assessment_id
        AND (a.created_by = auth.uid() OR EXISTS (
          SELECT 1 FROM public.programs p WHERE p.id = a.programa_id AND p.docente_id = auth.uid()
        ))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_questions.assessment_id
        AND (a.created_by = auth.uid() OR EXISTS (
          SELECT 1 FROM public.programs p WHERE p.id = a.programa_id AND p.docente_id = auth.uid()
        ))
    )
  );

CREATE POLICY "Estudiantes ven preguntas de evaluaciones publicadas"
  ON public.assessment_questions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      JOIN public.enrollments e ON e.programa_id = a.programa_id
      WHERE a.id = assessment_questions.assessment_id
        AND a.publicado = true
        AND e.user_id = auth.uid()
        AND e.estado IN ('activo','completado')
    )
  );

CREATE TRIGGER update_assessments_updated_at
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
