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
    return await syncCustomerData(data.userId, customerId);
  });

/**
 * Admin: ejecuta manualmente la sincronización masiva de todos los alumnos
 * con inscripción activa/pendiente y cliente BA vinculado.
 * Es el mismo trabajo que el cron nocturno.
 */
export const adminRunFullSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const started = Date.now();

    const { data: enrollments, error } = await supabaseAdmin
      .from("enrollments")
      .select("user_id, profiles!inner(balance_activo_customer_id)")
      .in("estado", ["activo", "pendiente"])
      .not("profiles.balance_activo_customer_id", "is", null);
    if (error) throw new Error(error.message);

    const seen = new Set<string>();
    const targets: Array<{ userId: string; customerId: string }> = [];
    for (const row of (enrollments ?? []) as any[]) {
      const cid = row?.profiles?.balance_activo_customer_id;
      if (!row.user_id || !cid || seen.has(row.user_id)) continue;
      seen.add(row.user_id);
      targets.push({ userId: row.user_id, customerId: cid });
    }

    const result = await syncManyCustomers(targets, 5);
    const duration_ms = Date.now() - started;

    await supabaseAdmin.from("balance_activo_webhook_logs").insert({
      event: "cron_sync",
      signature_valid: true,
      processed: result.errors.length === 0,
      error: result.errors.length ? `${result.errors.length} fallos` : null,
      payload: {
        source: "admin_manual",
        targets: targets.length,
        processed: result.processed,
        invoices: result.invoices,
        payments: result.payments,
        duration_ms,
        errors: result.errors,
      } as any,
    });

    return { ...result, targets: targets.length, duration_ms };
  });
