UPDATE public.assessments a
SET modulo_id = NULL
WHERE a.modulo_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.program_modules pm WHERE pm.id = a.modulo_id);

ALTER TABLE public.assessments
  ADD CONSTRAINT assessments_modulo_id_fkey
  FOREIGN KEY (modulo_id) REFERENCES public.program_modules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assessments_modulo_id ON public.assessments(modulo_id);