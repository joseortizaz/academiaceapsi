import { supabase } from "@/integrations/supabase/client";

/**
 * Verificación en dos pasos (TOTP nativo de Supabase Auth) — utilidades del navegador.
 * Obligatoria para administradores, opcional para docentes y alumnos.
 */

export const MFA_ISSUER = "Academia Ceapsi";

export type FactorTotp = {
  id: string;
  friendly_name?: string | null;
  created_at: string;
  status: string;
};

/** Autenticadores TOTP ya verificados de la sesión actual. */
export async function factoresVerificados(): Promise<FactorTotp[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return ((data?.totp ?? []) as FactorTotp[]).filter((f) => f.status === "verified");
}

/** Borra registros a medio hacer (se escaneó el QR pero nunca se confirmó el código). */
export async function limpiarFactoresPendientes(): Promise<void> {
  const { data } = await supabase.auth.mfa.listFactors();
  const pendientes = (data?.all ?? []).filter((f) => f.status !== "verified");
  for (const f of pendientes) {
    await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
}

export async function nivelDeSesion() {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    actual: data?.currentLevel ?? null,
    siguiente: data?.nextLevel ?? null,
  };
}

/** Error de Supabase Auth en lenguaje para el usuario. */
export function mensajeErrorMfa(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  if (/invalid.*(totp|code)|code.*invalid|expired/i.test(msg)) {
    return "El código no es correcto o ya venció. Escribe el código que aparece ahora en tu app.";
  }
  if (/friendly name/i.test(msg)) {
    return "Ya tienes un dispositivo con ese nombre. Usa otro nombre.";
  }
  if (/disabled/i.test(msg)) {
    return "La verificación en dos pasos no está habilitada en el servidor. Avisa a administración.";
  }
  if (/aal2/i.test(msg)) {
    return "Por seguridad, vuelve a confirmar tu código antes de hacer este cambio.";
  }
  if (/rate|too many/i.test(msg)) {
    return "Demasiados intentos. Espera un minuto y vuelve a intentarlo.";
  }
  return msg || "No se pudo completar la verificación";
}

/** Solo rutas internas, sin volver a las pantallas de verificación. */
export function destinoSeguro(redirect?: string): string | undefined {
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) return undefined;
  if (/^\/(verificar-2fa|configurar-2fa)/.test(redirect)) return undefined;
  return redirect;
}

export async function destinoPorRol(userId: string): Promise<string> {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const list = (roles ?? []).map((r) => r.role as string);
  if (list.includes("admin")) return "/admin";
  if (list.includes("docente")) return "/docente";
  return "/estudiante";
}
