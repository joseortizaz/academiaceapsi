import { createFileRoute } from "@tanstack/react-router";
import {
  mapInvoiceRow,
  mapPaymentRow,
  syncCustomerData,
  verifyBaSignature,
} from "@/lib/balance-activo.server";

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
          const evt = body.event;
          const payload = body.data ?? {};

          if (evt === "factura.created" || evt === "factura.updated" || evt === "factura.paid") {
            const customerId = payload.cliente_id;
            // Buscar el user_id por balance_activo_customer_id
            const { data: profile } = await supabaseAdmin
              .from("profiles")
              .select("id")
              .eq("balance_activo_customer_id", customerId)
              .maybeSingle();
            const userId = (profile as any)?.id ?? null;

            if (userId) {
              // El evento no trae el plan de cuotas: se vuelve a leer el estado de
              // cuenta completo del alumno desde la API (y se recalcula su mora).
              await syncCustomerData(userId, customerId);
            } else {
              const { error: invErr } = await supabaseAdmin
                .from("external_invoices")
                .upsert(mapInvoiceRow(payload, userId), { onConflict: "external_id" });
              if (invErr) throw new Error(invErr.message);
            }
          } else if (evt === "cobro.created" || evt === "cobro.updated") {
            const invoiceExtId = payload.factura_id;
            const { data: inv } = await supabaseAdmin
              .from("external_invoices")
              .select("user_id, ba_customer_id")
              .eq("external_id", invoiceExtId)
              .maybeSingle();
            const userId = (inv as any)?.user_id ?? null;
            const customerId = (inv as any)?.ba_customer_id ?? payload.cliente_id ?? "";

            // El cobro solo se asigna al dueño de la factura (nunca por otro camino).
            const { error: payErr } = await supabaseAdmin
              .from("external_payments")
              .upsert(mapPaymentRow(payload, userId, customerId), { onConflict: "external_id" });
            if (payErr) throw new Error(payErr.message);

            // Un cobro cambia el saldo de la factura: refrescar el estado de cuenta del alumno.
            if (userId && customerId) {
              await syncCustomerData(userId, customerId).catch(() => undefined);
            }
          }
          // cliente.* eventos: no requieren acción local por ahora (el vínculo lo hace el admin).

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
