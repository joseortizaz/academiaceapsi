export const SITE_URL = "https://academiaceapsi.com";

export const LEGAL_ENTITY_NAME = "Centro de Aprendizaje y Cambio Ceapsi, SRL";
export const LEGAL_ENTITY_SHORT = "Ceapsi, SRL";
export const LEGAL_ADDRESS =
  "Presidente Hipólito Irigoyen No. 5, Zona Universitaria, Distrito Nacional, República Dominicana";
export const PRIVACY_EMAIL = "admin@ceapsird.com";
export const PRIVACY_PHONE = "809-784-5106";
export const PRIVACY_LAST_UPDATED = "2 de octubre de 2026";

export const programaUrl = (slug: string) => `${SITE_URL}/programas/${slug}`;
export const bibliotecaUrl = (slug: string) => `${SITE_URL}/biblioteca/${slug}`;

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

/** Metadatos por página: título, descripción, Open Graph, canonical y og:url propios. */
export function pageHead(path: string, title: string, description: string, extra?: { type?: string; scripts?: { type: string; children: string }[] }) {
  const url = `${SITE_URL}${path}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: extra?.type ?? "website" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: extra?.scripts ?? [],
  };
}

export const ORGANIZATION_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "EducationalOrganization",
      "@id": `${SITE_URL}/#organization`,
      name: "Academia Ceapsi RD",
      legalName: LEGAL_ENTITY_NAME,
      url: SITE_URL,
      email: PRIVACY_EMAIL,
      address: { "@type": "PostalAddress", addressLocality: "Distrito Nacional", addressCountry: "DO" },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Academia Ceapsi RD",
      url: SITE_URL,
      inLanguage: "es",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export const LOCAL_BUSINESS_LD = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Academia Ceapsi RD",
  url: `${SITE_URL}/contactos`,
  email: PRIVACY_EMAIL,
  address: { "@type": "PostalAddress", addressLocality: "Distrito Nacional", addressCountry: "DO" },
  parentOrganization: { "@id": `${SITE_URL}/#organization` },
};
