import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMeetingSdkSignature } from "@/lib/zoom.functions";
import { Button } from "@/components/ui/button";
import { ExternalLink, Video } from "lucide-react";
import { toast } from "sonner";

type SigResult = Awaited<ReturnType<ReturnType<typeof useServerFn<typeof getMeetingSdkSignature>>>>;

export function ZoomEmbed({ meetingRowId }: { meetingRowId: string }) {
  const sigFn = useServerFn(getMeetingSdkSignature);
  const [info, setInfo] = useState<SigResult | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await sigFn({ data: { meetingRowId } });
        if (cancelled) return;
        setInfo(res);
        setState("ready");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (cancelled) return;
        setError(msg);
        setState("error");
        toast.error("No se pudo cargar la reunión", { description: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meetingRowId, sigFn]);

  if (state === "loading") {
    return <p className="text-sm text-muted-foreground">Cargando reunión…</p>;
  }

  if (state === "error" || !info) {
    return (
      <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm">
        <p className="font-medium text-red-700">No se pudo cargar la reunión.</p>
        <p className="mt-1 text-xs text-red-700">{error}</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => location.reload()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const isHost = info.role === 1;
  const primaryUrl = isHost && info.startUrl ? info.startUrl : info.joinUrl;

  return (
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <div className="flex items-start gap-3">
        <Video className="h-6 w-6 text-primary" />
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{info.titulo}</h2>
          <p className="text-sm text-muted-foreground">
            {isHost
              ? "Eres el anfitrión. Inicia la reunión para que los estudiantes puedan unirse."
              : "Únete a la clase en vivo a través del cliente web o la aplicación de Zoom."}
          </p>
        </div>
      </div>

      <div className="grid gap-2 text-sm">
        <div>
          <span className="font-medium">ID de reunión: </span>
          <span className="font-mono">{info.meetingNumber}</span>
        </div>
        {info.password && (
          <div>
            <span className="font-medium">Código de acceso: </span>
            <span className="font-mono">{info.password}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {primaryUrl && (
          <Button asChild>
            <a href={primaryUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              {isHost ? "Iniciar reunión" : "Unirse a la reunión"}
            </a>
          </Button>
        )}
        {isHost && info.joinUrl && info.startUrl && (
          <Button variant="outline" asChild>
            <a href={info.joinUrl} target="_blank" rel="noopener noreferrer">
              Unirse como participante
            </a>
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Si el navegador no abre Zoom automáticamente, copia el enlace y ábrelo en la aplicación de Zoom.
      </p>
    </div>
  );
}
