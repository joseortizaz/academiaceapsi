/**
 * Tipos y utilidades del lector de la Biblioteca Virtual.
 * Los resaltados se guardan como rectángulos en fracciones de la página (0 a 1),
 * así se dibujan igual con cualquier zoom o tamaño de pantalla.
 */

export type HighlightRect = { x: number; y: number; w: number; h: number };

export type ColorKey = "amarillo" | "verde" | "azul" | "rosa";

export const COLORES: Record<ColorKey, { label: string; fill: string; solid: string }> = {
  amarillo: { label: "Amarillo", fill: "rgba(250, 204, 21, 0.45)", solid: "#eab308" },
  verde: { label: "Verde", fill: "rgba(74, 222, 128, 0.45)", solid: "#22c55e" },
  azul: { label: "Azul", fill: "rgba(96, 165, 250, 0.45)", solid: "#3b82f6" },
  rosa: { label: "Rosa", fill: "rgba(244, 114, 182, 0.45)", solid: "#ec4899" },
};

export const COLOR_KEYS = Object.keys(COLORES) as ColorKey[];

export const NOTA_MAX = 5000;
export const TEXTO_MAX = 3000;

export type Annotation = {
  id: string;
  pagina: number;
  color: ColorKey;
  rects: HighlightRect[];
  texto: string | null;
  nota: string | null;
  created_at?: string;
};

export type NewAnnotation = Omit<Annotation, "id" | "created_at">;

const redondear = (n: number) => Math.round(n * 10000) / 10000;

/** Valida y normaliza lo que viene de la base de datos (columna jsonb). */
export function parseRects(value: unknown): HighlightRect[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (r): r is HighlightRect =>
        !!r &&
        typeof r === "object" &&
        ["x", "y", "w", "h"].every((k) => typeof (r as Record<string, unknown>)[k] === "number"),
    )
    .map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h }));
}

export function parseColor(value: unknown): ColorKey {
  return typeof value === "string" && value in COLORES ? (value as ColorKey) : "amarillo";
}

/**
 * Convierte los rectángulos de una selección (en píxeles de pantalla) a fracciones
 * de la página y une los trozos contiguos de una misma línea.
 */
export function rectsFromClientRects(rects: DOMRect[], page: DOMRect): HighlightRect[] {
  const fracs = rects
    .filter((r) => r.width > 1 && r.height > 1)
    .map((r) => {
      const left = Math.max(r.left, page.left);
      const right = Math.min(r.right, page.right);
      const top = Math.max(r.top, page.top);
      const bottom = Math.min(r.bottom, page.bottom);
      return {
        x: (left - page.left) / page.width,
        y: (top - page.top) / page.height,
        w: (right - left) / page.width,
        h: (bottom - top) / page.height,
      };
    })
    .filter((r) => r.w > 0.001 && r.h > 0.001)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const unidos: HighlightRect[] = [];
  for (const r of fracs) {
    const prev = unidos[unidos.length - 1];
    const mismaLinea =
      prev &&
      Math.abs(prev.y + prev.h / 2 - (r.y + r.h / 2)) < Math.min(prev.h, r.h) * 0.5 &&
      r.x <= prev.x + prev.w + 0.015;
    if (prev && mismaLinea) {
      const x = Math.min(prev.x, r.x);
      const y = Math.min(prev.y, r.y);
      const right = Math.max(prev.x + prev.w, r.x + r.w);
      const bottom = Math.max(prev.y + prev.h, r.y + r.h);
      unidos[unidos.length - 1] = { x, y, w: right - x, h: bottom - y };
    } else if (!prev || !(Math.abs(prev.x - r.x) < 0.001 && Math.abs(prev.y - r.y) < 0.001)) {
      unidos.push(r);
    }
  }
  return unidos.slice(0, 300).map((r) => ({
    x: redondear(r.x),
    y: redondear(r.y),
    w: redondear(r.w),
    h: redondear(r.h),
  }));
}

/** Posición vertical (0 a 1) del primer rectángulo, para ordenar y para saltar a la anotación. */
export function annotationTop(a: Pick<Annotation, "rects">): number {
  return a.rects.length ? Math.min(...a.rects.map((r) => r.y)) : 0;
}

export function sortAnnotations<T extends Annotation>(list: T[]): T[] {
  return [...list].sort(
    (a, b) =>
      a.pagina - b.pagina ||
      annotationTop(a) - annotationTop(b) ||
      (a.created_at ?? "").localeCompare(b.created_at ?? ""),
  );
}
