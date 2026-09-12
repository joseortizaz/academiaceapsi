import { createFileRoute } from "@tanstack/react-router";
import { zoomApi, signMeetingSdkJwt } from "@/lib/zoom.server";

export const Route = createFileRoute("/api/public/tmp-diag-zoom")({
  server: {
    handlers: {
      GET: async () => {
        const sdkKeyEnv = process.env.ZOOM_SDK_KEY ?? null;
        const secret = process.env.ZOOM_SDK_SECRET ?? null;

        let accountIdFromS2S: unknown = null;
        try {
          const me = await zoomApi<{ account_id: string; email: string }>("/users/me");
          accountIdFromS2S = { account_id: me.account_id, email: me.email };
        } catch (e) {
          accountIdFromS2S = { error: e instanceof Error ? e.message : String(e) };
        }

        let meetingInfo: unknown = null;
        try {
          meetingInfo = await zoomApi("/meetings/83675859914");
        } catch (e) {
          meetingInfo = { error: e instanceof Error ? e.message : String(e) };
        }

        let testJwt: unknown = null;
        try {
          testJwt = signMeetingSdkJwt({ meetingNumber: "83675859914", role: 1 });
        } catch (e) {
          testJwt = { error: e instanceof Error ? e.message : String(e) };
        }

        return Response.json({
          sdkKeyEnv,
          sdkSecretLength: secret ? secret.length : null,
          sdkSecretFirstLast: secret ? `${secret.slice(0, 4)}...${secret.slice(-4)}` : null,
          accountIdFromS2S,
          meetingInfo,
          testJwt,
        });
      },
    },
  },
});
