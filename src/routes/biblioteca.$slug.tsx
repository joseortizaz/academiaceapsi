import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Link2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/site/PublicLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LibraryCard,
  LibraryCover,
  CATALOG_COLUMNS,
  type CatalogDoc,
} from "@/components/library/LibraryCard";
import { LibraryAccess } from "@/components/library/LibraryAccess";
import { LIBRARY_IDIOMAS, formatFileSize } from "@/lib/library";
import { SITE_URL, bibliotecaUrl, plainExcerpt } from "@/lib/site";

async function cargarDocumento(slug: string) {
  const { data, error } = await supabase
    .from("library_catalog")
    .select(CATALOG_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as CatalogDoc | null;
}

export const Route = createFileRoute("/biblioteca/$slug")({
  staticData: { sitemap: true },
  loader: async ({ params }) => {
    try {
      return { doc: await cargarDocumento(params.slug) };
    } catch {
      return { doc: null as CatalogDoc | null };
    }
  },
  head: ({ params, loaderData }) => {
    const doc = loaderData?.doc;
    if (!doc) {
      return {
        meta: [
          { title: "Documento no encontrado | Academia Ceapsi RD" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const url = bibliotecaUrl(params.slug);
    const title = `${doc.titulo} | Biblioteca Virtual Academia Ceapsi`;
    const description =
      plainExcerpt(doc.descripcion, 160) ||
      `Documento en PDF de la Biblioteca Virtual de la Academia Ceapsi RD${doc.autores ? `, por ${doc.autores}` : ""}.`;
    const image = doc.portada_url || `${SITE_URL}/favicon.ico`;
    const autores = (doc.autores ?? "")
      .split(/,|;| y /)
      .map((a) => a.trim())
      .filter(Boolean);

    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: doc.titulo,
        description,
        url,
        image,
        inLanguage: doc.idioma ?? "es",
        encodingFormat: "application/pdf",
        isAccessibleForFree: true,
        conditionsOfAccess: "Requiere una cuenta gratuita en Academia Ceapsi RD para descargar.",
        ...(autores.length ? { author: autores.map((name) => ({ "@type": "Person", name })) } : {}),
        ...(doc.anio ? { datePublished: String(doc.anio) } : {}),
        ...(doc.etiquetas?.length ? { keywords: doc.etiquetas.join(", ") } : {}),
        ...(doc.categoria_nombre ? { genre: doc.categoria_nombre } : {}),
        publisher: { "@type": "Organization", name: "Academia Ceapsi RD", url: SITE_URL },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Biblioteca", item: `${SITE_URL}/biblioteca` },
          { "@type": "ListItem", position: 3, name: doc.titulo, item: url },
        ],
      },
    ];

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "book" },
        { property: "og:url", content: url },
        { property: "og:image", content: image },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }],
    };
  },
  component: DocumentoPage,
});

function Dato({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{valor}</dd>
    </div>
  );
}

function DocumentoPage() {
  const { slug } = Route.useParams();
  const { doc: inicial } = Route.useLoaderData();

  const { data: doc } = useQuery({
    queryKey: ["public", "biblioteca", "documento", slug],
    queryFn: () => cargarDocumento(slug),
    initialData: inicial ?? undefined,
    staleTime: 60_000,
  });

  const { data: relacionados = [] } = useQuery({
    queryKey: ["public", "biblioteca", "relacionados", doc?.id],
    enabled: !!doc?.id && !!doc?.categoria_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_catalog")
        .select(CATALOG_COLUMNS)
        .eq("categoria_id", doc!.categoria_id!)
        .neq("id", doc!.id)
        .order("descargas", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as CatalogDoc[];
    },
  });

  if (!doc) {
    return (
      <PublicLayout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Documento no encontrado</h1>
          <p className="mt-2 text-muted-foreground">Puede que haya sido retirado del catálogo.</p>
          <Button asChild className="mt-6">
            <Link to="/biblioteca">Ir a la Biblioteca</Link>
          </Button>
        </div>
      </PublicLayout>
    );
  }

  const shareUrl = bibliotecaUrl(doc.slug);
  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };
  const compartirWhatsApp = () => {
    const texto = `${doc.titulo} — Biblioteca Virtual Academia Ceapsi: ${shareUrl}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(texto)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-8 md:py-12">
        <Link
          to="/biblioteca"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Biblioteca Virtual
        </Link>

        <div className="grid gap-8 md:grid-cols-[minmax(0,18rem)_1fr] lg:gap-12">
          <div className="mx-auto w-full max-w-[16rem] md:max-w-none">
            <div className="aspect-[3/4] overflow-hidden rounded-xl border bg-muted shadow-md md:sticky md:top-24">
              <LibraryCover titulo={doc.titulo} portadaUrl={doc.portada_url} eager />
            </div>
          </div>

          <div className="min-w-0 space-y-6">
            <div className="space-y-3">
              {doc.categoria_nombre && doc.categoria_slug && (
                <Link to="/biblioteca" search={{ categoria: doc.categoria_slug }}>
                  <Badge variant="outline" className="hover:bg-muted">
                    {doc.categoria_nombre}
                  </Badge>
                </Link>
              )}
              <h1 className="text-3xl font-bold leading-tight text-foreground md:text-4xl">
                {doc.titulo}
              </h1>
              {doc.autores && <p className="text-lg text-muted-foreground">{doc.autores}</p>}
            </div>

            <dl className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-5 text-sm sm:grid-cols-4">
              {doc.anio && <Dato label="Año" valor={doc.anio} />}
              {doc.paginas && <Dato label="Páginas" valor={doc.paginas} />}
              <Dato label="Idioma" valor={LIBRARY_IDIOMAS[doc.idioma ?? "es"] ?? doc.idioma} />
              <Dato
                label="Formato"
                valor={`PDF${doc.tamano_bytes ? ` · ${formatFileSize(doc.tamano_bytes)}` : ""}`}
              />
            </dl>

            <LibraryAccess
              doc={{
                id: doc.id,
                slug: doc.slug,
                titulo: doc.titulo,
                tamano_bytes: doc.tamano_bytes,
              }}
            />

            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={copiarEnlace}>
                <Link2 className="mr-2 h-4 w-4" />
                Copiar enlace
              </Button>
              <Button variant="ghost" size="sm" onClick={compartirWhatsApp}>
                <MessageCircle className="mr-2 h-4 w-4" />
                Compartir por WhatsApp
              </Button>
            </div>

            {doc.descripcion && (
              <section>
                <h2 className="mb-2 text-lg font-semibold">Acerca de este documento</h2>
                <p className="whitespace-pre-line leading-relaxed text-foreground/90">
                  {doc.descripcion}
                </p>
              </section>
            )}

            {doc.etiquetas && doc.etiquetas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {doc.etiquetas.map((t) => (
                  <Link key={t} to="/biblioteca" search={{ q: t }}>
                    <Badge variant="secondary" className="font-normal hover:bg-muted">
                      #{t}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}

            {doc.licencia && (
              <p className="border-t pt-4 text-xs text-muted-foreground">
                <span className="font-medium">Derechos de uso:</span> {doc.licencia}
              </p>
            )}
          </div>
        </div>

        {relacionados.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-5 text-xl font-bold">Más en {doc.categoria_nombre}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5">
              {relacionados.map((d) => (
                <LibraryCard key={d.id} doc={d} />
              ))}
            </div>
          </section>
        )}
      </div>
    </PublicLayout>
  );
}
