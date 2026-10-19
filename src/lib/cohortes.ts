import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Grupos (program_cohorts) como única fuente de fechas y horarios públicos,
 * y cierre de acceso 10 días después de la fecha de término de cada grupo
 * (migración 0016). Las fechas son "yyyy-mm-dd" sin zona horaria: se leen y
 * formatean tal cual para no correr un día al pasar por UTC.
 */

/** Días de acceso que se conservan después de la fecha de término (igual que en SQL). */
export const COHORTE_DIAS_GRACIA = 10;

export type ProximaCohorte = {
  programa_id: string;
  fecha_inicio: string;
  horario: string | null;
  cupo_maximo: number | null;
  modalidad: string | null;
};

export type AccesoCohorte = {
  programa_id: string;
  cohorte: string | null;
  fecha_fin: string | null;
  ultimo_dia_acceso: string | null;
  abierto: boolean;
};

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function partes(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

/** "martes 3 nov" (año solo si no es el actual en RD). */
export function fechaCohorte(iso: string): string {
  const p = partes(iso);
  if (!p) return iso;
  const anioActual = Number(hoyRD().slice(0, 4));
  return `${DIAS[p.dow]} ${p.d} ${MESES[p.m - 1]}${p.y !== anioActual ? ` ${p.y}` : ""}`;
}

/** "3 de noviembre de 2026" */
export function fechaLargaCohorte(iso: string): string {
  const p = partes(iso);
  return p ? `${p.d} de ${MESES_LARGOS[p.m - 1]} de ${p.y}` : iso;
}

/** Hoy en República Dominicana, yyyy-mm-dd. */
export function hoyRD(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" });
}

/** Último día con acceso a los contenidos: fecha de término + 10 días. */
export function ultimoDiaAcceso(fechaFin: string): string {
  const p = partes(fechaFin);
  if (!p) return fechaFin;
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + COHORTE_DIAS_GRACIA));
  return t.toISOString().slice(0, 10);
}

/** Próximos grupos de todos los programas publicados, agrupados por programa. */
export function useProximasCohortes() {
  return useQuery({
    queryKey: ["public", "proximas-cohortes"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("proximas_cohortes");
      if (error) throw error;
      const map = new Map<string, ProximaCohorte[]>();
      for (const c of (data ?? []) as ProximaCohorte[]) {
        const list = map.get(c.programa_id) ?? [];
        list.push(c);
        map.set(c.programa_id, list);
      }
      return map;
    },
  });
}

/** Estado de acceso del alumno conectado en cada programa donde tiene grupo. */
export function useMiAccesoCohortes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["mi-acceso-cohortes", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("mi_acceso_cohortes");
      // Si la función aún no existe (migración sin aplicar), no se bloquea nada en pantalla.
      if (error) return new Map<string, AccesoCohorte>();
      return new Map(((data ?? []) as AccesoCohorte[]).map((a) => [a.programa_id, a]));
    },
  });
}

type ProgramaFechas = {
  id: string;
  modalidad?: string | null;
  fecha_inicio?: string | null;
  horario?: string | null;
  max_estudiantes?: number | null;
};

/**
 * Próximos grupos de un programa. Si todavía no tiene grupos creados, se usa la
 * fecha de la ficha del programa solo cuando aún no ha pasado (transición: así
 * nunca se publica una fecha vencida).
 */
export function proximasDePrograma(
  programa: ProgramaFechas | null | undefined,
  porPrograma: Map<string, ProximaCohorte[]> | undefined,
): ProximaCohorte[] {
  if (!programa) return [];
  const grupos = porPrograma?.get(programa.id);
  if (grupos?.length) return grupos;
  const f = programa.fecha_inicio?.slice(0, 10);
  if (!f || f < hoyRD()) return [];
  return [
    {
      programa_id: programa.id,
      fecha_inicio: f,
      horario: programa.horario?.trim() || null,
      cupo_maximo: programa.max_estudiantes ?? null,
      modalidad: programa.modalidad ?? null,
    },
  ];
}
