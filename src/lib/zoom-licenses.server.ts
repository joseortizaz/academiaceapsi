import { supabaseAdmin } from "@/integrations/supabase/client.server";

type LicenseRow = {
  id: string;
  email: string;
  teacher_id: string | null;
  created_at: string;
};

const NO_LICENSE_ERROR =
  "No hay licencias de Zoom disponibles para asignar. Contacta al administrador para liberar o agregar una licencia.";

/**
 * Devuelve la licencia (aula virtual de Zoom) del docente. La asignación es
 * permanente: la primera vez que un docente programa una clase se le reserva
 * la primera licencia libre y esa queda fija para siempre.
 *
 * Si `teacherId` es null (admin creando una reunión de un programa sin docente),
 * se usa la licencia más antigua como fallback SIN persistir asignación.
 */
export async function getOrAssignZoomLicense(
  teacherId: string | null,
): Promise<{ email: string }> {
  const table = supabaseAdmin.from("zoom_licenses" as never) as any;

  if (!teacherId) {
    const { data } = await table
      .select("id, email, teacher_id, created_at")
      .eq("active", true)
      .order("created_at", { ascending: true })
      .limit(1);
    const fallback = (data ?? [])[0] as LicenseRow | undefined;
    if (!fallback) throw new Error(NO_LICENSE_ERROR);
    return { email: fallback.email };
  }

  const { data: mine } = await table
    .select("id, email, teacher_id, created_at")
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (mine) return { email: (mine as LicenseRow).email };

  const { data: free } = await table
    .select("id, email, teacher_id, created_at")
    .is("teacher_id", null)
    .eq("active", true)
    .order("created_at", { ascending: true });

  for (const lic of ((free ?? []) as LicenseRow[])) {
    const { data: claimed } = await (supabaseAdmin.from("zoom_licenses" as never) as any)
      .update({ teacher_id: teacherId, assigned_at: new Date().toISOString() })
      .eq("id", lic.id)
      .is("teacher_id", null)
      .select("id, email");
    const row = (claimed ?? [])[0] as { email: string } | undefined;
    if (row) return { email: row.email };
  }

  throw new Error(NO_LICENSE_ERROR);
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
