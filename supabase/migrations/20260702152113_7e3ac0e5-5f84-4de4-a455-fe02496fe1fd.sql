-- Vínculo del alumno con su cliente en Balance Activo
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS balance_activo_customer_id text;

-- Facturas replicadas desde Balance Activo
CREATE TABLE public.external_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ba_customer_id text NOT NULL,
  numero text,
  ncf text,
  fecha date,
  concepto text,
  moneda text DEFAULT 'DOP',
  subtotal numeric(14,2),
  itbis numeric(14,2),
  total numeric(14,2) NOT NULL DEFAULT 0,
  saldo numeric(14,2),
  estado text NOT NULL DEFAULT 'pendiente',
  pdf_url text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_invoices TO authenticated;
GRANT ALL ON public.external_invoices TO service_role;

ALTER TABLE public.external_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alumno ve sus facturas"
  ON public.external_invoices FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin ve todas las facturas"
  ON public.external_invoices FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin gestiona facturas"
  ON public.external_invoices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_external_invoices_user ON public.external_invoices(user_id);
CREATE INDEX idx_external_invoices_customer ON public.external_invoices(ba_customer_id);

-- Cobros replicados desde Balance Activo
CREATE TABLE public.external_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL UNIQUE,
  invoice_external_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ba_customer_id text NOT NULL,
  fecha date,
  monto numeric(14,2) NOT NULL DEFAULT 0,
  moneda text DEFAULT 'DOP',
  metodo text,
  nota text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_payments TO authenticated;
GRANT ALL ON public.external_payments TO service_role;

ALTER TABLE public.external_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alumno ve sus pagos"
  ON public.external_payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin ve todos los pagos"
  ON public.external_payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin gestiona pagos"
  ON public.external_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_external_payments_user ON public.external_payments(user_id);
CREATE INDEX idx_external_payments_invoice ON public.external_payments(invoice_external_id);

-- Log de webhooks recibidos de Balance Activo
CREATE TABLE public.balance_activo_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  delivery_id text UNIQUE,
  signature_valid boolean NOT NULL DEFAULT false,
  processed boolean NOT NULL DEFAULT false,
  error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.balance_activo_webhook_logs TO authenticated;
GRANT ALL ON public.balance_activo_webhook_logs TO service_role;

ALTER TABLE public.balance_activo_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lee logs de webhook BA"
  ON public.balance_activo_webhook_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Triggers de updated_at
CREATE TRIGGER update_external_invoices_updated_at BEFORE UPDATE ON public.external_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_external_payments_updated_at BEFORE UPDATE ON public.external_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();