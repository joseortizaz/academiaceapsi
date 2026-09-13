import { createFileRoute } from "@tanstack/react-router";

const REDIRECT_URI = "https://academiaceapsi.com/api/public/zoom-oauth-callback";

function htmlPage(title: string, body: string, ok: boolean): Response {
  const color = ok ? "#166534" : "#991b1b";
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${title}</title></head>` +
      `<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">` +
      `<div style="max-width:520px;padding:2rem;border:1px solid #e5e7eb;border-radius:12px;">` +
      `<h1 style="color:${color};font-size:1.25rem;margin:0 0 .75rem;">${title}</h1>` +
      `<p style="margin:0;color:#374151;white-space:pre-wrap;">${body}</p></div></body></html>`,
    { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/zoom-oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        if (!code) {
          return htmlPage("Error de autorización", "Falta el parámetro 'code' en la URL.", false);
        }

        const clientId = process.env.ZOOM_SDK_KEY;
        const clientSecret = process.env.ZOOM_SDK_SECRET;
        if (!clientId || !clientSecret) {
          return htmlPage("Error de configuración", "Faltan ZOOM_SDK_KEY / ZOOM_SDK_SECRET.", false);
        }

        const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
        const tokenRes = await fetch(
          `https://zoom.us/oauth/token?grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${basic}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
          },
        );
        const tokenText = await tokenRes.text();
        let tokenJson: any = null;
        try {
          tokenJson = JSON.parse(tokenText);
        } catch {}
        if (!tokenRes.ok || !tokenJson?.access_token) {
          return htmlPage(
            "Error al intercambiar el código",
            `Zoom respondió [${tokenRes.status}]: ${tokenText}`,
            false,
          );
        }

        const expiresAt = new Date(Date.now() + Number(tokenJson.expires_in ?? 3600) * 1000).toISOString();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await (supabaseAdmin as any).from("zoom_oauth_tokens").upsert({
          id: "sdk_app",
          access_token: tokenJson.access_token,
          refresh_token: tokenJson.refresh_token ?? null,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        });
        if (error) {
          return htmlPage("Error al guardar el token", error.message, false);
        }

        return htmlPage("Autorización completada", "Puede cerrar esta pestaña.", true);
      },
    },
  },
});
