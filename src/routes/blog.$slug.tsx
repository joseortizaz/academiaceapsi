import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/site/PublicLayout";
import { RichText } from "@/components/RichText";
import { marked } from "marked";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowLeft, Loader2 } from "lucide-react";
import { formatFecha } from "./blog.index";

function toHtml(content: string | null | undefined) {
  if (!content) return "";
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(content);
  return isHtml ? content : (marked.parse(content, { async: false }) as string);
}

export const Route = createFileRoute("/blog/$slug")({
  component: BlogPost,
  head: () => ({
    meta: [
      { title: "Artículo | Blog Academia CEAPSI" },
      {
        name: "description",
        content: "Artículo del blog de Academia CEAPSI sobre psicología y educación.",
      },
      { property: "og:title", content: "Artículo | Blog Academia CEAPSI" },
      {
        property: "og:description",
        content: "Artículo del blog de Academia CEAPSI sobre psicología y educación.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function BlogPost() {
  const { slug } = Route.useParams();

  const { data: post, isLoading } = useQuery({
    queryKey: ["blog", "post", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("estado", "publicado")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: categoria } = useQuery({
    queryKey: ["blog", "categoria", post?.categoria_id],
    enabled: !!post?.categoria_id,
    queryFn: async () =>
      (await supabase.from("categories").select("nombre").eq("id", post!.categoria_id!).maybeSingle()).data,
  });

  useEffect(() => {
    if (!post?.id) return;
    supabase
      .from("blog_posts")
      .update({ vistas: (post.vistas ?? 0) + 1 })
      .eq("id", post.id)
      .then(() => {});
  }, [post?.id]);

  return (
    <PublicLayout>
      <article className="container mx-auto max-w-3xl px-4 py-12 md:py-16">
        <Link
          to="/blog"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-accent"
        >
          <ArrowLeft className="h-3 w-3" /> Volver al blog
        </Link>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !post ? (
          <div className="mt-8 rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            No encontramos este artículo.
          </div>
        ) : (
          <>
            <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
              {categoria?.nombre && <Badge variant="secondary">{categoria.nombre}</Badge>}
              {post.fecha_publicacion && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {formatFecha(post.fecha_publicacion)}
                </span>
              )}
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              {post.titulo}
            </h1>
            {post.resumen && (
              <p className="mt-3 text-lg text-muted-foreground">{post.resumen}</p>
            )}
            {post.imagen_url && (
              <img
                src={post.imagen_url}
                alt={post.titulo}
                className="mt-6 aspect-[16/8] w-full rounded-xl object-cover"
              />
            )}
            <RichText html={toHtml(post.contenido)} className="mt-8 prose-base" />
            {post.tags && post.tags.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {post.tags.map((t: string) => (
                  <Badge key={t} variant="outline">{t}</Badge>
                ))}
              </div>
            )}
          </>
        )}
      </article>
    </PublicLayout>
  );
}
