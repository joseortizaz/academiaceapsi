import { supabaseAdmin } from "@/integrations/supabase/client.server";

type LicenseRow = {
  id: string;
  email: string;
  teacher_id: string | null;
  created_at: string;
  assigned_at: string | null;
};

const NO_LICENSE_ERROR =
  "No hay aulas de Zoom disponibles en ese horario: todas las licencias ya tienen una clase que se cruza con este horario (o el colchón de 10 minutos entre reuniones). Elige otro horario o agrega otra licencia.";

const BUFFER_MS = 10 * 60 * 1000; // 10 minutos de colchón entre reuniones del mismo anfitrión

/**
 * Devuelve el email (aula virtual de Zoom) a usar para una reunión.
 *
 * Las licencias son un recurso COMPARTIDO por franja horaria: una licencia
 * está disponible para una nueva reunión mientras ninguna otra reunión
 * "scheduled"/"live" que la use se cruce con el horario solicitado (+/- un
 * colchón de 10 min). No hay asignación permanente ni exclusiva por docente:
 * cualquier docente puede usar cualquier licencia que esté libre a esa hora.
 *
 * Si el docente ya usó una licencia anteriormente y esta está libre a la
 * hora solicitada, se prefiere esa (continuidad del enlace/sala). Si no,
 * se usa la licencia libre que lleva más tiempo sin usarse, para repartir
 * la carga entre licencias.
 */
export async function getOrAssignZoomLicense(
  teacherId: string | null,
  startAt: string,
  durationMin: number,
): Promise<{ email: string }> {
  const table = supabaseAdmin.from("zoom_licenses" as never) as any;

  const { data: licenses } = await table
    .select("id, email, teacher_id, created_at, assigned_at")
    .eq("active", true);
  const allLicenses = (licenses ?? []) as LicenseRow[];
  if (allLicenses.length === 0) throw new Error(NO_LICENSE_ERROR);

  const start = new Date(startAt).getTime();
  const end = start + durationMin * 60_000;

  // Reuniones aún no finalizadas que puedan cruzarse con el horario pedido.
  const { data: busyMeetings } = await supabaseAdmin
    .from("zoom_meetings")
    .select("zoom_host_email, start_at, duration_min")
    .in("status", ["scheduled", "live"]);

  const busyEmails = new Set(
    (busyMeetings ?? [])
      .filter((m: any) => {
        if (!m.zoom_host_email) return false;
        const mStart = new Date(m.start_at).getTime() - BUFFER_MS;
        const mEnd = mStart + (m.duration_min ?? 0) * 60_000 + BUFFER_MS * 2;
        return mStart < end && mEnd > start; // se cruzan (con colchón)
      })
      .map((m: any) => m.zoom_host_email as string),
  );

  const free = allLicenses.filter((l) => !busyEmails.has(l.email));
  if (free.length === 0) throw new Error(NO_LICENSE_ERROR);

  // Preferir el aula que el docente usó la última vez, si está libre ahora;
  // si no, la de uso menos reciente (balancea la carga entre licencias).
  const preferred = teacherId ? free.find((l) => l.teacher_id === teacherId) : undefined;
  const sorted = [...free].sort((a, b) => {
    const at = a.assigned_at ? new Date(a.assigned_at).getTime() : 0;
    const bt = b.assigned_at ? new Date(b.assigned_at).getTime() : 0;
    return at - bt;
  });
  const chosen = preferred ?? sorted[0];

  if (teacherId) {
    await table
      .update({ teacher_id: teacherId, assigned_at: new Date().toISOString() })
      .eq("id", chosen.id);
  }

  return { email: chosen.email };
}

/**
 * Resuelve el docente responsable de una reunión según la jerarquía
 * cohorte → módulo → programa.
 */
export async function resolveResponsibleTeacherId(opts: {
  programaId: string;
  cohortId?: string | null;
  moduloId?: string | null;
}): Promise<string | null> {
  if (opts.cohortId) {
    const { data } = await supabaseAdmin
      .from("program_cohorts")
      .select("docente_id")
      .eq("id", opts.cohortId)
      .maybeSingle();
    if (data?.docente_id) return data.docente_id;
  }
  if (opts.moduloId) {
    const { data } = await (supabaseAdmin.from("program_modules_catalog" as never) as any)
      .select("docente_id")
      .eq("id", opts.moduloId)
      .maybeSingle();
    if (data?.docente_id) return data.docente_id as string;
    const { data: pm } = await supabaseAdmin
      .from("program_modules")
      .select("docente_id")
      .eq("id", opts.moduloId)
      .maybeSingle();
    if (pm?.docente_id) return pm.docente_id;
  }
  const { data: prog } = await supabaseAdmin
    .from("programs")
    .select("docente_id")
    .eq("id", opts.programaId)
    .maybeSingle();
  return prog?.docente_id ?? null;
}
