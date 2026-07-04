-- 1) Pin search_path on pgmq wrapper functions (fix Function Search Path Mutable)
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

-- 2) Harden the student UPDATE policy on enrollments with defense-in-depth at the RLS layer.
--    The existing BEFORE UPDATE trigger `enrollments_prevent_privileged_updates` already
--    blocks non-admin changes to estado/progreso_porcentaje/fecha_completado/pago_id/etc.
--    We recreate the policy so its intent is explicit and so admins go through their own
--    policy rather than the student one.
DROP POLICY IF EXISTS "Estudiantes actualizan contacto propio" ON public.enrollments;

CREATE POLICY "Estudiantes actualizan contacto propio"
ON public.enrollments
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND NOT public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  auth.uid() = user_id
  AND NOT public.has_role(auth.uid(), 'admin'::app_role)
  -- Column-level immutability is enforced by the trigger
  -- public.prevent_enrollment_privileged_updates(); WITH CHECK cannot compare
  -- OLD vs NEW, but the trigger guarantees estado, progreso_porcentaje,
  -- fecha_completado, fecha_vencimiento, fecha_inscripcion, pago_id, user_id,
  -- and programa_id cannot be modified by non-admins.
);

COMMENT ON POLICY "Estudiantes actualizan contacto propio" ON public.enrollments IS
  'Los estudiantes solo pueden editar campos de contacto de su propia inscripción. Los campos sensibles (estado, progreso_porcentaje, fecha_completado, pago_id, user_id, programa_id) están bloqueados por el trigger enrollments_prevent_privileged_updates.';

-- 3) Ensure the trigger is present and BEFORE UPDATE (idempotent).
DROP TRIGGER IF EXISTS enrollments_prevent_privileged_updates ON public.enrollments;
CREATE TRIGGER enrollments_prevent_privileged_updates
BEFORE UPDATE ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_enrollment_privileged_updates();