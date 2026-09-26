const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const TIPO: Record<string, [string, string]> = {
  diplomado: ["Diplomado", "Diplomados"],
  curso: ["Curso", "Cursos"],
  taller: ["Taller", "Talleres"],
};
const MODALIDAD: Record<string, [string, string]> = {
  sincrono: ["Síncrono", "Síncrono (en vivo)"],
  asincrono: ["Asíncrono", "Asíncrono (a tu ritmo)"],
  mixto: ["Mixto", "Mixto"],
};

const key = (v: string | null | undefined) => (v ?? "").toLowerCase();

export const tipoLabel = (v: string | null | undefined) => TIPO[key(v)]?.[0] ?? cap(v ?? "");
export const tipoLabelPlural = (v: string | null | undefined) => TIPO[key(v)]?.[1] ?? cap(v ?? "");
export const modalidadLabel = (v: string | null | undefined) =>
  MODALIDAD[key(v)]?.[0] ?? cap(v ?? "");
export const modalidadLabelLong = (v: string | null | undefined) =>
  MODALIDAD[key(v)]?.[1] ?? cap(v ?? "");
