import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/site/PublicLayout";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  GraduationCap,
  Users,
} from "lucide-react";
import { StarRating } from "@/components/reviews/StarRating";
import {
  tipoLabel,
  tipoLabelPlural,
  modalidadLabel,
  modalidadLabelLong,
} from "@/lib/program-labels";
import { cn } from "@/lib/utils";

type ProgramasSearch = { tipo?: string; modalidad?: string };

const cleanParam = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

export const Route = createFileRoute("/programas/")({
  staticData: { sitemap: true },
  validateSearch: (search: Record<string, unknown>): ProgramasSearch => ({
    tipo: cleanParam(search.tipo),
    modalidad: cleanParam(search.modalidad),
  }),
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

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !active}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
        active
          ? "bg-primary text-primary-foreground"
          : "border bg-card hover:bg-muted",
        disabled && !active && "cursor-not-allowed opacity-50 hover:bg-card",
      )}
    >
      {children}
    </button>
  );
}

function ProgramasPage() {
  const { tipo, modalidad } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setFilter = (k: "tipo" | "modalidad", valor: string | null) =>
    navigate({
      search: (prev) => ({ ...prev, [k]: valor ?? undefined }),
      replace: true,
      resetScroll: false,
    });
  const clear = () =>
    navigate({
      search: (prev) => ({ ...prev, tipo: undefined, modalidad: undefined }),
      replace: true,
      resetScroll: false,
    });

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

  const { data: stats = [] } = useQuery({
    queryKey: ["public", "programas", "ratings"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("program_rating_stats")
        .select("programa_id,promedio,total");
      if (error) throw error;
      return (data as { programa_id: string; promedio: number | null; total: number | null }[]) ?? [];
    },
  });
  const statsMap = new Map(stats.map((s) => [s.programa_id, s]));

  const tipos = Array.from(new Set(programas.map((p) => p.tipo).filter(Boolean)));
  const modalidades = Array.from(new Set(programas.map((p) => p.modalidad).filter(Boolean)));
  const matchT = (p: (typeof programas)[number], t?: string) => !t || p.tipo === t;
  const matchM = (p: (typeof programas)[number], m?: string) => !m || p.modalidad === m;
  const filtrados = programas.filter((p) => matchT(p, tipo) && matchM(p, modalidad));
  const countT = (t?: string) => programas.filter((p) => matchT(p, t) && matchM(p, modalidad)).length;
  const countM = (m?: string) => programas.filter((p) => matchT(p, tipo) && matchM(p, m)).length;
  const hayFiltro = !!tipo || !!modalidad;

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
        {!isLoading && programas.length > 0 && (
          <div className="mb-8 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tipo
              </span>
              <div className="flex flex-wrap gap-2">
                <Chip active={!tipo} onClick={() => setFilter("tipo", null)}>
                  Todos ({countT(undefined)})
                </Chip>
                {tipos.map((t) => {
                  const n = countT(t);
                  return (
                    <Chip key={t} active={tipo === t} disabled={n === 0} onClick={() => setFilter("tipo", t)}>
                      {tipoLabelPlural(t)} ({n})
                    </Chip>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Modalidad
              </span>
              <div className="flex flex-wrap gap-2">
                <Chip active={!modalidad} onClick={() => setFilter("modalidad", null)}>
                  Todas ({countM(undefined)})
                </Chip>
                {modalidades.map((m) => {
                  const n = countM(m);
                  return (
                    <Chip key={m} active={modalidad === m} disabled={n === 0} onClick={() => setFilter("modalidad", m)}>
                      {modalidadLabelLong(m)} ({n})
                    </Chip>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                Mostrando {filtrados.length} {filtrados.length === 1 ? "programa" : "programas"}
              </span>
              {hayFiltro && (
                <button type="button" onClick={clear} className="font-medium text-primary hover:underline">
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
        )}
        {isLoading ? (
          <p className="text-center text-muted-foreground">Cargando programas…</p>
        ) : programas.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card p-12 text-center text-muted-foreground">
            Aún no hay programas publicados. Vuelve pronto.
          </div>
        ) : filtrados.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card p-12 text-center text-muted-foreground">
            <p>No hay programas con estos filtros</p>
            <button type="button" onClick={clear} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-4")}>
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((p) => (
              <Link
                key={p.id}
                to="/programas/$slug"
                params={{ slug: p.slug }}
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
                    <Badge variant="outline">{tipoLabel(p.tipo)}</Badge>
                    <Badge variant="secondary">{modalidadLabel(p.modalidad)}</Badge>
                    {p.destacado && <Badge>Destacado</Badge>}
                  </div>
                  <h3 className="line-clamp-2 text-lg font-bold text-foreground transition group-hover:text-primary">
                    {p.titulo}
                  </h3>
                  {(() => {
                    const s = statsMap.get(p.id);
                    if (!s || !s.total) return null;
                    return (
                      <div className="flex items-center gap-2 text-sm">
                        <StarRating value={Number(s.promedio ?? 0)} size={15} />
                        <span className="font-medium">{Number(s.promedio ?? 0).toFixed(1)}</span>
                        <span className="text-muted-foreground">({s.total})</span>
                      </div>
                    );
                  })()}
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
                    <span className={buttonVariants({ size: "sm" })}>Más información</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
