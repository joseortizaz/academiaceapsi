
DROP POLICY IF EXISTS "Insertar pagos propios" ON public.payments;

CREATE POLICY "Insertar pagos propios"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND estado = 'pendiente'
  AND procesado_por IS NULL
  AND fecha_pago IS NULL
);

CREATE OR REPLACE FUNCTION public.prevent_payment_privileged_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.estado IS DISTINCT FROM 'pendiente'
       OR NEW.procesado_por IS NOT NULL
       OR NEW.fecha_pago IS NOT NULL THEN
      RAISE EXCEPTION 'No autorizado a establecer estado/procesado_por/fecha_pago en el pago';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.estado IS DISTINCT FROM OLD.estado
       OR NEW.monto IS DISTINCT FROM OLD.monto
       OR NEW.metodo IS DISTINCT FROM OLD.metodo
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.programa_id IS DISTINCT FROM OLD.programa_id
       OR NEW.procesado_por IS DISTINCT FROM OLD.procesado_por
       OR NEW.fecha_pago IS DISTINCT FROM OLD.fecha_pago THEN
      RAISE EXCEPTION 'No autorizado a modificar campos sensibles del pago';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_payment_privileged_changes ON public.payments;
CREATE TRIGGER trg_prevent_payment_privileged_changes
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.prevent_payment_privileged_changes();
