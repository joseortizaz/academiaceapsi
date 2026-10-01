import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export type CatalogDoc = {
  id: string;
  slug: string;
  titulo: string;
  autores: string | null;
  descripcion: string | null;
  categoria_id: string | null;
  categoria_nombre: string | null;
  categoria_slug: string | null;
  etiquetas: string[] | null;
  anio: number | null;
  idioma: string | null;
  paginas: number | null;
  tamano_bytes: number | null;
  portada_url: string | null;
  licencia: string | null;
  destacado: boolean | null;
  descargas: number | null;
  published_at: string | null;
  updated_at: string | null;
};

export const CATALOG_COLUMNS =
  "id, slug, titulo, autores, descripcion, categoria_id, categoria_nombre, categoria_slug, etiquetas, anio, idioma, paginas, tamano_bytes, portada_url, licencia, destacado, descargas, published_at, updated_at";

/** Portada del documento, o una tapa genérica con el título si no tiene imagen. */
export function LibraryCover({
  titulo,
  portadaUrl,
  className,
  eager,
}: {
  titulo: string;
  portadaUrl: string | null;
  className?: string;
  eager?: boolean;
}) {
  if (portadaUrl) {
    return (
      <img
        src={portadaUrl}
        alt={`Portada de ${titulo}`}
        loading={eager ? "eager" : "lazy"}
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col justify-between bg-gradient-to-br from-primary to-primary/70 p-4 text-primary-foreground",
        className,
      )}
      aria-hidden
    >
      <BookOpen className="h-6 w-6 opacity-70" />
      <p className="line-clamp-5 text-sm font-semibold leading-snug">{titulo}</p>
      <p className="text-[10px] uppercase tracking-widest opacity-70">Academia Ceapsi</p>
    </div>
  );
}

export function LibraryCard({ doc }: { doc: CatalogDoc }) {
  const meta = [doc.anio, doc.paginas ? `${doc.paginas} págs.` : null].filter(Boolean).join(" · ");
  return (
    <Link
      to="/biblioteca/$slug"
      params={{ slug: doc.slug }}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="aspect-[3/4] w-full overflow-hidden bg-muted">
        <LibraryCover
          titulo={doc.titulo}
          portadaUrl={doc.portada_url}
          className="transition group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {doc.categoria_nombre && (
          <Badge variant="outline" className="w-fit">
            {doc.categoria_nombre}
          </Badge>
        )}
        <h3 className="line-clamp-3 font-semibold leading-snug text-foreground transition group-hover:text-primary">
          {doc.titulo}
        </h3>
        {doc.autores && <p className="line-clamp-1 text-sm text-muted-foreground">{doc.autores}</p>}
        {meta && <p className="mt-auto pt-1 text-xs text-muted-foreground">{meta}</p>}
      </div>
    </Link>
  );
}
