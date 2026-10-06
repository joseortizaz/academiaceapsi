/**
 * Comprobaciones de estado de cuenta para funciones de servidor que usan el
 * cliente admin (que no pasa por RLS). Las tablas de contenido ya tienen una
 * política restrictiva "cuenta activa requerida"; esto cubre lo que se sirve
 * con supabaseAdmin (grabaciones, clases en vivo, biblioteca).
 */

export const SUSPENDED_ACCOUNT_MESSAGE =
  "Tu cuenta está suspendida. Escribe a administración para más información.";

/** Estados de inscripción que dan acceso al contenido de un programa. */
export const ENROLLMENT_ACCESS_STATES = ["activo", "completado"] as const;

export async function isAccountActive(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // La función se agregó en la migración 0011; types.ts aún no la incluye.
  const { data, error } = await (supabaseAdmin as any).rpc("account_is_active", { _user_id: userId });
  if (error) {
    // Si la función aún no existe (migración sin aplicar), caer a leer el perfil.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_active")
      .eq("id", userId)
      .maybeSingle();
    return (profile as any)?.is_active !== false;
  }
  return data !== false;
}

export async function assertAccountActive(userId: string): Promise<void> {
  if (!(await isAccountActive(userId))) throw new Error(SUSPENDED_ACCOUNT_MESSAGE);
}

export const RESTRICTED_CONTENT_MESSAGE =
  "Su acceso a los contenidos ha sido restringido por incumplimiento en el pago. Comuníquese con la dirección para regularizar su situación.";

/**
 * Acceso al contenido de los programas: cuenta activa y sin restricción por mora
 * (función SQL content_access_allowed, migración 0012). Para lo que se sirve con
 * el cliente admin: grabaciones y clases en vivo.
 */
export async function assertContentAccess(userId: string): Promise<void> {
  await assertAccountActive(userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).rpc("content_access_allowed", { _user_id: userId });
  if (error) return; // función aún no aplicada: se mantiene el control de cuenta activa
  if (data === false) throw new Error(RESTRICTED_CONTENT_MESSAGE);
}
