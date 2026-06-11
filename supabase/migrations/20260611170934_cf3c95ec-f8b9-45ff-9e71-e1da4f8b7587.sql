
-- 1. Add verification_code column
ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS verification_code text UNIQUE;

-- 2. Generator function (10-char alphanumeric, no ambiguous chars)
CREATE OR REPLACE FUNCTION public.gen_verification_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..10 LOOP
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- 3. Trigger to fill verification_code (and keep numero_certificado logic)
CREATE OR REPLACE FUNCTION public.generate_certificate_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.numero_certificado IS NULL THEN
    NEW.numero_certificado := 'CEAPSI-' || to_char(NEW.fecha_emision, 'YYYY') || '-' || substr(NEW.id::text, 1, 8);
  END IF;
  IF NEW.verification_code IS NULL THEN
    LOOP
      NEW.verification_code := public.gen_verification_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.certificates WHERE verification_code = NEW.verification_code);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Backfill existing rows
DO $$
DECLARE r record; new_code text;
BEGIN
  FOR r IN SELECT id FROM public.certificates WHERE verification_code IS NULL LOOP
    LOOP
      new_code := public.gen_verification_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.certificates WHERE verification_code = new_code);
    END LOOP;
    UPDATE public.certificates SET verification_code = new_code WHERE id = r.id;
  END LOOP;
END $$;

-- 5. Public verification function (security definer, exposes only safe fields)
CREATE OR REPLACE FUNCTION public.verify_certificate(_code text)
RETURNS TABLE (
  numero_certificado text,
  verification_code text,
  fecha_emision timestamptz,
  estado text,
  student_name text,
  programa_titulo text,
  programa_duracion_horas int,
  programa_tipo text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.numero_certificado,
    c.verification_code,
    c.fecha_emision,
    c.estado,
    trim(coalesce(p.nombre,'') || ' ' || coalesce(p.apellido,'')) AS student_name,
    pr.titulo AS programa_titulo,
    pr.duracion_horas AS programa_duracion_horas,
    pr.tipo AS programa_tipo
  FROM public.certificates c
  LEFT JOIN public.profiles p ON p.id = c.user_id
  LEFT JOIN public.programs  pr ON pr.id = c.programa_id
  WHERE c.verification_code = _code OR c.numero_certificado = _code
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gen_verification_code() TO authenticated, service_role;
