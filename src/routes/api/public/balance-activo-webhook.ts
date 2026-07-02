import { createFileRoute } from "@tanstack/react-router";
import { verifyBaSignature } from "@/lib/balance-activo.server";

type BaEvent = {
  event: string;
  delivery_id?: string;
  data?: any;
};

export const Route = createFileRoute("/api/public/balance-activo-webhook")({
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

            await supabaseAdmin.from("external_invoices").upsert({
              external_id: payload.id,
              user_id: userId,
              ba_customer_id: customerId,
              numero: payload.numero ?? null,
              ncf: payload.ncf ?? null,
              fecha: payload.fecha ?? null,
              concepto: payload.concepto ?? null,
              moneda: payload.moneda ?? "DOP",
              subtotal: payload.subtotal ?? null,
              itbis: payload.itbis ?? null,
              total: payload.total ?? 0,
              saldo: payload.saldo ?? null,
              estado: payload.estado ?? "pendiente",
              pdf_url: payload.pdf_url ?? null,
              raw: payload as any,
              synced_at: new Date().toISOString(),
            }, { onConflict: "external_id" });
          } else if (evt === "cobro.created") {
            const invoiceExtId = payload.factura_id;
            const { data: inv } = await supabaseAdmin
              .from("external_invoices")
              .select("user_id, ba_customer_id")
              .eq("external_id", invoiceExtId)
              .maybeSingle();

            await supabaseAdmin.from("external_payments").upsert({
              external_id: payload.id,
              invoice_external_id: invoiceExtId,
              user_id: (inv as any)?.user_id ?? null,
              ba_customer_id: (inv as any)?.ba_customer_id ?? payload.cliente_id ?? "",
              fecha: payload.fecha ?? null,
              monto: payload.monto ?? 0,
              moneda: payload.moneda ?? "DOP",
              metodo: payload.metodo ?? null,
              nota: payload.nota ?? null,
              raw: payload as any,
              synced_at: new Date().toISOString(),
            }, { onConflict: "external_id" });
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
