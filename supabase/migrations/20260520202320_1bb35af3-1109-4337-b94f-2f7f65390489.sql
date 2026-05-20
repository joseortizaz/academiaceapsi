-- Revocar permisos de PUBLIC por defecto en todas las funciones SECURITY DEFINER
-- Luego otorgar solo al rol postgres (service role)

-- has_role
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO postgres;

-- update_updated_at_column
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO postgres;

-- generate_certificate_number
REVOKE ALL ON FUNCTION public.generate_certificate_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_certificate_number() TO postgres;

-- handle_new_user
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;