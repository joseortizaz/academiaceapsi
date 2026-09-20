export const SITE_URL = "https://academiaceapsi.com";

export const LEGAL_ENTITY_NAME = "Academia Ceapsi RD";
export const LEGAL_ADDRESS =
  "Presidente Hipólito Irigoyen No. 5, Zona Universitaria, Distrito Nacional, República Dominicana";
export const PRIVACY_EMAIL = "admin@ceapsird.com";
export const PRIVACY_PHONE = "809-784-5106";
export const PRIVACY_LAST_UPDATED = "20 de septiembre de 2026";

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
