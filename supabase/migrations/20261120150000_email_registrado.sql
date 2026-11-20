-- Registro: rechazar correos que ya tienen cuenta.
-- Supabase Auth, con confirmación de correo activa, no devuelve error al
-- registrar un correo existente (responde "éxito" para no revelar cuentas).
-- Esta función permite que el servidor lo compruebe antes de llamar a signUp.
-- Solo la usa el service role desde src/lib/auth.functions.ts.
CREATE OR REPLACE FUNCTION public.email_registrado(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = lower(trim(p_email))
  );
$$;

REVOKE ALL ON FUNCTION public.email_registrado(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.email_registrado(text) FROM anon;
REVOKE ALL ON FUNCTION public.email_registrado(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.email_registrado(text) TO service_role;
