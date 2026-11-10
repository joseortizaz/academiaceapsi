// Versiones del plan de estudios de un diplomado.
//
// Un módulo (course_modules.plan_version) y un grupo (program_cohorts.plan_version)
// pueden marcarse con una versión del plan. Reglas:
//  - Módulo sin versión (null): lo ven todos los grupos.
//  - Grupo sin versión (null): ve todos los módulos (comportamiento anterior).
//  - Si ambos tienen versión, el grupo solo ve los módulos de su misma versión.
// La misma regla aplica en la base de datos (public.leccion_visible_para_plan),
// que es la que calcula el porcentaje de progreso de cada inscripción.

export const PLAN_VERSIONES = [1, 2, 3] as const;

export const PLAN_TODOS = "todos";

export function planLabel(v: number | null | undefined): string {
  return v == null ? "Todos los grupos" : `Plan v${v}`;
}

export function planToSelect(v: number | null | undefined): string {
  return v == null ? PLAN_TODOS : String(v);
}

export function planFromSelect(v: string): number | null {
  return v === PLAN_TODOS ? null : Number(v);
}

export function moduloVisibleParaPlan(
  moduloPlan: number | null | undefined,
  planGrupo: number | null | undefined,
): boolean {
  return planGrupo == null || moduloPlan == null || moduloPlan === planGrupo;
}
