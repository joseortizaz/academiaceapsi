import crypto from "node:crypto";

/** Secreto para firmar los enlaces temporales de reproducción (server-only). */
function signingSecret(): string {
  const s =
    process.env.ZOOM_CLIENT_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "";
  if (!s) throw new Error("Falta el secreto para firmar enlaces de grabación.");
  return s;
}

export function signRecordingToken(meetingRowId: string, expiresAtMs: number): string {
  return crypto
    .createHmac("sha256", signingSecret())
    .update(`${meetingRowId}.${expiresAtMs}`)
    .digest("hex");
}

export function verifyRecordingToken(
  meetingRowId: string,
  expiresAtMs: number,
  sig: string,
): boolean {
  if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) return false;
  const expected = signRecordingToken(meetingRowId, expiresAtMs);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
