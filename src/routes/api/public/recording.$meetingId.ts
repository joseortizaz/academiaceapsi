import { createFileRoute } from "@tanstack/react-router";
import { getZoomAccessToken, zoomApi } from "@/lib/zoom.server";
import { verifyRecordingToken } from "@/lib/recordings.server";

/**
 * Proxy autenticado del MP4 de una grabación de Zoom, para poder reproducirla
 * embebida dentro de la academia (sin exponer credenciales de Zoom al navegador).
 *
 * El acceso se concede mediante un enlace firmado y temporal que emite el
 * server function `getRecordingPlaybackUrl` (valida rol/inscripción del usuario).
 */
type RecordingFile = {
  file_type?: string;
  status?: string;
  download_url?: string;
  recording_type?: string;
  file_size?: number;
};

export const Route = createFileRoute("/api/public/recording/$meetingId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const exp = Number(url.searchParams.get("exp"));
        const sig = url.searchParams.get("sig") ?? "";
        const meetingRowId = params.meetingId;

        if (!verifyRecordingToken(meetingRowId, exp, sig)) {
          return new Response("Enlace de grabación inválido o expirado", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: meeting } = await supabaseAdmin
          .from("zoom_meetings")
          .select("zoom_meeting_id")
          .eq("id", meetingRowId)
          .maybeSingle();
        if (!meeting?.zoom_meeting_id) {
          return new Response("Grabación no encontrada", { status: 404 });
        }

        let files: RecordingFile[] = [];
        try {
          const rec = await zoomApi<{ recording_files?: RecordingFile[] }>(
            `/meetings/${meeting.zoom_meeting_id}/recordings`,
          );
          files = rec.recording_files ?? [];
        } catch {
          return new Response("No se pudo obtener la grabación desde Zoom", { status: 502 });
        }

        const mp4 =
          files.find(
            (f) =>
              f.file_type === "MP4" && f.recording_type === "shared_screen_with_speaker_view",
          ) ?? files.find((f) => f.file_type === "MP4");

        if (!mp4?.download_url) {
          return new Response("La grabación aún no está disponible", { status: 404 });
        }

        const token = await getZoomAccessToken();
        const range = request.headers.get("range");
        const upstream = await fetch(`${mp4.download_url}?access_token=${token}`, {
          headers: range ? { Range: range } : undefined,
          redirect: "follow",
        });

        if (!upstream.ok && upstream.status !== 206) {
          return new Response("No se pudo descargar la grabación", { status: 502 });
        }

        const headers = new Headers();
        headers.set("Content-Type", upstream.headers.get("content-type") ?? "video/mp4");
        headers.set("Accept-Ranges", "bytes");
        const len = upstream.headers.get("content-length");
        if (len) headers.set("Content-Length", len);
        const cr = upstream.headers.get("content-range");
        if (cr) headers.set("Content-Range", cr);
        headers.set("Cache-Control", "private, max-age=0, no-store");

        return new Response(upstream.body, { status: upstream.status, headers });
      },
    },
  },
});
