import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Devuelve una URL temporal (firmada, 4h) para reproducir la grabación de una
 * clase dentro de la app. El archivo se sirve a través de /api/public/recording/*,
 * que hace de proxy autenticado contra Zoom.
 */
export const getRecordingPlaybackUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ meetingRowId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signRecordingToken } = await import("./recordings.server");

    const { data: meeting } = await supabaseAdmin
      .from("zoom_meetings")
      .select("id, programa_id, cohort_id, zoom_meeting_id, status, recording_url")
      .eq("id", data.meetingRowId)
      .maybeSingle();
    if (!meeting) throw new Error("Clase no encontrada.");

    const userId = context.userId;
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roleList = (roles ?? []).map((r) => r.role as string);

    let allowed = roleList.includes("admin");

    if (!allowed && roleList.includes("docente")) {
      const { data: teacher } = await supabaseAdmin
        .from("teachers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (teacher) {
        const { data: prog } = await supabaseAdmin
          .from("programs")
          .select("docente_id")
          .eq("id", meeting.programa_id)
          .maybeSingle();
        if (prog?.docente_id === teacher.id) allowed = true;
        if (!allowed && meeting.cohort_id) {
          const { data: cohort } = await supabaseAdmin
            .from("program_cohorts")
            .select("docente_id")
            .eq("id", meeting.cohort_id)
            .maybeSingle();
          if (cohort?.docente_id === teacher.id) allowed = true;
        }
      }
    }

    if (!allowed) {
      const { data: enr } = await supabaseAdmin
        .from("enrollments")
        .select("id")
        .eq("user_id", userId)
        .eq("programa_id", meeting.programa_id)
        .limit(1);
      allowed = (enr ?? []).length > 0;
    }

    if (!allowed) throw new Error("No tienes acceso a esta grabación.");

    const exp = Date.now() + 4 * 60 * 60 * 1000;
    const sig = signRecordingToken(meeting.id, exp);
    return {
      url: `/api/public/recording/${meeting.id}?exp=${exp}&sig=${sig}`,
      available: Boolean(meeting.recording_url) || meeting.status === "recorded",
    };
  });
