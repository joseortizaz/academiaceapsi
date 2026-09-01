import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout, PageHeader } from "@/components/site/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowRight, Loader2 } from "lucide-react";

export const Route = createFileRoute("/blog/")({
  component: Blog,
  head: () => ({
    meta: [
      { title: "Blog | Academia CEAPSI" },
      {
        name: "description",
        content:
          "Artículos de interés psicológico y educativo escritos por los docentes de Academia CEAPSI.",
      },
      { property: "og:title", content: "Blog | Academia CEAPSI" },
      {
        property: "og:description",
        content:
          "Artículos de interés psicológico y educativo escritos por los docentes de Academia CEAPSI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

export function formatFecha(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Blog() {
  const { data: posts, isLoading } = useQuery({
    queryKey: ["blog", "publicados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id,titulo,slug,resumen,imagen_url,categoria_id,fecha_publicacion")
        .eq("estado", "publicado")
        .order("fecha_publicacion", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["blog", "categorias"],
    queryFn: async () =>
      (await supabase.from("categories").select("id,nombre")).data ?? [],
  });

  const catName = (id: string | null) =>
    categorias.find((c: any) => c.id === id)?.nombre ?? null;

  return (
    <PublicLayout>
      <PageHeader
        eyebrow="Blog"
        title="Aprende algo nuevo cada semana"
        subtitle="Artículos de interés psicológico y educativo escritos por nuestros docentes."
      />
      <section className="container mx-auto px-4 py-16 md:py-24">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !posts || posts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            Aún no hay artículos publicados. Vuelve pronto.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {posts.map((a) => (
              <Card key={a.id} className="overflow-hidden border-border transition hover:shadow-lg">
                {a.imagen_url ? (
                  <img
                    src={a.imagen_url}
                    alt={a.titulo}
                    loading="lazy"
                    className="aspect-[16/8] w-full object-cover"
                  />
                ) : (
                  <div className="aspect-[16/8] bg-gradient-to-br from-primary to-accent" />
                )}
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {catName(a.categoria_id) && (
                      <Badge variant="secondary">{catName(a.categoria_id)}</Badge>
                    )}
                    {a.fecha_publicacion && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {formatFecha(a.fecha_publicacion)}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 text-xl font-semibold text-foreground">{a.titulo}</h2>
                  {a.resumen && (
                    <p className="mt-2 text-sm text-muted-foreground">{a.resumen}</p>
                  )}
                  <Link
                    to="/blog/$slug"
                    params={{ slug: a.slug }}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-accent"
                  >
                    Leer artículo <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
