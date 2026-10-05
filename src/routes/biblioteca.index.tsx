import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/site/PublicLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LibraryCard, CATALOG_COLUMNS, type CatalogDoc } from "@/components/library/LibraryCard";
import { pageHead } from "@/lib/site";
import { cn } from "@/lib/utils";

// 5 filas completas de 5 libros en pantallas grandes.
const POR_PAGINA = 25;
const ORDENES = {
  recientes: "Más recientes",
  descargados: "Más descargados",
  titulo: "Título (A–Z)",
} as const;
type Orden = keyof typeof ORDENES;

type BibliotecaSearch = { q?: string; categoria?: string; orden?: Orden; pagina?: number };

const texto = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, 100) : undefined;

/** Minúsculas y sin acentos, para buscar "psicologia" y encontrar "Psicología". */
const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

async function cargarCatalogo() {
  const [docs, cats] = await Promise.all([
    supabase
      .from("library_catalog")
      .select(CATALOG_COLUMNS)
      .order("published_at", { ascending: false })
      .limit(1000),
    supabase
      .from("library_categories")
      .select("id, nombre, slug, orden")
      .order("orden")
      .order("nombre"),
  ]);
  if (docs.error) throw docs.error;
  if (cats.error) throw cats.error;
  return { docs: (docs.data ?? []) as CatalogDoc[], categorias: cats.data ?? [] };
}

