import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpenText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LibraryCover } from "@/components/library/LibraryCard";

/**
 * Documentos de la biblioteca que el usuario empezó a leer, del más reciente al más antiguo.
 * No muestra nada si todavía no ha leído ninguno.
 */
export function ContinueReading({ userId }: { userId: string | undefined }) {
  const { data = [] } = useQuery({
    queryKey: ["biblioteca", "progreso", "recientes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: filas, error } = await supabase
        .from("library_reading_progress")
        .select("document_id, pagina, total_paginas, updated_at")
        .order("updated_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      if (!filas?.length) return [];
      const { data: docs } = await supabase
        .from("library_catalog")
        .select("id, slug, titulo, autores, portada_url")
        .in(
          "id",
          filas.map((f) => f.document_id),
        );
      const porId = new Map((docs ?? []).map((d) => [d.id, d]));
      // Documentos ocultos o retirados no aparecen.
      return filas
        .map((f) => ({ ...f, doc: porId.get(f.document_id) }))
        .filter((f) => f.doc?.slug && f.doc.titulo)
        .slice(0, 3);
    },
  });

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpenText className="h-4 w-4 text-primary" />
          Continuar leyendo
        </CardTitle>
        <Link to="/biblioteca" className="text-sm font-medium text-primary hover:underline">
          Ir a la Biblioteca
        </Link>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((f) => {
          const pct = f.total_paginas ? Math.round((f.pagina / f.total_paginas) * 100) : null;
          return (
            <Link
              key={f.document_id}
              to="/biblioteca/$slug/leer"
              params={{ slug: f.doc!.slug! }}
              className="group flex gap-3 rounded-lg border bg-background p-3 transition hover:border-primary/40 hover:shadow-sm"
            >
              <div className="aspect-[3/4] w-14 shrink-0 overflow-hidden rounded border bg-muted">
                <LibraryCover titulo={f.doc!.titulo!} portadaUrl={f.doc!.portada_url} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">
                    {f.doc!.titulo}
                  </p>
                  {f.doc!.autores && (
                    <p className="truncate text-xs text-muted-foreground">{f.doc!.autores}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Página {f.pagina}
                    {f.total_paginas ? ` de ${f.total_paginas}` : ""}
                  </p>
                  {pct !== null && <Progress value={pct} className="h-1.5" />}
                </div>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
