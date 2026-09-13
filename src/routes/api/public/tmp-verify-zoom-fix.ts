import { createFileRoute } from "@tanstack/react-router";
import { zoomApi, signMeetingSdkJwt, getZakToken } from "@/lib/zoom.server";

export const Route = createFileRoute("/api/public/tmp-verify-zoom-fix")({
  server: {
    handlers: {
      GET: async () => {
        const result: {
          meetingId: number | null;
          jwtOk: boolean;
          zakOk: boolean;
          wcInfoStatus: number | null;
          wcInfoBody: string | null;
          error: string | null;
        } = { meetingId: null, jwtOk: false, zakOk: false, wcInfoStatus: null, wcInfoBody: null, error: null };

        // 1-2. Crear reunión y obtener zoom_meeting_id
        let meeting: { id: number };
        try {
          const start = new Date(Date.now() + 5 * 60 * 1000);
          meeting = (await zoomApi("/users/ceapsi.rd@gmail.com/meetings", {
            method: "POST",
            body: JSON.stringify({
              type: 2,
              topic: "Test fix ZAK",
              start_time: start.toISOString(),
              duration: 30,
              timezone: "America/Santo_Domingo",
              settings: { join_before_host: true, waiting_room: false },
            }),
          })) as { id: number };
          result.meetingId = meeting.id;
        } catch (e) {
          result.error = `paso 1-2 (crear reunión): ${e instanceof Error ? e.message : String(e)}`;
          return Response.json(result);
        }

        // 3. Firmar JWT del Meeting SDK
        let signature = "";
        try {
          const sig = signMeetingSdkJwt({ meetingNumber: String(meeting.id), role: 1 });
          signature = sig.signature;
          result.jwtOk = true;
        } catch (e) {
          result.error = `paso 3 (signMeetingSdkJwt): ${e instanceof Error ? e.message : String(e)}`;
          return Response.json(result);
        }

        // 4. Obtener ZAK
        let zak = "";
        try {
          zak = await getZakToken("ceapsi.rd@gmail.com");
          result.zakOk = true;
        } catch (e) {
          result.error = `paso 4 (getZakToken): ${e instanceof Error ? e.message : String(e)}`;
          return Response.json(result);
        }

        // 5. Validar contra wc/info como el Meeting SDK Web
        try {
          const body = new URLSearchParams({
            mn: String(meeting.id),
            email: "ceapsi.rd@gmail.com",
            pwd: "",
            role: "1",
            lang: "es-ES",
            signature,
            china: "0",
            apiKey: process.env.ZOOM_SDK_KEY!,
            zak,
          });
          const res = await fetch("https://zoom.us/api/v1/wc/info", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
          });
          result.wcInfoStatus = res.status;
          result.wcInfoBody = await res.text();
        } catch (e) {
          result.error = `paso 5 (wc/info): ${e instanceof Error ? e.message : String(e)}`;
        }

        return Response.json(result);
      },
    },
  },
});
