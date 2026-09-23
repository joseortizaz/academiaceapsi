import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getZakToken, signMeetingSdkJwt, zoomApi } from "./zoom.server";
import {
  assertCanManageProgramResource,
  getTeacherGlobalScope,
  getTeacherScopeForProgram,
  getUserRoles,
} from "./teacher-access.server";
import {
  getOrAssignZoomLicense,
  resolveResponsibleTeacherId,
} from "./zoom-licenses.server";


/** Convierte un instante UTC a un string de hora local "ingenua" (sin Z/offset)
 * en horario de Rep. Dominicana (UTC-4 fijo, sin horario de verano), para
 * mandarlo a la API de Zoom junto con timezone: "America/Santo_Domingo".
 * Zoom interpreta start_time como ya-local-a-esa-zona, así que si le mandamos
 * un string con "Z" (UTC) aplica el offset DOS veces. */
function toSantoDomingoNaiveLocal(isoUtc: string): string {
  const utcDate = new Date(isoUtc);
  const localMs = utcDate.getTime() - 4 * 60 * 60 * 1000; // UTC-4 fijo
  return new Date(localMs).toISOString().slice(0, 19);
}


async function assertAdminOrDocente(userId: string) {
  const roles = await getUserRoles(userId);
  if (!roles.includes("admin") && !roles.includes("docente")) {
    throw new Error("No autorizado: se requiere rol admin o docente.");
  }
}


/** Diagnóstico simple: pide /users/me con el token S2S. */
export const getZoomConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrDocente(context.userId);
    try {
      const me = await zoomApi<{ id: string; email: string; account_id: string; display_name?: string }>(
        "/users/me",
      );
      return {
        connected: true,
        email: me.email,
        accountId: me.account_id,
        displayName: me.display_name ?? null,
      };
    } catch (e) {
      return { connected: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

export const createZoomMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      programaId: z.string().uuid(),
      moduloId: z.string().uuid().optional().nullable(),
      cohortId: z.string().uuid().optional().nullable(),
      titulo: z.string().min(3).max(200),
      startAt: z.string().datetime(),
      durationMin: z.number().int().min(15).max(480),
      autoRecord: z.boolean().default(true),
      docenteNombre: z.string().max(200).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    // Validar primero que el cohort pertenezca al programa, para que la
    // verificación de permisos por cohorte no pueda ser burlada.
    if (data.cohortId) {
      const { data: cohort } = await supabaseAdmin
        .from("program_cohorts")
        .select("id, programa_id")
        .eq("id", data.cohortId)
        .maybeSingle();
      if (!cohort || cohort.programa_id !== data.programaId) {
        throw new Error("El grupo seleccionado no pertenece a este programa.");
      }
    }

    const scope = await assertCanManageProgramResource(context.userId, {
      programaId: data.programaId,
      cohortId: data.cohortId ?? null,
      moduloId: data.moduloId ?? null,
    });

    // Docente responsable de la reunión: él mismo si es docente con scope
    // válido; si es admin, el docente dueño según cohorte → módulo → programa.
    const responsibleTeacherId = scope.teacherId
      ? scope.teacherId
      : await resolveResponsibleTeacherId({
          programaId: data.programaId,
          cohortId: data.cohortId ?? null,
          moduloId: data.moduloId ?? null,
        });

    // Las licencias son un recurso compartido por franja horaria.
    const { email: hostEmail } = await getOrAssignZoomLicense(
      responsibleTeacherId,
      data.startAt,
      data.durationMin,
    );

    const meeting = await zoomApi<{

      id: number;
      join_url: string;
      start_url: string;
      password?: string;
    }>(`/users/${encodeURIComponent(hostEmail)}/meetings`, {

      method: "POST",
      body: JSON.stringify({
        topic: data.titulo,
        type: 2, // scheduled
        start_time: toSantoDomingoNaiveLocal(data.startAt),
        duration: data.durationMin,
        timezone: "America/Santo_Domingo",
        settings: {
          host_video: true,
          participant_video: false,
          join_before_host: true,
          mute_upon_entry: true,
          waiting_room: false,
          auto_recording: data.autoRecord ? "cloud" : "none",
          approval_type: 2,
        },
      }),
    });

    const { data: row, error } = await supabaseAdmin
      .from("zoom_meetings")
      .insert({
        programa_id: data.programaId,
        modulo_id: data.moduloId ?? null,
        cohort_id: data.cohortId ?? null,
        titulo: data.titulo,
        docente_nombre: data.docenteNombre ?? null,
        zoom_meeting_id: String(meeting.id),
        zoom_join_url: meeting.join_url,
        zoom_start_url: meeting.start_url,
        zoom_password: meeting.password ?? null,
        start_at: data.startAt,
        duration_min: data.durationMin,
        status: "scheduled",
        auto_record: data.autoRecord,
        created_by: context.userId,
        zoom_host_email: hostEmail,

      })
      .select("*")
      .single();
    if (error) throw new Error(`No se pudo guardar la reunión: ${error.message}`);

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      actorId: context.userId,
      accion: "crear_clase_vivo",
      entidad: "zoom_meetings",
      entidadId: row.id,
      entidadEtiqueta: data.titulo,
      programaId: data.programaId,
      detalle: {
        inicio: data.startAt,
        duracionMin: data.durationMin,
        cohortId: data.cohortId ?? null,
        licencia: hostEmail,
      },
    });
    await logAudit({
      actorId: context.userId,
      accion: "asignar_licencia_zoom",
      entidad: "zoom_licenses",
      entidadEtiqueta: hostEmail,
      programaId: data.programaId,
      detalle: { docenteId: responsibleTeacherId, claseId: row.id },
    });

    return row;
  });

