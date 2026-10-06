import { createFileRoute } from "@tanstack/react-router";
import { syncCustomerData, verifyBaSignature } from "@/lib/balance-activo.server";

type BaEvent = {
  event: string;
  delivery_id?: string;
  data?: any;
};

export const Route = createFileRoute("/api/public/balance-activo-webhook")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-ba-signature");
        const eventHeader = request.headers.get("x-ba-event");

        let body: BaEvent;
        try {
          body = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const valid = verifyBaSignature(rawBody, signature);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotencia por delivery_id
        const deliveryId = body.delivery_id ?? null;
        if (deliveryId) {
          const { data: existing } = await supabaseAdmin
            .from("balance_activo_webhook_logs")
            .select("id, processed")
            .eq("delivery_id", deliveryId)
            .maybeSingle();
          if (existing?.processed) return new Response("ok (dup)", { status: 200 });
        }

        const { data: logRow } = await supabaseAdmin
          .from("balance_activo_webhook_logs")
          .insert({
            event: body.event || eventHeader || "unknown",
            delivery_id: deliveryId,
            signature_valid: valid,
            processed: false,
            payload: body as any,
          })
          .select("id")
          .single();

        if (!valid) return new Response("Invalid signature", { status: 401 });

        try {
          const evt = body.event ?? "";
          const payload = body.data ?? {};

          if (evt.startsWith("factura.") || evt.startsWith("cobro.")) {
            // Balance Activo solo manda el cliente en factura.created; en
            // factura.updated / factura.paid / cobro.* se deduce de la factura ya
            // guardada. Nunca se escribe el evento tal cual: no trae las cuotas y
            // desvincularía la factura del alumno.
            let customerId: string | null = payload.cliente_id ?? null;
            const facturaId: string | null = evt.startsWith("factura.") ? payload.id ?? null : payload.factura_id ?? null;
            if (!customerId && facturaId) {
              const { data: inv } = await supabaseAdmin
                .from("external_invoices")
                .select("ba_customer_id")
                .eq("external_id", facturaId)
                .maybeSingle();
              customerId = (inv as any)?.ba_customer_id ?? null;
            }

            if (customerId) {
              const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("id")
                .eq("balance_activo_customer_id", customerId)
                .maybeSingle();
              const userId = (profile as any)?.id ?? null;
              // Alumno vinculado: se relee su estado de cuenta completo (facturas,
              // cuotas y cobros) y se recalcula su mora. Si la API falla, se
              // responde 500 para que Balance Activo reintente.
              if (userId) await syncCustomerData(userId, customerId);
            }
            // Cliente sin alumno vinculado: no se guarda nada; al vincularlo desde
            // el panel se sincroniza su estado de cuenta completo.
          }
          // cliente.* : sin acción local (el vínculo lo hace el admin).

          if (logRow?.id) {
            await supabaseAdmin
              .from("balance_activo_webhook_logs")
              .update({ processed: true })
              .eq("id", logRow.id);
          }
        } catch (e) {
          if (logRow?.id) {
            await supabaseAdmin
              .from("balance_activo_webhook_logs")
              .update({ error: e instanceof Error ? e.message : String(e) })
              .eq("id", logRow.id);
          }
          return new Response("Processing error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
