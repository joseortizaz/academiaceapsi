import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, ExternalLink, Loader2, Lock, BookOpenText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { getLibraryDownloadUrl } from "@/lib/library.functions";
import { formatFileSize } from "@/lib/library";

type Props = {
  doc: { id: string; slug: string; titulo: string; tamano_bytes: number | null };
};

/**
 * Botones de acceso al PDF. Sin sesión invita a registrarse o iniciar sesión y
 * vuelve a esta misma ficha; con sesión pide al servidor un enlace temporal.
 */
export function LibraryAccess({ doc }: Props) {
  const { isAuthenticated, isLoading } = useAuth();
  const pedirUrl = useServerFn(getLibraryDownloadUrl);
  const [cargando, setCargando] = useState<"descargar" | "leer" | null>(null);
  const [visor, setVisor] = useState<string | null>(null);
  const volverA = `/biblioteca/${doc.slug}`;

  const solicitar = async (modo: "descargar" | "leer") => {
    setCargando(modo);
    try {
      const { url } = await pedirUrl({ data: { documentId: doc.id, modo } });
      if (modo === "descargar") {
        // El enlace lleva Content-Disposition: attachment, así que no sale de la página.
        window.location.assign(url);
        toast.success("Descarga iniciada");
      } else {
        setVisor(url);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(
        msg.startsWith("Unauthorized")
          ? "Tu sesión expiró. Inicia sesión de nuevo."
          : msg || "No se pudo obtener el documento",
      );
    } finally {
      setCargando(null);
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
              <p className="font-semibold">Descarga gratuita para usuarios registrados</p>
              <p className="text-sm text-muted-foreground">
                Crea tu cuenta gratis o inicia sesión para leer y descargar este documento.
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

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={() => solicitar("descargar")} disabled={!!cargando}>
          {cargando === "descargar" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Descargar PDF{doc.tamano_bytes ? ` (${formatFileSize(doc.tamano_bytes)})` : ""}
        </Button>
        <Button size="lg" variant="outline" onClick={() => solicitar("leer")} disabled={!!cargando}>
          {cargando === "leer" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <BookOpenText className="mr-2 h-4 w-4" />
          )}
          Leer en línea
        </Button>
      </div>

      <Dialog open={!!visor} onOpenChange={(o) => !o && setVisor(null)}>
        <DialogContent className="flex h-[92vh] max-w-5xl flex-col gap-3 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="pr-8 text-base sm:text-lg">{doc.titulo}</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                Si el documento no se muestra en tu dispositivo, ábrelo en una pestaña nueva.
              </span>
              {visor && (
                <a
                  href={visor}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir en pestaña nueva
                </a>
              )}
            </DialogDescription>
          </DialogHeader>
          {visor && (
            <iframe
              src={visor}
              title={doc.titulo}
              className="min-h-0 w-full flex-1 rounded-md border bg-muted"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
