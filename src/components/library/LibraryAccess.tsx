import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpenText, Download, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getLibraryDownloadUrl } from "@/lib/library.functions";
import { formatFileSize } from "@/lib/library";

type Props = {
  doc: { id: string; slug: string; titulo: string; tamano_bytes: number | null };
};

/** Página donde el usuario dejó la lectura de un documento (solo la suya, por RLS). */
export function useReadingProgress(documentId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ["biblioteca", "progreso", documentId, userId],
    enabled: !!documentId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_reading_progress")
        .select("pagina, total_paginas, escala, updated_at")
        .eq("document_id", documentId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Acceso al PDF. Sin sesión invita a registrarse o iniciar sesión y vuelve a esta
 * ficha; con sesión ofrece el lector (o continuar donde quedó) y la descarga.
 */
export function LibraryAccess({ doc }: Props) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const pedirUrl = useServerFn(getLibraryDownloadUrl);
  const [descargando, setDescargando] = useState(false);
  const { data: progreso } = useReadingProgress(doc.id, user?.id);
  const volverA = `/biblioteca/${doc.slug}`;

  const descargar = async () => {
    setDescargando(true);
    try {
      const { url } = await pedirUrl({ data: { documentId: doc.id, modo: "descargar" } });
      // El enlace lleva Content-Disposition: attachment, así que no sale de la página.
      window.location.assign(url);
      toast.success("Descarga iniciada");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(
        msg.startsWith("Unauthorized")
          ? "Tu sesión expiró. Inicia sesión de nuevo."
          : msg || "No se pudo obtener el documento",
      );
    } finally {
      setDescargando(false);
    }
  };

  if (isLoading) {
    return (
      <Button size="lg" disabled className="w-full sm:w-auto">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Cargando…
      </Button>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-xl border bg-muted/40 p-5">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="space-y-3">
            <div>
              <p className="font-semibold">
                Lectura y descarga gratuitas para usuarios registrados
              </p>
              <p className="text-sm text-muted-foreground">
                Crea tu cuenta gratis o inicia sesión para leer este documento en línea, tomar notas
                privadas o descargarlo.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/registro" search={{ redirect: volverA }}>
                  Crear cuenta gratis
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/acceder" search={{ redirect: volverA }}>
                  Iniciar sesión
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const continuar = progreso && progreso.pagina > 1;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        <Button size="lg" asChild>
          <Link to="/biblioteca/$slug/leer" params={{ slug: doc.slug }}>
            <BookOpenText className="mr-2 h-4 w-4" />
            {continuar ? "Continuar leyendo" : "Leer en línea"}
          </Link>
        </Button>
        <Button size="lg" variant="outline" onClick={descargar} disabled={descargando}>
          {descargando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Descargar PDF{doc.tamano_bytes ? ` (${formatFileSize(doc.tamano_bytes)})` : ""}
        </Button>
      </div>
      {continuar && (
        <p className="text-sm text-muted-foreground">
          Te quedaste en la página {progreso.pagina}
          {progreso.total_paginas ? ` de ${progreso.total_paginas}` : ""}.
        </p>
      )}
    </div>
  );
}
