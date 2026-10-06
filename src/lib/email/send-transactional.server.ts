/**
 * Envío de correos transaccionales desde el servidor (tareas programadas), sin
 * sesión de usuario. Sigue los mismos pasos que /lovable/email/transactional/send
 * y /api/public/course-request: lista de supresión, token de baja, render de la
 * plantilla, registro en email_send_log y cola `transactional_emails`.
 */
import * as React from "react";
import { render } from "react-email";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "ceapsird";
const SENDER_DOMAIN = "notify.academiaceapsi.com";
const FROM_DOMAIN = "academiaceapsi.com";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type SendResult =
  | { ok: true }
  | { ok: false; reason: "suppressed" | "no_template" | "error"; detail?: string };

export async function sendTransactionalEmail(args: {
  templateName: string;
  recipientEmail: string;
  templateData: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<SendResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const recipient = args.recipientEmail.trim().toLowerCase();
  const template = TEMPLATES[args.templateName];
  if (!template) return { ok: false, reason: "no_template" };

  const { data: suppressed, error: supErr } = await supabaseAdmin
    .from("suppressed_emails")
    .select("id")
    .eq("email", recipient)
    .maybeSingle();
  if (supErr) return { ok: false, reason: "error", detail: "suppression_check" };
  if (suppressed) return { ok: false, reason: "suppressed" };

  // Token de baja: se reutiliza el existente o se crea uno.
  let unsubscribeToken: string | null = null;
  const { data: existing } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", recipient)
    .maybeSingle();
  if (existing?.used_at) return { ok: false, reason: "suppressed" };
  if (existing) {
    unsubscribeToken = existing.token;
  } else {
    await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .upsert({ token: generateToken(), email: recipient }, { onConflict: "email", ignoreDuplicates: true });
    const { data: stored } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", recipient)
      .maybeSingle();
    unsubscribeToken = stored?.token ?? null;
  }
  if (!unsubscribeToken) return { ok: false, reason: "error", detail: "unsubscribe_token" };

  const element = React.createElement(template.component, args.templateData);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(args.templateData) : template.subject;

  const messageId = crypto.randomUUID();
  await supabaseAdmin.from("email_send_log").insert({
    message_id: messageId,
    template_name: args.templateName,
    recipient_email: recipient,
    status: "pending",
  });

  const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: "transactional",
      label: args.templateName,
      idempotency_key: args.idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  } as never);

  if (enqueueError) {
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: args.templateName,
      recipient_email: recipient,
      status: "failed",
      error_message: "Failed to enqueue email",
    });
    return { ok: false, reason: "error", detail: enqueueError.message };
  }
  return { ok: true };
}
