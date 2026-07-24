import { createFileRoute } from "@tanstack/react-router";
import { zoomApi } from "@/lib/zoom.server";

/**
 * Reconciliación de grabaciones de Zoom.
 *
 * Recorre reuniones cuyo status es 'live' o 'ended' y todavía no tienen
 * recording_url, llama a GET /meetings/{id}/recordings y, si la grabación
 * está lista ("completed"), rellena los campos igual que haría el webhook
 * `recording.completed`.
 *
 * Sirve de respaldo cuando el webhook falla o se pierde (p. ej. Event
 * Subscription apuntando a la cuenta equivocada).
 *
 * Auth: header `apikey` con SUPABASE_PUBLISHABLE_KEY (patrón /api/public/hooks/*).
 * Query opcional: ?meetingId=<zoom_meeting_id> para forzar una sola reunión
 * (incluye status 'scheduled' — útil para el backfill manual).
 */
type RecordingFile = {
  file_type?: string;
  status?: string;
  play_url?: string;
  download_url?: string;
  recording_type?: string;
};

type RecordingsResponse = {
  duration?: number;
  share_url?: string;
  password?: string;
  recording_files?: RecordingFile[];
};

export const Route = createFileRoute("/api/public/hooks/reconcile-zoom-recordings")({
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

        const url = new URL(request.url);
        const forceId = url.searchParams.get("meetingId");
        const minAgeMin = Number(url.searchParams.get("minAgeMin") ?? "10");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let q = supabaseAdmin
          .from("zoom_meetings")
          .select("id, zoom_meeting_id, status, start_at, duration_min, recording_url");

        if (forceId) {
          q = q.eq("zoom_meeting_id", forceId);
        } else {
          q = q.in("status", ["live", "ended"]).is("recording_url", null);
        }

        const { data: rows, error } = await q;
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const now = Date.now();
        const candidates = (rows ?? []).filter((r) => {
          if (forceId) return true;
          if (!r.zoom_meeting_id) return false;
          if (!r.start_at) return true;
          const endedAt = new Date(r.start_at).getTime() + (r.duration_min ?? 0) * 60_000;
          return now - endedAt >= minAgeMin * 60_000;
        });

        const results: Array<{ id: string; outcome: string; error?: string }> = [];

        for (const row of candidates) {
          try {
            const rec = await zoomApi<RecordingsResponse>(
              `/meetings/${row.zoom_meeting_id}/recordings`,
            );
            const files = rec.recording_files ?? [];
            const anyProcessing = files.some((f) => (f.status ?? "").toLowerCase() !== "completed");
            if (files.length === 0) {
              results.push({ id: row.id, outcome: "no_recording" });
              continue;
            }
            if (anyProcessing) {
              results.push({ id: row.id, outcome: "processing" });
              continue;
            }
            const mp4 =
              files.find(
                (f) =>
                  f.file_type === "MP4" &&
                  f.recording_type === "shared_screen_with_speaker_view",
              ) ?? files.find((f) => f.file_type === "MP4");

            const { error: upErr } = await supabaseAdmin
              .from("zoom_meetings")
              .update({
                status: "recorded",
                recording_url: mp4?.play_url ?? mp4?.download_url ?? null,
                recording_share_url: rec.share_url ?? null,
                recording_password: rec.password ?? null,
                recording_duration_min: rec.duration ?? null,
              })
              .eq("id", row.id);
            if (upErr) throw new Error(upErr.message);
            results.push({ id: row.id, outcome: "updated" });
          } catch (e) {
            results.push({
              id: row.id,
              outcome: "error",
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            scanned: candidates.length,
            results,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
