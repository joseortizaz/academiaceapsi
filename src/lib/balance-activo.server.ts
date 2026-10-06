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

/**
 * Factura tal como la devuelve la API pública de Balance Activo.
 * Ojo: la API NO devuelve `saldo`; devuelve `total` y `monto_pagado`.
 * Tampoco devuelve `numero`, `concepto`, `pdf_url` ni `moneda` (se dejan
 * opcionales por si se agregan en el futuro).
 */
export type BaInvoice = {
  id: string;
  cliente_id: string;
  ncf?: string | null;
  numero?: string | null;
  fecha?: string | null;
  fecha_vencimiento?: string | null;
  concepto?: string | null;
  moneda?: string | null;
  subtotal?: number | null;
  itbis?: number | null;
  total: number;
  monto_pagado?: number | null;
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
  estado?: string | null;
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

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Saldo pendiente: usa `saldo` si BA lo envía; si no, `total - monto_pagado`. */
export function invoiceSaldo(inv: Partial<BaInvoice>): number | null {
  const saldo = num(inv.saldo);
  if (saldo !== null) return saldo;
  const total = num(inv.total);
  if (total === null) return null;
  if (inv.estado === "pagada") return 0;
  if (inv.estado === "anulada") return 0;
  const pagado = num(inv.monto_pagado) ?? 0;
  return Math.max(Math.round((total - pagado) * 100) / 100, 0);
}

/** Convierte una factura de BA en una fila de external_invoices. */
export function mapInvoiceRow(inv: BaInvoice, userId: string | null, now = new Date().toISOString()) {
  return {
    external_id: inv.id,
    user_id: userId,
    ba_customer_id: inv.cliente_id,
    numero: inv.numero ?? null,
    ncf: inv.ncf ?? null,
    fecha: inv.fecha ?? null,
    concepto: inv.concepto ?? null,
    moneda: inv.moneda ?? "DOP",
    subtotal: num(inv.subtotal),
    itbis: num(inv.itbis),
    total: num(inv.total) ?? 0,
    saldo: invoiceSaldo(inv),
    estado: inv.estado ?? "pendiente",
    pdf_url: inv.pdf_url ?? null,
    raw: inv as any,
    synced_at: now,
  };
}

/** Convierte un cobro de BA en una fila de external_payments. */
export function mapPaymentRow(
  pay: BaPayment,
  userId: string | null,
  customerId: string,
  now = new Date().toISOString(),
) {
  return {
    external_id: pay.id,
    invoice_external_id: pay.factura_id,
    user_id: userId,
    ba_customer_id: customerId,
    fecha: pay.fecha ?? null,
    monto: num(pay.monto) ?? 0,
    moneda: pay.moneda ?? "DOP",
    metodo: pay.metodo ?? null,
    nota: pay.nota ?? null,
    raw: pay as any,
    synced_at: now,
  };
}

/**
 * Sincroniza facturas y cobros de un cliente BA hacia external_invoices / external_payments.
 * Usa el cliente admin (bypass RLS).
 *
 * Importante: la API de cobros no respeta el filtro `cliente_id` (devuelve los
 * cobros de todo Ceapsi). Por eso solo se guardan los cobros cuya `factura_id`
 * pertenece a una factura de ESTE cliente; nunca se asigna a un alumno un cobro
 * de otra persona.
 */
export async function syncCustomerData(
  userId: string,
  customerId: string,
): Promise<{ invoices: number; payments: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const fetched = await baFetch<BaInvoice[]>(
    `/facturas?cliente_id=${encodeURIComponent(customerId)}&limit=200`,
  );
  // Defensa: descartar cualquier factura que no sea de este cliente.
  const invoices = (fetched ?? []).filter((inv) => inv?.id && inv.cliente_id === customerId);
  const invoiceIds = new Set(invoices.map((i) => i.id));

  // Cobros: se piden por factura y se filtran por factura_id del lado nuestro.
  const paymentsById = new Map<string, BaPayment>();
  let paymentsFetchFailed = false;
  for (const inv of invoices) {
    const list = await baFetch<BaPayment[]>(
      `/cobros?factura_id=${encodeURIComponent(inv.id)}&cliente_id=${encodeURIComponent(customerId)}&limit=200`,
    ).catch(() => {
      paymentsFetchFailed = true;
      return [] as BaPayment[];
    });
    for (const pay of list ?? []) {
      if (!pay?.id || !invoiceIds.has(pay.factura_id)) continue;
      if (pay.estado && pay.estado !== "activo") continue; // cobros anulados no se muestran
      paymentsById.set(pay.id, pay);
    }
  }
  const payments = [...paymentsById.values()];

  const now = new Date().toISOString();
  if (invoices.length) {
    const { error } = await supabaseAdmin
      .from("external_invoices")
      .upsert(invoices.map((inv) => mapInvoiceRow(inv, userId, now)), { onConflict: "external_id" });
    if (error) throw new Error(`Facturas: ${error.message}`);
  }
  if (payments.length) {
    const { error } = await supabaseAdmin
      .from("external_payments")
      .upsert(payments.map((p) => mapPaymentRow(p, userId, customerId, now)), {
        onConflict: "external_id",
      });
    if (error) throw new Error(`Cobros: ${error.message}`);
  }

  // Limpieza: cobros que quedaron asignados a este alumno pero no son de sus facturas,
  // o que ya no existen / fueron anulados en BA.
  const { data: mine } = await supabaseAdmin
    .from("external_payments")
    .select("id, external_id, invoice_external_id")
    .eq("user_id", userId);
  const stale = (mine ?? [])
    .filter(
      (p: any) =>
        !invoiceIds.has(p.invoice_external_id) ||
        // Si BA falló al listar cobros, no se desasignan los que sí son de sus facturas.
        (!paymentsFetchFailed && !paymentsById.has(p.external_id)),
    )
    .map((p: any) => p.id);
  if (stale.length) {
    const { error } = await supabaseAdmin
      .from("external_payments")
      .update({ user_id: null })
      .in("id", stale);
    if (error) throw new Error(`Limpieza de cobros: ${error.message}`);
  }

  // Con los datos al día, recalcular su estado de mora (levanta la restricción
  // en cuanto el pago queda registrado). No envía avisos.
  const { evaluarMoraSilencioso } = await import("@/lib/mora.server");
  await evaluarMoraSilencioso(userId);

  return { invoices: invoices.length, payments: payments.length };
}

/**
 * Alumnos a sincronizar: inscripción activa/pendiente y cliente BA vinculado.
 * Se hace en dos consultas porque `enrollments.user_id` apunta a auth.users y no
 * hay relación directa con `profiles` (el embed `profiles!inner` fallaba siempre).
 */
export async function loadSyncTargets(): Promise<Array<{ userId: string; customerId: string }>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: enrollments, error } = await supabaseAdmin
    .from("enrollments")
    .select("user_id")
    .in("estado", ["activo", "pendiente"]);
  if (error) throw new Error(error.message);

  const userIds = [...new Set((enrollments ?? []).map((e: any) => e.user_id).filter(Boolean))];
  const targets: Array<{ userId: string; customerId: string }> = [];
  for (let i = 0; i < userIds.length; i += 200) {
    const chunk = userIds.slice(i, i + 200);
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, balance_activo_customer_id")
      .in("id", chunk)
      .not("balance_activo_customer_id", "is", null);
    if (pErr) throw new Error(pErr.message);
    for (const p of (profiles ?? []) as any[]) {
      if (p.balance_activo_customer_id) {
        targets.push({ userId: p.id, customerId: p.balance_activo_customer_id });
      }
    }
  }
  return targets;
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
