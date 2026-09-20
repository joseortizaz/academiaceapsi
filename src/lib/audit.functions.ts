import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Completa IP y dispositivo del último inicio de sesión del usuario. */
export const recordLoginContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { getRequestContext } = await import("@/lib/audit.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { ip, userAgent } = getRequestContext();
      await (supabaseAdmin.rpc as any)("audit_attach_context", {
        _user_id: context.userId,
        _ip: ip,
        _ua: userAgent,
      });
    } catch (e) {
      console.error("recordLoginContext falló:", e);
    }
    return { ok: true };
  });

/** Registra la exportación del registro de auditoría (solo administradores). */
export const logAuditExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { filas: number; filtros: Record<string, unknown> }) => ({
    filas: Number(input?.filas) || 0,
    filtros: (input?.filtros ?? {}) as Record<string, unknown>,
  }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      actorId: context.userId,
      categoria: "admin",
      accion: "exportar_auditoria",
      entidad: "audit_log",
      detalle: { filas: data.filas, filtros: data.filtros },
      sensible: false,
    });
    return { ok: true };
  });
