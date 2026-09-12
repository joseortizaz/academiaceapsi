import { createFileRoute } from "@tanstack/react-router";
import { getZakToken, zoomApi } from "@/lib/zoom.server";

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/tmp-diag-zoom")({
  server: {
    handlers: {
      GET: async () => {
        const result: Record<string, unknown> = {};

        // 1+2: ZAK de seminario.orpe@gmail.com, decodificado sin exponer el token
        try {
          const zak = await getZakToken("seminario.orpe@gmail.com");
          const payload = decodeJwtPayload(zak);
          if (payload) {
            result.zakPayload = {
              uid: payload.uid ?? null,
              uid_matches_host_id: payload.uid === "qeDMt4CqRTiU22MGCd0MIQ",
              aid: payload.aid ?? null,
              mnum: payload.mnum ?? null,
              exp: payload.exp ?? null,
              iat: payload.iat ?? null,
              wcd: payload.wcd ?? null,
              sk_present: !!payload.sk,
            };
          } else {
            result.zakPayload = { error: "ZAK no es un JWT de 3 partes", raw_length: zak.length };
          }
          result.zakLength = zak.length;
        } catch (e) {
          result.zakError = e instanceof Error ? e.message : String(e);
        }

        // 3: host_id actual del meeting
        try {
          const meeting = await zoomApi<{
            id: number; host_id?: string; host_email?: string; status?: string; type?: number;
          }>("/meetings/83675859914");
          result.meeting = {
            id: meeting.id,
            host_id: meeting.host_id ?? null,
            host_id_matches: meeting.host_id === "qeDMt4CqRTiU22MGCd0MIQ",
            host_email: meeting.host_email ?? null,
            status: meeting.status ?? null,
            type: meeting.type ?? null,
          };
        } catch (e) {
          result.meetingError = e instanceof Error ? e.message : String(e);
        }

        // 4: datos del usuario seminario.orpe@gmail.com
        try {
          const user = await zoomApi<{
            status?: string; type?: number; verified?: number; role_name?: string;
            email?: string; id?: string;
          }>("/users/seminario.orpe@gmail.com");
          result.user = {
            id: user.id ?? null,
            email: user.email ?? null,
            status: user.status ?? null,
            type: user.type ?? null, // 1=basic, 2=licensed
            verified: user.verified ?? null,
            role_name: user.role_name ?? null,
          };
        } catch (e) {
          result.userError = e instanceof Error ? e.message : String(e);
        }

        return Response.json(result, { status: 200 });
      },
    },
  },
});
