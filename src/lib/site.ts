export const SITE_URL = "https://academiaceapsi.com";

export const programaUrl = (slug: string) => `${SITE_URL}/programas/${slug}`;

/** Quita etiquetas HTML y recorta el texto para usarlo como descripción. */
export function plainExcerpt(html: string | null | undefined, max = 160) {
  if (!html) return "";
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
