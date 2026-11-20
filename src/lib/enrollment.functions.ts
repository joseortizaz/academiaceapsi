import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Precio efectivo de un programa (el de descuento si existe). */
export function precioEfectivo(p: { precio: number | string | null; precio_descuento: number | string | null }): number {
  return Number(p.precio_descuento ?? p.precio ?? 0);
}

export function esProgramaGratis(p: { precio: number | string | null; precio_descuento: number | string | null }): boolean {
  return precioEfectivo(p) <= 0;
}

/**
 * Inscripción directa a un programa gratuito: sin formulario y sin aprobación del
 * administrador. La inscripción se crea ya en estado "activo" con los datos de la
 * cuenta (nombre, teléfono, correo).
 *
 * La política de INSERT de enrollments solo permite al estudiante crear filas
 * "pendiente", así que esto se hace en el servidor con el cliente admin, después
 * de comprobar aquí que el programa está publicado y su precio efectivo es 0.
 */
export const inscribirseGratis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ programaId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertAccountActive } = await import("./account-status.server");
    const userId = context.userId;

    await assertAccountActive(userId);

    const { data: programa } = await supabaseAdmin
      .from("programs")
      .select("id, slug, estado, precio, precio_descuento, max_estudiantes")
      .eq("id", data.programaId)
      .maybeSingle();
    if (!programa || programa.estado !== "publicado") {
      throw new Error("Este programa no está disponible para inscripción.");
    }
    if (!esProgramaGratis(programa)) {
      throw new Error("Este programa no es gratuito. Envía la solicitud de inscripción.");
    }

    const { data: existente } = await supabaseAdmin
      .from("enrollments")
      .select("id, estado, fecha_inscripcion, nombre_completo, documento_identidad, email_contacto, telefono_contacto, area_profesional")
      .eq("user_id", userId)
      .eq("programa_id", programa.id)
      .maybeSingle();

    if (existente && ["activo", "completado"].includes(existente.estado)) {
      return { ok: true as const, slug: programa.slug, estado: existente.estado };
    }
    if (existente && existente.estado !== "pendiente") {
      // cancelado / suspendido: lo decide la administración.
      throw new Error("Tu inscripción en este programa no está activa. Escribe a administración.");
    }

    // Cupo: solo cuentan las inscripciones con acceso.
    if (programa.max_estudiantes) {
      const { count } = await supabaseAdmin
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("programa_id", programa.id)
        .in("estado", ["activo", "completado"]);
      if ((count ?? 0) >= programa.max_estudiantes) {
        throw new Error("Lo sentimos, el cupo de este programa está completo.");
      }
    }

    const [{ data: perfil }, { data: authUser }] = await Promise.all([
      supabaseAdmin.from("profiles").select("nombre, apellido, telefono").eq("id", userId).maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(userId),
    ]);
    const nombrePerfil = [perfil?.nombre, perfil?.apellido].filter(Boolean).join(" ").trim();

    const fila = {
      user_id: userId,
      programa_id: programa.id,
      estado: "activo",
      nombre_completo: existente?.nombre_completo || nombrePerfil || null,
      documento_identidad: existente?.documento_identidad ?? null,
      email_contacto: existente?.email_contacto || authUser?.user?.email || null,
      telefono_contacto: existente?.telefono_contacto || perfil?.telefono || null,
      area_profesional: existente?.area_profesional ?? null,
      notas: "Inscripción automática (programa gratuito)",
      ...(existente ? { fecha_inscripcion: existente.fecha_inscripcion } : {}),
    };

    if (existente) {
      // Solicitud "pendiente" previa a este cambio. El trigger
      // prevent_enrollment_privileged_updates bloquea cambiar el estado fuera de
      // un admin, así que se reemplaza la fila conservando sus datos.
      const { error: delErr } = await supabaseAdmin.from("enrollments").delete().eq("id", existente.id);
      if (delErr) {
        console.error("inscribirseGratis: no se pudo reemplazar la solicitud pendiente", delErr);
        throw new Error("No se pudo activar tu inscripción. Escribe a administración.");
      }
    }

    const { error: insErr } = await supabaseAdmin.from("enrollments").insert(fila);
    if (insErr) {
      // Doble clic / pestañas: si ya existe, tratarlo como éxito.
      if ((insErr as any).code === "23505") {
        return { ok: true as const, slug: programa.slug, estado: "activo" };
      }
      console.error("inscribirseGratis: error al insertar", insErr);
      throw new Error("No se pudo completar la inscripción. Intenta de nuevo.");
    }

    return { ok: true as const, slug: programa.slug, estado: "activo" };
  });
