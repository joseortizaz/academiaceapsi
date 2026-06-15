import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { signMeetingSdkJwt, zoomApi } from "./zoom.server";

async function getUserRoles(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return (data ?? []).map((r) => r.role as string);
}

async function assertAdminOrDocente(userId: string) {
  const roles = await getUserRoles(userId);
  if (!roles.includes("admin") && !roles.includes("docente")) {
    throw new Error("No autorizado: se requiere rol admin o docente.");
  }
}

async function assertCanManageProgram(userId: string, programaId: string) {
  const roles = await getUserRoles(userId);
  if (roles.includes("admin")) return;
  if (!roles.includes("docente")) {
    throw new Error("No autorizado: se requiere rol admin o docente.");
  }
  const { data: teacher } = await supabaseAdmin
    .from("teachers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!teacher) throw new Error("No se encontró tu perfil de docente.");
  const { data: prog } = await supabaseAdmin
    .from("programs")
    .select("docente_id")
    .eq("id", programaId)
    .maybeSingle();
  if (!prog || prog.docente_id !== teacher.id) {
    throw new Error("No tienes permiso para gestionar reuniones de este programa.");
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
      titulo: z.string().min(3).max(200),
      startAt: z.string().datetime(),
      durationMin: z.number().int().min(15).max(480),
      autoRecord: z.boolean().default(true),
      docenteNombre: z.string().max(200).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertCanManageProgram(context.userId, data.programaId);

    const meeting = await zoomApi<{
      id: number;
      join_url: string;
      start_url: string;
      password?: string;
    }>("/users/me/meetings", {
      method: "POST",
      body: JSON.stringify({
        topic: data.titulo,
        type: 2, // scheduled
        start_time: data.startAt,
        duration: data.durationMin,
        timezone: "America/Santo_Domingo",
        settings: {
          host_video: true,
          participant_video: false,
          join_before_host: false,
          mute_upon_entry: true,
          waiting_room: true,
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
      })
      .select("*")
      .single();
    if (error) throw new Error(`No se pudo guardar la reunión: ${error.message}`);
    return row;
  });

export const deleteZoomMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("zoom_meetings")
      .select("zoom_meeting_id, programa_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Reunión no encontrada.");
    await assertCanManageProgram(context.userId, row.programa_id);
    if (row?.zoom_meeting_id) {
      try {
        await zoomApi(`/meetings/${row.zoom_meeting_id}`, { method: "DELETE" });
      } catch (e) {
        console.warn("Zoom DELETE falló:", e);
      }
    }
    await supabaseAdmin.from("zoom_meetings").delete().eq("id", data.id);
    return { success: true };
  });

export const listZoomMeetings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ programaId: z.string().uuid().optional() }).parse,
  )
  .handler(async ({ data, context }) => {
    // Authorization: admin ve todo; docente solo sus programas; resto: denegado.
    const roles = await getUserRoles(context.userId);
    const isAdmin = roles.includes("admin");
    const isDocente = roles.includes("docente");
    if (!isAdmin && !isDocente) {
      throw new Error("No autorizado.");
    }

    let q = supabaseAdmin
      .from("zoom_meetings")
      .select("*")
      .order("start_at", { ascending: false });
    if (data.programaId) q = q.eq("programa_id", data.programaId);

    if (!isAdmin) {
      // Docente: limitar a programas de los que es titular.
      const { data: teacher } = await supabaseAdmin
        .from("teachers")
        .select("id")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!teacher) return [];
      const { data: progs } = await supabaseAdmin
        .from("programs")
        .select("id")
        .eq("docente_id", teacher.id);
      const ids = (progs ?? []).map((p) => p.id);
      if (ids.length === 0) return [];
      q = q.in("programa_id", ids);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Devuelve la firma del Meeting SDK validando rol/inscripción del usuario. */
export const getMeetingSdkSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ meetingRowId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { data: meeting } = await supabaseAdmin
      .from("zoom_meetings")
      .select("id, programa_id, zoom_meeting_id, zoom_password, zoom_join_url, zoom_start_url, titulo")
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
      const { data: prog } = await supabaseAdmin
        .from("programs")
        .select("docente_id")
        .eq("id", meeting.programa_id)
        .maybeSingle();
      role = prog?.docente_id === context.userId ? 1 : 0;
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
      role = 0;
    }

    const { signature, sdkKey } = signMeetingSdkJwt({
      meetingNumber: meeting.zoom_meeting_id,
      role,
    });
    return {
      signature,
      sdkKey,
      meetingNumber: meeting.zoom_meeting_id,
      password: meeting.zoom_password ?? "",
      titulo: meeting.titulo,
      role,
    };
  });
