import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type TeacherProgramScope = {
  isAdmin: boolean;
  isDocente: boolean;
  teacherId: string | null;
  /** Docente titular del programa completo (programs.docente_id). */
  isOwner: boolean;
  /** Cohortes de ESE programa que enseña el docente. */
  cohortIds: string[];
  /** Módulos/lecciones de ESE programa que enseña el docente. */
  moduleIds: string[];
};

export async function getUserRoles(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return (data ?? []).map((r) => r.role as string);
}

async function getTeacherId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("teachers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Resuelve el alcance del docente sobre un programa considerando las tres vías
 * de asignación: programa completo, cohorte específica o módulo específico.
 */
export async function getTeacherScopeForProgram(
  userId: string,
  programaId: string,
): Promise<TeacherProgramScope> {
  const roles = await getUserRoles(userId);
  const isAdmin = roles.includes("admin");
  const isDocente = roles.includes("docente");
  if (isAdmin) {
    return { isAdmin, isDocente, teacherId: null, isOwner: true, cohortIds: [], moduleIds: [] };
  }
  const teacherId = isDocente ? await getTeacherId(userId) : null;
  if (!teacherId) {
    return { isAdmin, isDocente, teacherId: null, isOwner: false, cohortIds: [], moduleIds: [] };
  }

  const [{ data: prog }, { data: cohorts }, { data: mods }, { data: catalogMods }] =
    await Promise.all([
      supabaseAdmin.from("programs").select("docente_id").eq("id", programaId).maybeSingle(),
      supabaseAdmin
        .from("program_cohorts")
        .select("id")
        .eq("programa_id", programaId)
        .eq("docente_id", teacherId),
      supabaseAdmin
        .from("program_modules")
        .select("id")
        .eq("programa_id", programaId)
        .eq("docente_id", teacherId),
      (supabaseAdmin.from("program_modules_catalog" as never) as any)
        .select("id")
        .eq("programa_id", programaId)
        .eq("docente_id", teacherId),
    ]);

  return {
    isAdmin,
    isDocente,
    teacherId,
    isOwner: prog?.docente_id === teacherId,
    cohortIds: (cohorts ?? []).map((c: { id: string }) => c.id),
    moduleIds: [
      ...((mods ?? []) as { id: string }[]).map((m) => m.id),
      ...(((catalogMods ?? []) as { id: string }[]).map((m) => m.id)),
    ],
  };
}

/**
 * ¿Puede el usuario gestionar un recurso (reunión, etc.) de este programa?
 * Admin y docente titular: sí. Docente de cohorte/módulo: solo si el recurso
 * pertenece a SU cohorte o a SU módulo.
 */
export async function canManageProgramResource(
  userId: string,
  opts: { programaId: string; cohortId?: string | null; moduloId?: string | null },
): Promise<{ allowed: boolean; scope: TeacherProgramScope; reason?: string }> {
  const scope = await getTeacherScopeForProgram(userId, opts.programaId);
  if (scope.isAdmin || scope.isOwner) return { allowed: true, scope };
  if (!scope.isDocente) {
    return { allowed: false, scope, reason: "No autorizado: se requiere rol admin o docente." };
  }
  if (!scope.teacherId) {
    return { allowed: false, scope, reason: "No se encontró tu perfil de docente." };
  }
  if (opts.cohortId && scope.cohortIds.includes(opts.cohortId)) return { allowed: true, scope };
  if (opts.moduloId && scope.moduleIds.includes(opts.moduloId)) return { allowed: true, scope };

  if (scope.cohortIds.length > 0 || scope.moduleIds.length > 0) {
    return {
      allowed: false,
      scope,
      reason:
        "Solo puedes gestionar reuniones de tus propios grupos o módulos de este programa. Selecciona tu grupo.",
    };
  }
  return {
    allowed: false,
    scope,
    reason: "No tienes permiso para gestionar reuniones de este programa.",
  };
}

export async function assertCanManageProgramResource(
  userId: string,
  opts: { programaId: string; cohortId?: string | null; moduloId?: string | null },
) {
  const res = await canManageProgramResource(userId, opts);
  if (!res.allowed) throw new Error(res.reason ?? "No autorizado.");
  return res.scope;
}

export type TeacherGlobalScope = {
  isAdmin: boolean;
  isDocente: boolean;
  teacherId: string | null;
  ownedProgramIds: string[];
  /** programa_id -> cohortes suyas */
  cohortIdsByProgram: Record<string, string[]>;
  /** programa_id -> módulos suyos */
  moduleIdsByProgram: Record<string, string[]>;
};

/** Todos los programas del docente por cualquiera de las tres vías. */
export async function getTeacherGlobalScope(userId: string): Promise<TeacherGlobalScope> {
  const roles = await getUserRoles(userId);
  const isAdmin = roles.includes("admin");
  const isDocente = roles.includes("docente");
  const teacherId = isDocente ? await getTeacherId(userId) : null;

  const base: TeacherGlobalScope = {
    isAdmin,
    isDocente,
    teacherId,
    ownedProgramIds: [],
    cohortIdsByProgram: {},
    moduleIdsByProgram: {},
  };
  if (!teacherId) return base;

  const [{ data: progs }, { data: cohorts }, { data: mods }, { data: catalogMods }] =
    await Promise.all([
      supabaseAdmin.from("programs").select("id").eq("docente_id", teacherId),
      supabaseAdmin
        .from("program_cohorts")
        .select("id, programa_id")
        .eq("docente_id", teacherId),
      supabaseAdmin.from("program_modules").select("id, programa_id").eq("docente_id", teacherId),
      (supabaseAdmin.from("program_modules_catalog" as never) as any)
        .select("id, programa_id")
        .eq("docente_id", teacherId),
    ]);

  base.ownedProgramIds = ((progs ?? []) as { id: string }[]).map((p) => p.id);
  for (const c of (cohorts ?? []) as { id: string; programa_id: string }[]) {
    (base.cohortIdsByProgram[c.programa_id] ??= []).push(c.id);
  }
  for (const m of [
    ...(((mods ?? []) as { id: string; programa_id: string }[])),
    ...(((catalogMods ?? []) as { id: string; programa_id: string }[])),
  ]) {
    (base.moduleIdsByProgram[m.programa_id] ??= []).push(m.id);
  }
  return base;
}
