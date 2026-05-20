-- Revocar permisos de ejecución en funciones SECURITY DEFINER
-- para evitar que usuarios autenticados o anónimos las invoquen directamente.

-- has_role: solo se usa internamente en políticas RLS
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM anon;

-- update_updated_at_column: solo se usa en triggers
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;

-- generate_certificate_number: solo se usa en trigger
REVOKE EXECUTE ON FUNCTION public.generate_certificate_number() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_certificate_number() FROM anon;

-- handle_new_user: solo se usa en trigger de auth.users
-- auth.users trigger se ejecuta con privilegios del owner, no requiere acceso público
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;