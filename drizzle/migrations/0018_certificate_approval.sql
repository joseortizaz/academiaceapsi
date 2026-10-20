-- 1a. Ampliar los estados posibles de certificado
ALTER TABLE public.certificates DROP CONSTRAINT certificates_estado_check;
ALTER TABLE public.certificates
  ADD CONSTRAINT certificates_estado_check
  CHECK (estado = ANY (ARRAY['emitido'::text, 'revocado'::text, 'pendiente_aprobacion'::text, 'rechazado'::text]));

-- 1b. Forzar el estado inicial del certificado en el servidor según la modalidad
-- del programa, SIN confiar en lo que mande el cliente. Si quien inserta es un
-- admin (emisión manual desde /admin/certificados), se respeta 'emitido' directo
-- (el admin ya está emitiendo conscientemente, no necesita auto-aprobarse).
CREATE OR REPLACE FUNCTION public.enforce_certificate_initial_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_modalidad text;
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW; -- respeta el estado que ya trae NEW (default 'emitido' si no se especificó)
  END IF;

  SELECT modalidad INTO v_modalidad FROM public.programs WHERE id = NEW.programa_id;

  IF v_modalidad IN ('sincrono', 'mixto') THEN
    NEW.estado := 'pendiente_aprobacion';
  ELSE
    NEW.estado := 'emitido';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_certificate_insert_set_estado ON public.certificates;
CREATE TRIGGER before_certificate_insert_set_estado
BEFORE INSERT ON public.certificates
FOR EACH ROW EXECUTE FUNCTION public.enforce_certificate_initial_state();

-- 1c. Notificar a los admins cuando un certificado queda pendiente de aprobación
-- (mismo patrón que la función existente notify_admins_on_pending_review para
-- reseñas, pero apuntando a /admin/certificados).
CREATE OR REPLACE FUNCTION public.notify_admins_on_certificate_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_programa_titulo text;
  v_estudiante text;
BEGIN
  IF NEW.estado <> 'pendiente_aprobacion' THEN
    RETURN NEW;
  END IF;

  SELECT titulo INTO v_programa_titulo FROM public.programs WHERE id = NEW.programa_id;
  SELECT trim(coalesce(nombre,'') || ' ' || coalesce(apellido,'')) INTO v_estudiante
    FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, tipo, titulo, mensaje, enlace, programa_id)
  SELECT ur.user_id,
         'certificado_pendiente',
         'Certificado pendiente de aprobación',
         coalesce(nullif(trim(v_estudiante), ''), 'Un estudiante') || ' — ' || coalesce(v_programa_titulo, 'un programa'),
         '/admin/certificados',
         NEW.programa_id
  FROM public.user_roles ur
  WHERE ur.role = 'admin';

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS certificates_notify_admins_pending ON public.certificates;
CREATE TRIGGER certificates_notify_admins_pending
AFTER INSERT ON public.certificates
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_certificate_pending();