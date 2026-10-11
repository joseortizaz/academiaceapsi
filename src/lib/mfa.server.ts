import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Verificación en dos pasos en el servidor.
 *
 * El rol de administrador solo vale cuando la sesión que hace la petición es
 * aal2 (contraseña + código del autenticador). La base de datos aplica la
 * misma regla en `has_role`; esto cubre el código que lee `user_roles` con
 * service role.
 */

const cache = new WeakMap<Request, Promise<{ sub?: string; aal?: string } | null>>();

async function leerClaims(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const client = createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return data.claims as { sub?: string; aal?: string };
}

/** ¿La petición actual viene de una sesión aal2 de este usuario? */
export async function sesionConDosPasos(userId: string): Promise<boolean> {
  let request: Request | undefined;
  try {
    request = getRequest();
  } catch {
    return false;
  }
  if (!request) return false;
  let promesa = cache.get(request);
  if (!promesa) {
    promesa = leerClaims(request).catch(() => null);
    cache.set(request, promesa);
  }
  const claims = await promesa;
  return !!claims && claims.sub === userId && claims.aal === "aal2";
}

/** Quita "admin" de la lista si la sesión no completó la verificación en dos pasos. */
export async function rolesEfectivos(userId: string, roles: string[]): Promise<string[]> {
  if (!roles.includes("admin")) return roles;
  if (await sesionConDosPasos(userId)) return roles;
  return roles.filter((r) => r !== "admin");
}
