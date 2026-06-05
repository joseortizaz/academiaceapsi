
-- 1) Allow docentes to update their own teachers row
CREATE POLICY "Docentes actualizan su perfil docente"
ON public.teachers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2) Sync profiles -> teachers when a docente updates their profile
CREATE OR REPLACE FUNCTION public.sync_profile_to_teacher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.teachers
  SET
    nombre = COALESCE(NEW.nombre, nombre),
    apellido = COALESCE(NEW.apellido, apellido),
    biografia = COALESCE(NEW.bio, biografia),
    telefono = COALESCE(NEW.telefono, telefono),
    avatar_url = NEW.avatar_url,
    updated_at = now()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_to_teacher ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_teacher
AFTER UPDATE ON public.profiles
FOR EACH ROW
WHEN (
  OLD.nombre IS DISTINCT FROM NEW.nombre
  OR OLD.apellido IS DISTINCT FROM NEW.apellido
  OR OLD.bio IS DISTINCT FROM NEW.bio
  OR OLD.telefono IS DISTINCT FROM NEW.telefono
  OR OLD.avatar_url IS DISTINCT FROM NEW.avatar_url
)
EXECUTE FUNCTION public.sync_profile_to_teacher();
