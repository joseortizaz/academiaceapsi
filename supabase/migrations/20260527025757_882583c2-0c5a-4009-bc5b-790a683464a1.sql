
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS nombre_completo text,
  ADD COLUMN IF NOT EXISTS documento_identidad text,
  ADD COLUMN IF NOT EXISTS email_contacto text,
  ADD COLUMN IF NOT EXISTS telefono_contacto text,
  ADD COLUMN IF NOT EXISTS area_profesional text;
