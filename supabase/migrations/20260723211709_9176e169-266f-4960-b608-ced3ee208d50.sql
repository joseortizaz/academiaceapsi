
-- Ensure a teachers row exists whenever a user has the 'docente' role.
CREATE OR REPLACE FUNCTION public.ensure_teacher_for_docente_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_nombre text;
  v_apellido text;
  v_telefono text;
  v_avatar text;
  v_bio text;
BEGIN
  IF NEW.role <> 'docente'::app_role THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.teachers WHERE user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  SELECT p.nombre, p.apellido, p.telefono, p.avatar_url, p.bio
    INTO v_nombre, v_apellido, v_telefono, v_avatar, v_bio
  FROM public.profiles p WHERE p.id = NEW.user_id;

  SELECT au.email INTO v_email FROM auth.users au WHERE au.id = NEW.user_id;

  INSERT INTO public.teachers (user_id, nombre, apellido, email, telefono, avatar_url, biografia, visible, orden)
  VALUES (
    NEW.user_id,
    COALESCE(NULLIF(v_nombre,''), split_part(COALESCE(v_email,''), '@', 1), 'Docente'),
    COALESCE(v_apellido, ''),
    COALESCE(v_email, ''),
    v_telefono,
    v_avatar,
    v_bio,
    true,
    0
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_teacher_for_docente_role ON public.user_roles;
CREATE TRIGGER trg_ensure_teacher_for_docente_role
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.ensure_teacher_for_docente_role();

-- Backfill: create teachers rows for existing docentes missing from teachers.
INSERT INTO public.teachers (user_id, nombre, apellido, email, telefono, avatar_url, biografia, visible, orden)
SELECT
  ur.user_id,
  COALESCE(NULLIF(p.nombre,''), split_part(COALESCE(au.email,''), '@', 1), 'Docente'),
  COALESCE(p.apellido, ''),
  COALESCE(au.email, ''),
  p.telefono,
  p.avatar_url,
  p.bio,
  true,
  0
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.id = ur.user_id
LEFT JOIN auth.users au ON au.id = ur.user_id
WHERE ur.role = 'docente'::app_role
  AND NOT EXISTS (SELECT 1 FROM public.teachers t WHERE t.user_id = ur.user_id);
