import { createFileRoute } from "@tanstack/react-router";

/**
 * Corrida diaria de mora, invocada por pg_cron a las 8:00 a. m. hora RD
 * (12:00 UTC), después de la sincronización nocturna con Balance Activo.
 *
 * Autenticación: header `apikey` con la anon key del proyecto (mismo patrón que
 * /api/public/hooks/sync-active-students). No devuelve datos personales.
 */
export const Route = createFileRoute("/api/public/hooks/evaluar-mora")({
  staticData: { sitemap: false },
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

        try {
          const { ejecutarMoraDiaria } = await import("@/lib/mora.server");
          const r = await ejecutarMoraDiaria();
          return new Response(
            JSON.stringify({
              ok: true,
              evaluados: r.evaluados,
              restringidos: r.restringidos,
              enviados: r.enviados,
              errores: r.errores.length,
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await (supabaseAdmin as any).from("balance_activo_webhook_logs").insert({
            event: "mora_diaria",
            signature_valid: true,
            processed: false,
            error: message,
            payload: { stage: "ejecutar" },
          });
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
