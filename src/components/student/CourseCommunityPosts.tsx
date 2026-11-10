import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

type CommunityPost = {
  id: string;
  titulo: string;
  contenido: string;
  imagen_url: string | null;
  visible_desde: string;
  visible_hasta: string | null;
};

const MAX_COLLAPSED = 3;

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("es-DO", { day: "numeric", month: "long", year: "numeric" });

/**
 * Publicaciones de la comunidad del curso, visibles para el alumno inscrito.
 * La ventana visible_desde / visible_hasta la aplica la política RLS; el filtro
 * local solo evita mostrar algo que expiró mientras la página estaba abierta.
 */
export function CourseCommunityPosts({ programaId }: { programaId: string }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const queryKey = ["mc-community-posts", programaId];

  const { data: posts = [] } = useQuery({
    queryKey,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_posts")
        .select("id,titulo,contenido,imagen_url,visible_desde,visible_hasta")
        .eq("programa_id", programaId)
        .order("visible_desde", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CommunityPost[];
    },
  });

  // Refrescar al publicarse algo nuevo en este curso.
  useEffect(() => {
    const channel = supabase
      .channel(`community-posts-${programaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "community_posts",
          filter: `programa_id=eq.${programaId}`,
        },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId, qc]);

  const now = Date.now();
  const visibles = posts.filter(
    (p) =>
      new Date(p.visible_desde).getTime() <= now &&
      (!p.visible_hasta || new Date(p.visible_hasta).getTime() > now),
  );
  if (visibles.length === 0) return null;

  const shown = expanded ? visibles : visibles.slice(0, MAX_COLLAPSED);

  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="anuncios-curso">
      <h2
        id="anuncios-curso"
        className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground"
      >
        <Megaphone className="h-4 w-4 text-primary" /> Anuncios del curso
      </h2>
      <ul className="mt-3 space-y-4">
        {shown.map((p) => (
          <li key={p.id} className="border-l-2 border-primary/40 pl-3">
            <p className="font-medium">{p.titulo}</p>
            <p className="text-xs text-muted-foreground">
              {fmt(p.visible_desde)}
              {p.visible_hasta && ` · disponible hasta el ${fmt(p.visible_hasta)}`}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{p.contenido}</p>
            {p.imagen_url && (
              <img
                src={p.imagen_url}
                alt=""
                loading="lazy"
                className="mt-2 max-h-96 w-full rounded-md border object-contain"
              />
            )}
          </li>
        ))}
      </ul>
      {visibles.length > MAX_COLLAPSED && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setExpanded((v) => !v)}>
          {expanded ? (
            <>
              <ChevronUp className="mr-1 h-4 w-4" /> Ver menos
            </>
          ) : (
            <>
              <ChevronDown className="mr-1 h-4 w-4" /> Ver todos ({visibles.length})
            </>
          )}
        </Button>
      )}
    </section>
  );
}
