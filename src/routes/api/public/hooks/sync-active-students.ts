import { createFileRoute } from "@tanstack/react-router";
import { syncManyCustomers } from "@/lib/balance-activo.server";

/**
 * Endpoint invocado por pg_cron cada noche para sincronizar los estados de cuenta
 * de todos los alumnos con inscripción activa/pendiente y cliente BA vinculado.
 *
 * Autenticación: header `apikey` con la anon key del proyecto (patrón canónico
 * para /api/public/hooks/*). Ninguna PII se retorna; solo escribe.
 */
export const Route = createFileRoute("/api/public/hooks/sync-active-students")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const started = Date.now();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: enrollments, error } = await supabaseAdmin
          .from("enrollments")
          .select("user_id, profiles!inner(balance_activo_customer_id)")
          .in("estado", ["activo", "pendiente"])
          .not("profiles.balance_activo_customer_id", "is", null);

        if (error) {
          await supabaseAdmin.from("balance_activo_webhook_logs").insert({
            event: "cron_sync",
            signature_valid: true,
            processed: false,
            error: error.message,
            payload: { source: "cron", stage: "query_targets" } as any,
          });
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

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
            source: "cron",
            targets: targets.length,
            processed: result.processed,
            invoices: result.invoices,
            payments: result.payments,
            duration_ms,
            errors: result.errors,
          } as any,
        });

        return new Response(
          JSON.stringify({
            ok: true,
            targets: targets.length,
            ...result,
            duration_ms,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
