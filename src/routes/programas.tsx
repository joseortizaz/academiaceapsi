import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/site/PublicLayout";
import { RichText } from "@/components/RichText";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Clock,
  Calendar,
  Users,
  GraduationCap,
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
  const [selected, setSelected] = useState<any | null>(null);

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
            {programas.map((p) => (
              <article
                key={p.id}
                onClick={() => setSelected(p)}
                className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="block aspect-video w-full overflow-hidden bg-muted">
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
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="capitalize">{p.tipo}</Badge>
                    <Badge variant="secondary" className="capitalize">{p.modalidad}</Badge>
                    {p.destacado && <Badge>Destacado</Badge>}
                  </div>
                  <h3 className="line-clamp-2 text-lg font-bold text-foreground transition group-hover:text-primary">
                    {p.titulo}
                  </h3>
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(p);
                      }}
                    >
                      Más información
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-3xl">
          {selected && (
            <>
              <div className="aspect-video w-full overflow-hidden bg-muted">
                {selected.imagen_url ? (
                  <img
                    src={selected.imagen_url}
                    alt={selected.titulo}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-primary/30">
                    <GraduationCap className="h-16 w-16" />
                  </div>
                )}
              </div>

              <div className="space-y-5 p-6">
                <DialogHeader className="space-y-3 text-left">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="capitalize">{selected.tipo}</Badge>
                    <Badge variant="secondary" className="capitalize">{selected.modalidad}</Badge>
                    {selected.destacado && <Badge>Destacado</Badge>}
                  </div>
                  <DialogTitle className="text-2xl md:text-3xl">{selected.titulo}</DialogTitle>
                  {selected.resumen && (
                    <p className="text-sm text-muted-foreground">{selected.resumen}</p>
                  )}
                </DialogHeader>

                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  {selected.duracion_horas && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {selected.duracion_horas} horas
                    </span>
                  )}
                  {selected.fecha_inicio && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(selected.fecha_inicio).toLocaleDateString("es-DO")}
                    </span>
                  )}
                  {selected.max_estudiantes && (
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> Cupo {selected.max_estudiantes}
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {selected.descripcion ? (
                    <DetailBlock
                      icon={<FileText className="h-4 w-4 text-primary" />}
                      title="Descripción"
                      text={selected.descripcion}
                    />
                  ) : (
                    <p className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                      Descripción detallada próximamente.
                    </p>
                  )}
                  {selected.objetivos && (
                    <DetailBlock
                      icon={<Target className="h-4 w-4 text-primary" />}
                      title="Objetivos"
                      text={selected.objetivos}
                    />
                  )}
                  {selected.publico_meta && (
                    <DetailBlock
                      icon={<UserCheck className="h-4 w-4 text-primary" />}
                      title="Público meta"
                      text={selected.publico_meta}
                    />
                  )}
                  {selected.resultados_esperados && (
                    <DetailBlock
                      icon={<Sparkles className="h-4 w-4 text-primary" />}
                      title="Resultados esperados"
                      text={selected.resultados_esperados}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t pt-4">
                  {selected.precio_descuento ? (
                    <div>
                      <span className="text-xl font-bold text-primary">
                        RD$ {Number(selected.precio_descuento).toLocaleString("es-DO")}
                      </span>
                      <span className="ml-2 text-sm text-muted-foreground line-through">
                        RD$ {Number(selected.precio).toLocaleString("es-DO")}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xl font-bold text-primary">
                      {Number(selected.precio) > 0
                        ? `RD$ ${Number(selected.precio).toLocaleString("es-DO")}`
                        : "Gratis"}
                    </span>
                  )}
                </div>

                <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={() => setSelected(null)}>
                    Cerrar
                  </Button>
                  <Button
                    onClick={() =>
                      navigate({ to: "/programas/$slug", params: { slug: selected.slug } })
                    }
                  >
                    Inscribirme
                  </Button>
                </DialogFooter>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
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
