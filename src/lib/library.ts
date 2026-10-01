/**
 * Utilidades compartidas de la Biblioteca Virtual (panel admin y páginas públicas).
 */

export const LIBRARY_FILES_BUCKET = "library-files";
export const LIBRARY_COVERS_BUCKET = "library-covers";

/** Límites alineados con los buckets de Supabase (migración 0009). */
export const LIBRARY_PDF_MAX_MB = 50;
export const LIBRARY_COVER_MAX_MB = 5;
export const LIBRARY_DESCRIPCION_MAX = 5000;

export type LibraryEstado = "borrador" | "publicado" | "oculto";

export const LIBRARY_ESTADOS: Record<LibraryEstado, string> = {
  borrador: "Borrador",
  publicado: "Publicado",
  oculto: "Oculto",
};

export const LIBRARY_IDIOMAS: Record<string, string> = {
  es: "Español",
  en: "Inglés",
  pt: "Portugués",
  fr: "Francés",
};

/** Sugerencias para el campo licencia (el admin puede escribir otra). */
export const LIBRARY_LICENCIAS_SUGERIDAS = [
  "© Centro de Aprendizaje y Cambio Ceapsi, SRL. Todos los derechos reservados.",
  "Uso autorizado por el autor para la Academia Ceapsi",
  "CC BY 4.0",
  "CC BY-NC 4.0",
  "CC BY-NC-ND 4.0",
  "Dominio público",
];

/** Convierte un texto en slug: minúsculas, sin acentos, palabras separadas por guiones. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Ruta dentro del bucket a partir de una URL pública de Supabase Storage, o null si no es de ese bucket. */
export function storagePathFromPublicUrl(
  url: string | null | undefined,
  bucket: string,
): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}

/** Nombre legible para el archivo descargado: "titulo-del-documento.pdf". */
export function downloadFileName(titulo: string): string {
  return `${slugify(titulo) || "documento"}.pdf`;
}