export const Route = createFileRoute("/biblioteca/")({
  staticData: { sitemap: true },
  validateSearch: (search: Record<string, unknown>): BibliotecaSearch => {
    const orden = texto(search.orden);
    const pagina = Number(search.pagina);
    return {
      q: texto(search.q),
      categoria: texto(search.categoria),
      orden: orden && orden in ORDENES ? (orden as Orden) : undefined,
      pagina: Number.isInteger(pagina) && pagina > 1 ? pagina : undefined,
    };
  },
  loader: async () => {
    try {
      return await cargarCatalogo();
    } catch {
      return { docs: [] as CatalogDoc[], categorias: [] };
    }
  },
  head: () =>
    pageHead(
      "/biblioteca",
      "Biblioteca Virtual | Academia Ceapsi RD",
      "Documentos, guías y materiales de psicología en PDF de la Academia Ceapsi RD. Consulta el catálogo y descárgalos gratis con tu cuenta.",
    ),
  component: BibliotecaPage,
});

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
        active ? "bg-primary text-primary-foreground" : "border bg-card hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function BibliotecaPage() {
  const search = Route.useSearch();
  const { q, categoria, orden = "recientes", pagina = 1 } = search;
  const navigate = useNavigate({ from: Route.fullPath });
  const inicial = Route.useLoaderData();

  const { data } = useQuery({
    queryKey: ["public", "biblioteca", "catalogo"],
    queryFn: cargarCatalogo,
    initialData: inicial,
    staleTime: 60_000,
  });
  const docs = useMemo(() => data?.docs ?? [], [data]);
  const categorias = useMemo(() => data?.categorias ?? [], [data]);

  const actualizar = (patch: Partial<BibliotecaSearch>) =>
    navigate({
      search: (prev) => ({ ...prev, pagina: undefined, ...patch }),
      replace: true,
      resetScroll: false,
    });

  // Búsqueda con pequeña espera para no reescribir la URL en cada tecla.
  const [busqueda, setBusqueda] = useState(q ?? "");
  useEffect(() => setBusqueda(q ?? ""), [q]);
  useEffect(() => {
    const valor = busqueda.trim() || undefined;
    if (valor === q) return;
    const t = setTimeout(() => actualizar({ q: valor }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  const conteoCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of docs)
      if (d.categoria_slug) m.set(d.categoria_slug, (m.get(d.categoria_slug) ?? 0) + 1);
    return m;
  }, [docs]);
  const categoriasConDocs = categorias.filter((c) => conteoCategoria.has(c.slug));

  const filtrados = useMemo(() => {
    const termino = q ? normalizar(q) : "";
    const lista = docs.filter((d) => {
      if (categoria && d.categoria_slug !== categoria) return false;
      if (!termino) return true;
      const campos = [
        d.titulo,
        d.autores ?? "",
        d.descripcion ?? "",
        d.categoria_nombre ?? "",
        ...(d.etiquetas ?? []),
      ];
      return campos.some((c) => normalizar(c).includes(termino));
    });
    return [...lista].sort((a, b) => {
      if (orden === "descargados") return (b.descargas ?? 0) - (a.descargas ?? 0);
      if (orden === "titulo") return a.titulo.localeCompare(b.titulo, "es");
      return (b.published_at ?? "").localeCompare(a.published_at ?? "");
    });
  }, [docs, q, categoria, orden]);

  const hayFiltro = !!q || !!categoria;
  const destacados = !hayFiltro && pagina === 1 ? docs.filter((d) => d.destacado).slice(0, 5) : [];
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  const irAPagina = (p: number) => {
    navigate({ search: (prev) => ({ ...prev, pagina: p > 1 ? p : undefined }), replace: false });
  };

  const limpiar = () => {
    setBusqueda("");
    actualizar({ q: undefined, categoria: undefined });
  };

  return (
    <PublicLayout>
      <section className="border-b bg-gradient-to-b from-primary/5 to-background py-14">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold text-foreground md:text-5xl">Biblioteca Virtual</h1>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Documentos, guías y materiales de psicología en PDF. Consulta el catálogo libremente y
            descárgalos gratis con tu cuenta.
          </p>
          <div className="relative mx-auto mt-8 max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por título, autor o tema"
              aria-label="Buscar en la biblioteca"
              className="h-12 rounded-full bg-card pl-12 text-base"
            />
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        {docs.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card p-12 text-center text-muted-foreground">
            <BookOpen className="mx-auto mb-3 h-8 w-8 opacity-50" />
            La biblioteca estará disponible muy pronto.
          </div>
        ) : (
          <>
            {destacados.length > 0 && (
              <div className="mb-12">
                <h2 className="mb-5 text-xl font-bold">Destacados</h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5">
                  {destacados.map((d) => (
                    <LibraryCard key={d.id} doc={d} />
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6 space-y-4">
              {categoriasConDocs.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Chip active={!categoria} onClick={() => actualizar({ categoria: undefined })}>
                    Todas ({docs.length})
                  </Chip>
                  {categoriasConDocs.map((c) => (
                    <Chip
                      key={c.id}
                      active={categoria === c.slug}
                      onClick={() => actualizar({ categoria: c.slug })}
                    >
                      {c.nombre} ({conteoCategoria.get(c.slug)})
                    </Chip>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>
                    {filtrados.length} {filtrados.length === 1 ? "documento" : "documentos"}
                  </span>
                  {hayFiltro && (
                    <button
                      type="button"
                      onClick={limpiar}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      <X className="h-3.5 w-3.5" />
                      Limpiar filtros
                    </button>
                  )}
                </div>
                <Select value={orden} onValueChange={(v) => actualizar({ orden: v as Orden })}>
                  <SelectTrigger className="w-48" aria-label="Ordenar">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ORDENES).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filtrados.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-card p-12 text-center text-muted-foreground">
                <p>No encontramos documentos con esos criterios.</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={limpiar}>
                  Limpiar filtros
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5">
                {visibles.map((d) => (
                  <LibraryCard key={d.id} doc={d} />
                ))}
              </div>
            )}

            {totalPaginas > 1 && (
              <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Paginación">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaActual <= 1}
                  onClick={() => irAPagina(paginaActual - 1)}
                >
                  Anterior
                </Button>
                <span className="px-2 text-sm text-muted-foreground">
                  Página {paginaActual} de {totalPaginas}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaActual >= totalPaginas}
                  onClick={() => irAPagina(paginaActual + 1)}
                >
                  Siguiente
                </Button>
              </nav>
            )}
          </>
        )}
      </section>
    </PublicLayout>
  );
}
