-- Restore UPDATE grant on privileged enrollment columns to authenticated.
-- Access control is enforced by the trigger prevent_enrollment_privileged_updates,
-- which allows admins (via has_role) to modify estado, progreso, fechas, etc.,
-- and blocks non-admins from changing those fields.
GRANT UPDATE (
  estado,
  progreso_porcentaje,
  fecha_completado,
  fecha_vencimiento,
  pago_id,
  nombre_completo,
  documento_identidad,
  email_contacto,
  telefono_contacto,
  area_profesional,
  notas
) ON public.enrollments TO authenticated;