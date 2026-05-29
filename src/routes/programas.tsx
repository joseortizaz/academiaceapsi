import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/site/PublicLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Clock,
  Calendar,
  Users,
  GraduationCap,
  ChevronDown,
  Target,
  UserCheck,
  Sparkles,
  FileText,
} from "lucide-react";

export const Route = createFileRoute("/programas")({
  head: () => ({
    meta: [
      { title: "Programas | Academia Ceapsi RD" },
      {
        name: "description",
        content:
          "Diplomados y cursos sincrónicos y asincrónicos de la Academia Ceapsi RD en República Dominicana.",
      },
      { property: "og:title", content: "Catálogo de Programas — Academia Ceapsi RD" },
      {
        property: "og:description",
        content: "Explora nuestros diplomados, cursos y talleres especializados.",
      },
    ],
  }),
  component: ProgramasPage,
});

function ProgramasPage() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: programas = [], isLoading } = useQuery({
    queryKey: ["public", "programas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .in("estado", ["publicado", "en_curso"])
        .order("destacado", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <PublicLayout>
      <section className="border-b bg-gradient-to-b from-primary/5 to-background py-14">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold text-foreground md:text-5xl">
            Nuestros Programas
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Diplomados, cursos y talleres diseñados por especialistas de la región.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-14">
        {isLoading ? (
          <p className="text-center text-muted-foreground">Cargando programas…</p>
        ) : programas.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card p-12 text-center text-muted-foreground">
            Aún no hay programas publicados. Vuelve pronto.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {programas.map((p) => {
              const isOpen = !!expanded[p.id];
              return (
                <article
                  key={p.id}
                  className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition hover:shadow-md"
                >
                  <Link
                    to="/programas/$slug"
                    params={{ slug: p.slug }}
                    className="block aspect-video w-full overflow-hidden bg-muted"
                    aria-label={`Ver detalle de ${p.titulo}`}
                  >
                    {p.imagen_url ? (
                      <img
                        src={p.imagen_url}
                        alt={p.titulo}
                        loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-primary/30">
                        <GraduationCap className="h-12 w-12" />
                      </div>
                    )}
                  </Link>
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="capitalize">{p.tipo}</Badge>
                      <Badge variant="secondary" className="capitalize">{p.modalidad}</Badge>
                      {p.destacado && <Badge>Destacado</Badge>}
                    </div>
                    <Link
                      to="/programas/$slug"
                      params={{ slug: p.slug }}
                      className="line-clamp-2 text-lg font-bold text-foreground transition hover:text-primary hover:underline"
                    >
                      {p.titulo}
                    </Link>
                    {p.resumen && (
                      <p className="line-clamp-3 text-sm text-muted-foreground">{p.resumen}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {p.duracion_horas && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {p.duracion_horas} horas
                        </span>
                      )}
                      {p.fecha_inicio && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(p.fecha_inicio).toLocaleDateString("es-DO")}
                        </span>
                      )}
                      {p.max_estudiantes && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          Cupo {p.max_estudiantes}
                        </span>
                      )}
                    </div>

                    <Collapsible open={isOpen} onOpenChange={() => toggle(p.id)}>
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted"
                        >
                          <span>{isOpen ? "Ocultar detalles" : "Ver más detalles"}</span>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3 space-y-3 text-sm">
                        {p.descripcion && (
                          <DetailBlock
                            icon={<FileText className="h-4 w-4 text-primary" />}
                            title="Descripción"
                            text={p.descripcion}
                          />
                        )}
                        {(p as any).objetivos && (
                          <DetailBlock
                            icon={<Target className="h-4 w-4 text-primary" />}
                            title="Objetivos"
                            text={(p as any).objetivos}
                          />
                        )}
                        {(p as any).publico_meta && (
                          <DetailBlock
                            icon={<UserCheck className="h-4 w-4 text-primary" />}
                            title="Público meta"
                            text={(p as any).publico_meta}
                          />
                        )}
                        {(p as any).resultados_esperados && (
                          <DetailBlock
                            icon={<Sparkles className="h-4 w-4 text-primary" />}
                            title="Resultados esperados"
                            text={(p as any).resultados_esperados}
                          />
                        )}
                        {!p.descripcion &&
                          !(p as any).objetivos &&
                          !(p as any).publico_meta &&
                          !(p as any).resultados_esperados && (
                            <p className="text-xs text-muted-foreground">
                              Aún no hay información detallada. Visita la página del curso.
                            </p>
                          )}
                      </CollapsibleContent>
                    </Collapsible>

                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <div>
                        {p.precio_descuento ? (
                          <div>
                            <span className="text-lg font-bold text-primary">
                              RD$ {Number(p.precio_descuento).toLocaleString("es-DO")}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground line-through">
                              RD$ {Number(p.precio).toLocaleString("es-DO")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-lg font-bold text-primary">
                            {Number(p.precio) > 0
                              ? `RD$ ${Number(p.precio).toLocaleString("es-DO")}`
                              : "Gratis"}
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() =>
                          navigate({ to: "/programas/$slug", params: { slug: p.slug } })
                        }
                      >
                        Ver detalle
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}

function DetailBlock({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-md border bg-background/60 p-3">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground">
        {icon}
        {title}
      </div>
      <RichText html={text} className="text-sm text-muted-foreground" />
    </div>
  );
}

