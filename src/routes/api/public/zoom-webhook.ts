import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildZoomUrlValidationResponse,
  verifyZoomWebhookSignature,
} from "@/lib/zoom.server";

type ZoomEvent = {
  event: string;
  event_ts?: number;
  payload?: {
    plainToken?: string;
    object?: {
      id?: number | string;
      uuid?: string;
      recording_files?: Array<{
        file_type?: string;
        play_url?: string;
        download_url?: string;
        recording_type?: string;
      }>;
      share_url?: string;
      password?: string;
      duration?: number;
    };
  };
};

export const Route = createFileRoute("/api/public/zoom-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-zm-signature");
        const timestamp = request.headers.get("x-zm-request-timestamp");

        let body: ZoomEvent;
        try {
          body = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        // URL Validation (CRC) — Zoom envía esto al registrar el endpoint.
        if (body.event === "endpoint.url_validation" && body.payload?.plainToken) {
          const resp = buildZoomUrlValidationResponse(body.payload.plainToken);
          return new Response(JSON.stringify(resp), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        const valid = verifyZoomWebhookSignature({ signature, timestamp, rawBody });
        const meetingId = body.payload?.object?.id ? String(body.payload.object.id) : null;

        const { data: logRow } = await supabaseAdmin
          .from("zoom_webhook_logs")
          .insert({
            event: body.event,
            event_ts: body.event_ts ?? null,
            zoom_meeting_id: meetingId,
            payload: body as unknown as never,
            signature_valid: valid,
            processed: false,
          })
          .select("id")
          .single();

        if (!valid) {
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          if (body.event === "meeting.started" && meetingId) {
            await supabaseAdmin
              .from("zoom_meetings")
              .update({ status: "live" })
              .eq("zoom_meeting_id", meetingId);
          } else if (body.event === "meeting.ended" && meetingId) {
            await supabaseAdmin
              .from("zoom_meetings")
              .update({ status: "ended" })
              .eq("zoom_meeting_id", meetingId);
          } else if (body.event === "recording.completed" && meetingId) {
            const obj = body.payload?.object;
            const mp4 = obj?.recording_files?.find(
              (f) => f.file_type === "MP4" && (f.recording_type === "shared_screen_with_speaker_view" || true),
            );
            await supabaseAdmin
              .from("zoom_meetings")
              .update({
                status: "recorded",
                recording_url: mp4?.play_url ?? mp4?.download_url ?? null,
                recording_share_url: obj?.share_url ?? null,
                recording_password: obj?.password ?? null,
                recording_duration_min: obj?.duration ?? null,
              })
              .eq("zoom_meeting_id", meetingId);
          }

          if (logRow?.id) {
            await supabaseAdmin
              .from("zoom_webhook_logs")
              .update({ processed: true })
              .eq("id", logRow.id);
          }
        } catch (e) {
          if (logRow?.id) {
            await supabaseAdmin
              .from("zoom_webhook_logs")
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
