// TEMPORAL — diagnóstico Zoom (eliminar después de usar)
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/tmp-diag-zoom")({
  server: {
    handlers: {
      GET: async () => {
        const clientId = process.env.ZOOM_SDK_KEY!; // Client ID de Production de "General app 423"
        const clientSecret = process.env.ZOOM_SDK_SECRET!;
        const accountId = process.env.ZOOM_ACCOUNT_ID!;
        const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

        const tokenRes = await fetch(
          `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
          { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" } }
        );
        const tokenText = await tokenRes.text();
        let tokenJson: any = null;
        try { tokenJson = JSON.parse(tokenText); } catch {}

        let zakResult: any = null;
        if (tokenJson?.access_token) {
          const zakRes = await fetch("https://api.zoom.us/v2/users/seminario.orpe@gmail.com/token?type=zak", {
            headers: { Authorization: `Bearer ${tokenJson.access_token}` },
          });
          zakResult = { status: zakRes.status, body: await zakRes.text() };
        }

        return Response.json({
          tokenStatus: tokenRes.status,
          tokenOk: !!tokenJson?.access_token,
          tokenError: tokenJson?.error ?? tokenJson?.reason ?? null,
          zakResult,
        });
      },
    },
  },
});
