import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type TeacherProgramScope = { programa_id: string; is_owner: boolean };

/**
 * Programas del docente autenticado considerando TODAS las vías de asignación:
 * programa (dueño), cohorte/grupo, o módulo. Devuelve además el conteo de
 * alumnos correcto: todos los del programa si es dueño, solo los de sus
 * cohortes si únicamente tiene grupos asignados.
 */
export function useTeacherPrograms() {
  const { user } = useAuth();

  const { data: teacher } = useQuery({
    queryKey: ["docente-record", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("teachers")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: scopes = [] } = useQuery<TeacherProgramScope[]>({
    queryKey: ["docente-program-scopes", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("my_teacher_programs");
      if (error) throw error;
      return ((data ?? []) as TeacherProgramScope[]);
    },
  });

  const programaIds = scopes.map((s) => s.programa_id);
  const ownedProgramIds = scopes.filter((s) => s.is_owner).map((s) => s.programa_id);
  const cohortOnlyProgramIds = scopes.filter((s) => !s.is_owner).map((s) => s.programa_id);

  const { data: programas = [] } = useQuery({
    queryKey: ["docente-programas", programaIds],
    enabled: programaIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("programs").select("*").in("id", programaIds);
      return data ?? [];
    },
  });

  // Cohortes del docente (para el conteo de alumnos en programas donde no es dueño)
  const { data: myCohortIds = [] } = useQuery<string[]>({
    queryKey: ["docente-cohort-ids", teacher?.id],
    enabled: !!teacher?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("program_cohorts")
        .select("id")
        .eq("docente_id", teacher!.id);
      return (data ?? []).map((c: { id: string }) => c.id);
    },
  });

  const { data: ownedEnrollments = [] } = useQuery({
    queryKey: ["docente-enrollments-owned", ownedProgramIds],
    enabled: ownedProgramIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("id,programa_id,user_id,estado,progreso_porcentaje")
        .in("programa_id", ownedProgramIds);
      return data ?? [];
    },
  });

  const { data: cohortEnrollments = [] } = useQuery({
    queryKey: ["docente-enrollments-cohorts", myCohortIds, cohortOnlyProgramIds],
    enabled: myCohortIds.length > 0 && cohortOnlyProgramIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("cohort_enrollments")
        .select("user_id, estado, enrollment:enrollments(id,programa_id,user_id,estado,progreso_porcentaje)")
        .in("cohort_id", myCohortIds)
        .eq("estado", "activo");
      return (data ?? [])
        .map((r: any) => r.enrollment)
        .filter(
          (e: any) => e && cohortOnlyProgramIds.includes(e.programa_id),
        );
    },
  });

  // Dedup por id de inscripción
  const byId = new Map<string, any>();
  for (const e of [...ownedEnrollments, ...(cohortEnrollments as any[])]) {
    if (e?.id) byId.set(e.id, e);
  }
  const enrollments = Array.from(byId.values());
  const totalAlumnos = new Set(enrollments.map((e) => e.user_id)).size;

  return {
    teacher,
    programas,
    programaIds,
    ownedProgramIds,
    myCohortIds,
    enrollments,
    totalAlumnos,
  };
}
