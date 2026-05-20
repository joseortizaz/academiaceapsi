import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GraduationCap, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mis-cursos/")({
  component: MisCursos,
});

function MisCursos() {
  const { user } = useAuth();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mis-cursos", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: enrolls, error } = await supabase
        .from("enrollments")
        .select("*")
        .eq("user_id", user!.id)
        .order("fecha_inscripcion", { ascending: false });
      if (error) throw error;
      const programaIds = (enrolls ?? []).map((e) => e.programa_id);
      if (programaIds.length === 0) return [];
      const { data: programas } = await supabase
        .from("programs")
        .select("id,titulo,slug,imagen_url,tipo,modalidad")
        .in("id", programaIds);
      const map = new Map((programas ?? []).map((p) => [p.id, p]));
      return (enrolls ?? []).map((e) => ({ ...e, programa: map.get(e.programa_id) }));
    },
  });

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Mis cursos</h1>
            <p className="text-muted-foreground">Continúa donde lo dejaste.</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/programas">Ver catálogo</Link>
          </Button>
        </header>

        {isLoading ? (
          <p className="text-muted-foreground">Cargando…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card p-12 text-center">
            <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">Aún no estás inscrito en ningún programa.</p>
            <Button asChild className="mt-4">
              <Link to="/programas">Explorar programas</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((e) => (
              <article key={e.id} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="aspect-video bg-muted">
                  {e.programa?.imagen_url ? (
                    <img src={e.programa.imagen_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-primary/30">
                      <BookOpen className="h-12 w-12" />
                    </div>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="capitalize">{e.programa?.tipo}</Badge>
                    <Badge variant={e.estado === "activo" ? "default" : "secondary"}>
                      {e.estado}
                    </Badge>
                  </div>
                  <h2 className="line-clamp-2 font-bold">{e.programa?.titulo}</h2>
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>Progreso</span>
                      <span>{e.progreso_porcentaje}%</span>
                    </div>
                    <Progress value={e.progreso_porcentaje} />
                  </div>
                  {e.estado === "pendiente" ? (
                    <Button disabled className="w-full" variant="secondary">
                      Pago pendiente de verificación
                    </Button>
                  ) : (
                    <Button asChild className="w-full">
                      <Link to="/mis-cursos/$slug" params={{ slug: e.programa!.slug }}>
                        Continuar curso
                      </Link>
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
