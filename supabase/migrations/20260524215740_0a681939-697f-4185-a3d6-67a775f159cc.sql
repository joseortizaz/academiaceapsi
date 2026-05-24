ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS objetivos text,
  ADD COLUMN IF NOT EXISTS publico_meta text,
  ADD COLUMN IF NOT EXISTS resultados_esperados text;