export const deleteZoomMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("zoom_meetings")
      .select("zoom_meeting_id, titulo, programa_id, cohort_id, modulo_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Reunión no encontrada.");
    await assertCanManageProgramResource(context.userId, {
      programaId: row.programa_id,
      cohortId: row.cohort_id ?? null,
      moduloId: row.modulo_id ?? null,
    });

    if (row?.zoom_meeting_id) {
      try {
        await zoomApi(`/meetings/${row.zoom_meeting_id}`, { method: "DELETE" });
      } catch (e) {
        console.warn("Zoom DELETE falló:", e);
      }
    }
    await supabaseAdmin.from("zoom_meetings").delete().eq("id", data.id);

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      actorId: context.userId,
      accion: "cancelar_clase_vivo",
      entidad: "zoom_meetings",
      entidadId: data.id,
      entidadEtiqueta: (row as any).titulo ?? null,
      programaId: row.programa_id,
      sensible: true,
    });

    return { success: true };
  });

export const listZoomMeetings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ programaId: z.string().uuid().optional() }).parse,
  )
  .handler(async ({ data, context }) => {
    // Authorization: admin ve todo; docente sus programas (por titularidad,
    // cohorte o módulo); resto: denegado.
    const scope = await getTeacherGlobalScope(context.userId);
    if (!scope.isAdmin && !scope.isDocente) {
      throw new Error("No autorizado.");
    }

    let q = supabaseAdmin
      .from("zoom_meetings")
      .select("*, cohort:program_cohorts(nombre)")
      .order("start_at", { ascending: false });

    if (data.programaId) q = q.eq("programa_id", data.programaId);

    const owned = new Set(scope.ownedProgramIds);
    if (!scope.isAdmin) {
      if (!scope.teacherId) return [];
      const ids = Array.from(
        new Set([
          ...scope.ownedProgramIds,
          ...Object.keys(scope.cohortIdsByProgram),
          ...Object.keys(scope.moduleIdsByProgram),
        ]),
      );
      if (ids.length === 0) return [];
      q = q.in("programa_id", ids);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    if (scope.isAdmin) return rows ?? [];

    // Docente no titular: solo reuniones de SUS cohortes/módulos o creadas por él.
    return (rows ?? []).filter((m: any) => {
      if (owned.has(m.programa_id)) return true;
      if (m.created_by === context.userId) return true;
      const myCohorts = scope.cohortIdsByProgram[m.programa_id] ?? [];
      const myModules = scope.moduleIdsByProgram[m.programa_id] ?? [];
      if (m.cohort_id && myCohorts.includes(m.cohort_id)) return true;
      if (m.modulo_id && myModules.includes(m.modulo_id)) return true;
      return false;
    });
  });


/** Devuelve la firma del Meeting SDK validando rol/inscripción del usuario. */
export const getMeetingSdkSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ meetingRowId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { data: meeting } = await supabaseAdmin
      .from("zoom_meetings")
      .select("id, programa_id, cohort_id, modulo_id, created_by, zoom_meeting_id, zoom_password, zoom_join_url, zoom_start_url, zoom_host_email, titulo")
      .eq("id", data.meetingRowId)
      .maybeSingle();
    if (!meeting) throw new Error("Reunión no encontrada.");

    const roles = await getUserRoles(context.userId);
    const isAdmin = roles.includes("admin");
    const isDocente = roles.includes("docente");

    let role: 0 | 1 = 0;

    if (isAdmin) {
      role = 1;
    } else if (isDocente) {
      const scope = await getTeacherScopeForProgram(context.userId, meeting.programa_id);
      const isHost =
        scope.isOwner ||
        meeting.created_by === context.userId ||
        (!!meeting.cohort_id && scope.cohortIds.includes(meeting.cohort_id)) ||
        (!!meeting.modulo_id && scope.moduleIds.includes(meeting.modulo_id));
      role = isHost ? 1 : 0;
    } else {

      const { data: enr } = await supabaseAdmin
        .from("enrollments")
        .select("estado")
        .eq("user_id", context.userId)
        .eq("programa_id", meeting.programa_id)
        .maybeSingle();
      if (!enr || !["activo", "completado"].includes(enr.estado)) {
        throw new Error("No tienes acceso a esta clase.");
      }
      // Si la reunión está restringida a un cohort, exigir pertenencia activa.
      if (meeting.cohort_id) {
        const { data: ce } = await supabaseAdmin
          .from("cohort_enrollments")
          .select("estado")
          .eq("cohort_id", meeting.cohort_id)
          .eq("user_id", context.userId)
          .maybeSingle();
        if (!ce || ce.estado !== "activo") {
          throw new Error("Esta clase es exclusiva de otro grupo.");
        }
      }
      role = 0;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("nombre, apellido")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = authUser?.user?.email ?? "";
    const userName =
      [profile?.nombre, profile?.apellido].filter(Boolean).join(" ").trim() ||
      email ||
      "Participante";

    const { signature, sdkKey } = signMeetingSdkJwt({
      meetingNumber: meeting.zoom_meeting_id,
      role,
    });

    // Desde el 2 de marzo de 2026, Zoom exige que un usuario "no logueado" (nuestro
    // caso: el Meeting SDK JWT no pasa por el login de Zoom) que actúa como ANFITRIÓN
    // de una reunión programada se autentique además con un token ZAK. Sin esto, el
    // SDK devuelve JOIN_MEETING_FAILED / errorCode 200 aunque la firma sea válida.
    // Los asistentes (role 0) sí pueden unirse de forma anónima sin ZAK.
    let zak: string | undefined;
    if (role === 1) {
      try {
        zak = await getZakToken((meeting as any).zoom_host_email || "me");
      } catch (e) {
        console.warn("No se pudo obtener ZAK token para el host:", e);
      }
    }

    {
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit({
        actorId: context.userId,
        categoria: "actividad",
        accion: "entrar_clase_vivo",
        entidad: "zoom_meetings",
        entidadId: meeting.id,
        entidadEtiqueta: meeting.titulo,
        programaId: meeting.programa_id,
        dedupeMinutes: 10,
      });
    }

    return {
      signature,
      sdkKey,
      meetingNumber: meeting.zoom_meeting_id,
      password: meeting.zoom_password ?? "",
      titulo: meeting.titulo,
      role,
      userName,
      userEmail: email,
      joinUrl: meeting.zoom_join_url ?? "",
      zak: zak ?? "",
      // startUrl es la URL de host: solo la devolvemos a admin/docente (role === 1),
      // nunca a estudiantes, para evitar que puedan iniciar la reunión como anfitrión.
      startUrl: role === 1 ? (meeting.zoom_start_url ?? "") : "",
    };
  });
