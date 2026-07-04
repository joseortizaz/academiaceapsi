import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  baFetch,
  syncCustomerData,
  syncManyCustomers,
  type BaCustomer,
} from "./balance-activo.server";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("No autorizado: se requiere rol admin.");
}

/** Estudiante: lista sus facturas (desde caché local). */
export const listMyInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: invoices } = await context.supabase
      .from("external_invoices")
      .select("*")
      .eq("user_id", context.userId)
      .order("fecha", { ascending: false });
    const { data: payments } = await context.supabase
      .from("external_payments")
      .select("*")
      .eq("user_id", context.userId)
      .order("fecha", { ascending: false });
    return { invoices: invoices ?? [], payments: payments ?? [] };
  });

/** Estudiante: refresca sus facturas desde Balance Activo. */
export const syncMyInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("balance_activo_customer_id")
      .eq("id", context.userId)
      .maybeSingle();
    const customerId = profile?.balance_activo_customer_id;
    if (!customerId) return { synced: 0, payments: 0, linked: false };

    const r = await syncCustomerData(context.userId, customerId);
    return { synced: r.invoices, payments: r.payments, linked: true };
  });

/** Admin: verifica la conexión con Balance Activo. */
export const getBaConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    try {
      const me = await baFetch<{ tenant_id: string; razon_social: string; rnc?: string }>("/me");
      return { connected: true, tenant: me };
    } catch (e) {
      return { connected: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

/** Admin: busca clientes en Balance Activo. */
export const adminSearchCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search: string }) => z.object({ search: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const results = await baFetch<BaCustomer[]>(`/clientes?search=${encodeURIComponent(data.search)}&limit=20`);
    return results;
  });

/** Admin: vincula un alumno con un cliente de Balance Activo. */
export const adminLinkCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; customerId: string }) =>
    z.object({ userId: z.string().uuid(), customerId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ balance_activo_customer_id: data.customerId })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin: sincroniza las facturas de un alumno específico. */
export const adminSyncUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("balance_activo_customer_id")
      .eq("id", data.userId)
      .maybeSingle();
    const customerId = (profile as any)?.balance_activo_customer_id;
    if (!customerId) throw new Error("Alumno sin cliente vinculado en Balance Activo.");

    const invoices = await baFetch<BaInvoice[]>(`/facturas?cliente_id=${encodeURIComponent(customerId)}&limit=200`);
    const payments = await baFetch<BaPayment[]>(`/cobros?cliente_id=${encodeURIComponent(customerId)}&limit=200`).catch(() => [] as BaPayment[]);

    for (const inv of invoices) {
      await supabaseAdmin.from("external_invoices").upsert({
        external_id: inv.id,
        user_id: data.userId,
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
        synced_at: new Date().toISOString(),
      }, { onConflict: "external_id" });
    }
    for (const pay of payments) {
      await supabaseAdmin.from("external_payments").upsert({
        external_id: pay.id,
        invoice_external_id: pay.factura_id,
        user_id: data.userId,
        ba_customer_id: customerId,
        fecha: pay.fecha ?? null,
        monto: pay.monto ?? 0,
        moneda: pay.moneda ?? "DOP",
        metodo: pay.metodo ?? null,
        nota: pay.nota ?? null,
        raw: pay as any,
        synced_at: new Date().toISOString(),
      }, { onConflict: "external_id" });
    }
    return { invoices: invoices.length, payments: payments.length };
  });
