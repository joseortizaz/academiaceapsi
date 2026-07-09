import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return withSecurityHeaders(
    new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
  );
}

// Cabeceras de seguridad requeridas por el escáner de Zoom Marketplace (OWASP).
// El CSP permite explícitamente los orígenes que el Meeting SDK carga vía CDN
// (source.zoom.us) además de Supabase (backend) y recursos self.
const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    // 'unsafe-inline'/'unsafe-eval' son necesarios para el SDK de Zoom y algunos runtimes de React.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://source.zoom.us https://zoom.us https://*.zoom.us",
    "script-src-elem 'self' 'unsafe-inline' https://source.zoom.us https://zoom.us https://*.zoom.us",
    "style-src 'self' 'unsafe-inline' https://source.zoom.us https://zoom.us https://*.zoom.us https://fonts.googleapis.com",
    "style-src-elem 'self' 'unsafe-inline' https://source.zoom.us https://zoom.us https://*.zoom.us https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com https://source.zoom.us https://*.zoom.us",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https: https://*.zoom.us",
    "connect-src 'self' data: blob: https: wss: https://*.zoom.us wss://*.zoom.us https://source.zoom.us https://zoom.us",
    "frame-src 'self' https://zoom.us https://*.zoom.us",
    "worker-src 'self' blob:",
    "child-src 'self' blob: https://*.zoom.us",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests",
  ].join("; "),
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self \"https://*.zoom.us\"), microphone=(self \"https://*.zoom.us\"), display-capture=(self \"https://*.zoom.us\"), fullscreen=(self)",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
};

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
