import { createHmac, timingSafeEqual } from "crypto";

const BASE_URL = () => process.env.BALANCE_ACTIVO_API_URL || "https://balanceactivo.net/api/public/v1";
const API_KEY = () => process.env.BALANCE_ACTIVO_API_KEY;
const WEBHOOK_SECRET = () => process.env.BALANCE_ACTIVO_WEBHOOK_SECRET;

export class BalanceActivoError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function baFetch<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const key = API_KEY();
  if (!key) throw new BalanceActivoError(0, "no_key", "BALANCE_ACTIVO_API_KEY no está configurada");
  const url = `${BASE_URL()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = json?.error ?? {};
    throw new BalanceActivoError(res.status, err.code || "http_error", err.message || res.statusText);
  }
  return (json?.data ?? json) as T;
}

export type BaCustomer = {
  id: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  documento?: string | null;
};

export type BaInvoice = {
  id: string;
  cliente_id: string;
  ncf?: string | null;
  numero?: string | null;
  fecha?: string | null;
  concepto?: string | null;
  moneda?: string | null;
  subtotal?: number | null;
  itbis?: number | null;
  total: number;
  saldo?: number | null;
  estado: string;
  pdf_url?: string | null;
  factura_lineas?: any[];
};

export type BaPayment = {
  id: string;
  factura_id: string;
  cliente_id?: string;
  fecha?: string | null;
  monto: number;
  moneda?: string | null;
  metodo?: string | null;
  nota?: string | null;
};

export function verifyBaSignature(rawBody: string, header: string | null): boolean {
  const secret = WEBHOOK_SECRET();
  if (!secret || !header?.startsWith("sha256=")) return false;
  try {
    const received = Buffer.from(header.slice(7), "hex");
    const expected = createHmac("sha256", secret).update(rawBody).digest();
    return received.length === expected.length && timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}

/**
 * Sincroniza facturas y cobros de un cliente BA hacia external_invoices / external_payments.
 * Usa el cliente admin (bypass RLS).
 */
export async function syncCustomerData(
  userId: string,
  customerId: string,
): Promise<{ invoices: number; payments: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const invoices = await baFetch<BaInvoice[]>(
    `/facturas?cliente_id=${encodeURIComponent(customerId)}&limit=200`,
  );
  const payments = await baFetch<BaPayment[]>(
    `/cobros?cliente_id=${encodeURIComponent(customerId)}&limit=200`,
  ).catch(() => [] as BaPayment[]);

  const now = new Date().toISOString();
  for (const inv of invoices) {
    await supabaseAdmin.from("external_invoices").upsert(
      {
        external_id: inv.id,
        user_id: userId,
        ba_customer_id: inv.cliente_id,
        numero: inv.numero ?? null,
        ncf: inv.ncf ?? null,
        fecha: inv.fecha ?? null,
        concepto: inv.concepto ?? null,
        moneda: inv.moneda ?? "DOP",
        subtotal: inv.subtotal ?? null,
        itbis: inv.itbis ?? null,
        total: inv.total ?? 0,
        saldo: inv.saldo ?? null,
        estado: inv.estado ?? "pendiente",
        pdf_url: inv.pdf_url ?? null,
        raw: inv as any,
        synced_at: now,
      },
      { onConflict: "external_id" },
    );
  }
  for (const pay of payments) {
    await supabaseAdmin.from("external_payments").upsert(
      {
        external_id: pay.id,
        invoice_external_id: pay.factura_id,
        user_id: userId,
        ba_customer_id: customerId,
        fecha: pay.fecha ?? null,
        monto: pay.monto ?? 0,
        moneda: pay.moneda ?? "DOP",
        metodo: pay.metodo ?? null,
        nota: pay.nota ?? null,
        raw: pay as any,
        synced_at: now,
      },
      { onConflict: "external_id" },
    );
  }
  return { invoices: invoices.length, payments: payments.length };
}

/**
 * Sincroniza un lote de alumnos con concurrencia limitada. Los fallos por alumno
 * se capturan y no abortan el resto del lote.
 */
export async function syncManyCustomers(
  targets: Array<{ userId: string; customerId: string }>,
  concurrency = 5,
): Promise<{
  processed: number;
  invoices: number;
  payments: number;
  errors: Array<{ userId: string; message: string }>;
}> {
  let processed = 0;
  let invoices = 0;
  let payments = 0;
  const errors: Array<{ userId: string; message: string }> = [];

  for (let i = 0; i < targets.length; i += concurrency) {
    const chunk = targets.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (t) => {
        try {
          const r = await syncCustomerData(t.userId, t.customerId);
          processed += 1;
          invoices += r.invoices;
          payments += r.payments;
        } catch (e) {
          errors.push({
            userId: t.userId,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }),
    );
  }
  return { processed, invoices, payments, errors };
}
