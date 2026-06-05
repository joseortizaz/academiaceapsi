
-- 1) Attach sync trigger so when a docente edita su perfil, su ficha pública en teachers se actualiza
DROP TRIGGER IF EXISTS profiles_sync_to_teacher ON public.profiles;
CREATE TRIGGER profiles_sync_to_teacher
AFTER UPDATE OF nombre, apellido, bio, telefono, avatar_url ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_to_teacher();

-- 2) Recrear vista pública para que use COALESCE con datos del perfil cuando el docente esté vinculado
DROP VIEW IF EXISTS public.teachers_public;
CREATE VIEW public.teachers_public
WITH (security_invoker = off) AS
SELECT
  t.id,
  COALESCE(p.nombre, t.nombre)       AS nombre,
  COALESCE(p.apellido, t.apellido)   AS apellido,
  t.titulo,
  COALESCE(p.especialidad, t.especialidad) AS especialidad,
  COALESCE(p.bio, t.biografia)       AS biografia,
  COALESCE(p.avatar_url, t.avatar_url) AS avatar_url,
  COALESCE(p.linkedin_url, t.linkedin_url) AS linkedin_url,
  t.visible,
  t.orden
FROM public.teachers t
LEFT JOIN public.profiles p ON p.id = t.user_id
WHERE t.visible = true;

GRANT SELECT ON public.teachers_public TO anon, authenticated;

-- 3) Vincular automáticamente teachers existentes con cuentas auth (por email) cuando user_id sea nulo
UPDATE public.teachers t
SET user_id = u.id
FROM auth.users u
WHERE t.user_id IS NULL
  AND lower(u.email) = lower(t.email);

-- 4) Sembrar campos del perfil con datos del docente cuando el perfil esté vacío (solo primera vez)
UPDATE public.profiles p
SET
  nombre     = COALESCE(NULLIF(p.nombre, ''), t.nombre),
  apellido   = COALESCE(NULLIF(p.apellido, ''), t.apellido),
  bio        = COALESCE(NULLIF(p.bio, ''), t.biografia),
  avatar_url = COALESCE(p.avatar_url, t.avatar_url),
  especialidad = COALESCE(NULLIF(p.especialidad, ''), t.especialidad),
  linkedin_url = COALESCE(p.linkedin_url, t.linkedin_url)
FROM public.teachers t
WHERE t.user_id = p.id;
