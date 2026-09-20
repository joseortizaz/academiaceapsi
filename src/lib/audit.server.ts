import { getRequest } from "@tanstack/react-start/server";

export type AuditCategoria = "datos" | "acceso" | "admin" | "actividad";

export type LogAuditInput = {
  actorId?: string | null;
  categoria?: AuditCategoria;
  accion: string;
  entidad?: string | null;
  entidadId?: string | null;
  entidadEtiqueta?: string | null;
  programaId?: string | null;
  sujetoId?: string | null;
  detalle?: Record<string, unknown> | null;
  sensible?: boolean;
  /** Si ya existe una fila del mismo actor+acción+entidad en esta ventana, no inserta. */
  dedupeMinutes?: number;
};

/** IP y dispositivo de la petición actual (nunca lanza). */
export function getRequestContext(): { ip: string | null; userAgent: string | null } {
  try {
    const headers = getRequest().headers;
    const cf = headers.get("cf-connecting-ip");
    const xff = headers.get("x-forwarded-for");
    const xreal = headers.get("x-real-ip");
    const ip =
      (cf && cf.split(",")[0]?.trim()) ||
      (xff && xff.split(",")[0]?.trim()) ||
      (xreal && xreal.trim()) ||
      null;
    const ua = headers.get("user-agent");
    return {
      ip: ip ? ip.slice(0, 64) : null,
      userAgent: ua ? ua.slice(0, 300) : null,
    };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/**
 * Registra una acción en public.audit_log. Nunca lanza: si algo falla,
 * solo deja constancia en la consola del servidor.
 */
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const actorId = input.actorId ?? null;

    if (input.dedupeMinutes && actorId) {
      const desde = new Date(Date.now() - input.dedupeMinutes * 60_000).toISOString();
      const { data: previo } = await (supabaseAdmin.from as any)("audit_log")
        .select("id")
        .eq("actor_id", actorId)
        .eq("accion", input.accion)
        .eq("entidad_id", input.entidadId ?? "")
        .gt("occurred_at", desde)
        .limit(1);
      if (previo && previo.length > 0) return;
    }

    let actorNombre: string | null = null;
    let actorEmail: string | null = null;
    let actorRol = "sistema";

    if (actorId) {
      const [{ data: perfil }, { data: authUser }, { data: roles }] = await Promise.all([
        supabaseAdmin.from("profiles").select("nombre,apellido").eq("id", actorId).maybeSingle(),
        supabaseAdmin.auth.admin.getUserById(actorId),
        supabaseAdmin.from("user_roles").select("role").eq("user_id", actorId),
      ]);
      actorNombre =
        `${perfil?.nombre ?? ""} ${perfil?.apellido ?? ""}`.trim() || null;
      actorEmail = authUser?.user?.email ?? null;
      const lista = (roles ?? []).map((r: { role: string }) => r.role);
      actorRol = lista.includes("admin")
        ? "admin"
        : lista.includes("docente")
          ? "docente"
          : "estudiante";
    }

    const { ip, userAgent } = getRequestContext();

    const { error } = await (supabaseAdmin.from as any)("audit_log").insert({
      actor_id: actorId,
      actor_nombre: actorNombre ?? (actorId ? null : "Sistema"),
      actor_email: actorEmail,
      actor_rol: actorRol,
      categoria: input.categoria ?? "admin",
      accion: input.accion,
      entidad: input.entidad ?? null,
      entidad_id: input.entidadId ?? null,
      entidad_etiqueta: input.entidadEtiqueta ?? null,
      programa_id: input.programaId ?? null,
      sujeto_id: input.sujetoId ?? null,
      detalle: input.detalle ?? null,
      sensible: input.sensible ?? false,
      ip,
      user_agent: userAgent,
    });
    if (error) console.error("logAudit insert falló:", error.message);
  } catch (e) {
    console.error("logAudit falló:", e);
  }
}
