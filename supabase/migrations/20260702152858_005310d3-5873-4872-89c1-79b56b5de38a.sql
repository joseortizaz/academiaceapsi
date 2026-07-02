ALTER TABLE public.course_requests
  ADD COLUMN IF NOT EXISTS modalidad text
  CHECK (modalidad IN ('presencial','online_vivo','online_asincronico'));