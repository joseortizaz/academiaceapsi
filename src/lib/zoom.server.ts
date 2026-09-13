import crypto from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Obtiene (y refresca si es necesario) el access token OAuth de la app
 * Meeting SDK ("General app 423"), el MISMO que firma los JWT del SDK.
 * El ZAK debe provenir de esta app y no del S2S "Academia Ceapsi", o Zoom
 * rechaza el join como "Signature is invalid" (3712).
 */
async function getZoomSdkAppAccessToken(): Promise<string> {
  const clientId = process.env.ZOOM_SDK_KEY;
  const clientSecret = process.env.ZOOM_SDK_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Faltan ZOOM_SDK_KEY / ZOOM_SDK_SECRET.");
  }

  const { data: row, error } = await (supabaseAdmin as any)
    .from("zoom_oauth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("id", "sdk_app")
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer zoom_oauth_tokens: ${error.message}`);
  if (!row) {
    throw new Error(
      "La app Meeting SDK de Zoom no está autorizada por OAuth (falta refresh token). Repite la autorización.",
    );
  }

  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (row.access_token && expiresAt > Date.now() + 30_000) {
    return row.access_token as string;
  }
  if (!row.refresh_token) {
    throw new Error(
      "La app Meeting SDK de Zoom no está autorizada por OAuth (falta refresh token). Repite la autorización.",
    );
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=refresh_token&refresh_token=${encodeURIComponent(row.refresh_token)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}
  if (!res.ok || !json?.access_token) {
    throw new Error(`No se pudo refrescar el token OAuth de la app SDK de Zoom [${res.status}]: ${text}`);
  }

  const newExpiresAt = new Date(Date.now() + Number(json.expires_in ?? 3600) * 1000).toISOString();
  const { error: upErr } = await (supabaseAdmin as any)
    .from("zoom_oauth_tokens")
    .update({
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? row.refresh_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "sdk_app");
  if (upErr) throw new Error(`No se pudo guardar el token refrescado: ${upErr.message}`);

  return json.access_token as string;
}

const ZOOM_API_BASE = "https://api.zoom.us/v2";
const ZOOM_OAUTH_URL = "https://zoom.us/oauth/token";

type CachedToken = { token: string; expiresAt: number };
let cached: CachedToken | null = null;

export async function getZoomAccessToken(): Promise<string> {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Faltan credenciales de Zoom (ZOOM_ACCOUNT_ID/ZOOM_CLIENT_ID/ZOOM_CLIENT_SECRET).");
  }

  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(
    `${ZOOM_OAUTH_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`No se pudo obtener token Zoom [${res.status}]: ${body}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cached.token;
}

export async function zoomApi<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getZoomAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(`${ZOOM_API_BASE}${path}`, { ...init, headers });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`Zoom API ${path} falló [${res.status}]: ${text}`);
  }
  return json as T;
}

/**
 * ZAK (Zoom Access Key) del usuario "me" (el usuario detrás de las credenciales
 * Server-to-Server OAuth, que es quien figura como host de las reuniones creadas
 * vía /users/me/meetings). Desde marzo de 2026 Zoom exige un token ZAK u OBF para
 * que un usuario "no logueado" (nuestro caso: el Meeting SDK JWT no involucra login
 * de Zoom) pueda actuar como ANFITRIÓN de una reunión programada; sin esto, el join
 * como host falla con errorCode 200 "Fail to join the meeting" aunque la firma sea válida.
 * Requiere el scope `user:read:token` en la app Server-to-Server OAuth.
 */
export async function getZakToken(userId = "me"): Promise<string> {
  const data = await zoomApi<{ token: string }>(`/users/${encodeURIComponent(userId)}/token?type=zak`);
  if (!data?.token) throw new Error("Zoom no devolvió un token ZAK para el host.");
  return data.token;
}

/** Firma JWT del Meeting SDK (HS256). role: 0=attendee, 1=host. */
export function signMeetingSdkJwt(params: {
  meetingNumber: string;
  role: 0 | 1;
  expSeconds?: number;
}): { signature: string; sdkKey: string } {
  const sdkKey = process.env.ZOOM_SDK_KEY;
  const sdkSecret = process.env.ZOOM_SDK_SECRET;
  if (!sdkKey || !sdkSecret) {
    throw new Error("Faltan ZOOM_SDK_KEY / ZOOM_SDK_SECRET.");
  }
  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + (params.expSeconds ?? 60 * 60 * 2);

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    appKey: sdkKey,
    sdkKey,
    mn: Number(params.meetingNumber),
    role: params.role,
    iat,
    exp,
    tokenExp: exp,
  };

  const enc = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${enc(header)}.${enc(payload)}`;
  const sig = crypto
    .createHmac("sha256", sdkSecret)
    .update(unsigned)
    .digest("base64url");
  return { signature: `${unsigned}.${sig}`, sdkKey };
}

/** Verifica firma de webhook Zoom (v0=HMAC_SHA256 sobre "v0:" + ts + ":" + body). */
export function verifyZoomWebhookSignature(params: {
  signature: string | null;
  timestamp: string | null;
  rawBody: string;
}): boolean {
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  if (!secret || !params.signature || !params.timestamp) return false;
  const message = `v0:${params.timestamp}:${params.rawBody}`;
  const expected =
    "v0=" + crypto.createHmac("sha256", secret).update(message).digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(params.signature),
      Buffer.from(expected),
    );
  } catch {
    return false;
  }
}

/** Responde al CRC (endpoint URL validation) de Zoom. */
export function buildZoomUrlValidationResponse(plainToken: string): {
  plainToken: string;
  encryptedToken: string;
} {
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN ?? "";
  const encryptedToken = crypto
    .createHmac("sha256", secret)
    .update(plainToken)
    .digest("hex");
  return { plainToken, encryptedToken };
}
