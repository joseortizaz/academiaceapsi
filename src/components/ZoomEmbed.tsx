import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMeetingSdkSignature } from "@/lib/zoom.functions";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

type SigResult = Awaited<ReturnType<ReturnType<typeof useServerFn<typeof getMeetingSdkSignature>>>>;
type State = "loading" | "joining" | "in-meeting" | "fallback";

export function ZoomEmbed({ meetingRowId }: { meetingRowId: string }) {
  const sigFn = useServerFn(getMeetingSdkSignature);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<unknown>(null);
  const [info, setInfo] = useState<SigResult | null>(null);
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sig = await sigFn({ data: { meetingRowId } });
        if (cancelled) return;
        setInfo(sig);
        setState("joining");

        // Dynamic import: keep the 2MB+ SDK out of the initial bundle and off SSR.
        const mod = await import("@zoom/meetingsdk/embedded");
        const ZoomMtgEmbedded = mod.default;
        if (cancelled) return;

        // Wait for the container to be mounted (it renders alongside the loader).
        const root = await waitForRef(containerRef);
        if (cancelled || !root) return;

        const client = ZoomMtgEmbedded.createClient();
        clientRef.current = client;

        await client.init({
          zoomAppRoot: root,
          language: "es-ES",
          patchJsMedia: true,
          leaveOnPageUnload: true,
          customize: {
            video: {
              isResizable: true,
              viewSizes: {
                default: { width: 1000, height: 600 },
                ribbon: { width: 300, height: 700 },
              },
            },
          },
        });
        if (cancelled) return;

        await client.join({
          signature: sig.signature,
          sdkKey: sig.sdkKey,
          meetingNumber: sig.meetingNumber,
          password: sig.password,
          userName: sig.userName || "Participante",
          userEmail: sig.userEmail || undefined,
        });
        if (cancelled) return;
        setState("in-meeting");
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setState("fallback");
        toast.error("No se pudo iniciar la reunión embebida", { description: msg });
      }
    })();

    return () => {
      cancelled = true;
      (async () => {
        try {
          const client = clientRef.current as { leave?: () => Promise<void> } | null;
          if (client && typeof client.leave === "function") await client.leave();
          const mod = await import("@zoom/meetingsdk/embedded");
          mod.default.destroyClient();
        } catch {
          // ignore teardown errors
        }
      })();
    };
  }, [meetingRowId, sigFn]);

  if (state === "fallback") {
    const primary = info && info.role === 1 && info.startUrl ? info.startUrl : info?.joinUrl;
    return (
      <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
        <div>
          <p className="font-medium text-amber-800">No se pudo cargar la reunión dentro de la plataforma.</p>
          {error && <p className="mt-1 text-xs text-amber-800/80">{error}</p>}
          <p className="mt-2 text-xs text-muted-foreground">
            Puedes abrirla en el cliente web de Zoom mientras tanto.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {primary && (
            <Button asChild>
              <a href={primary} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                {info?.role === 1 ? "Iniciar en Zoom" : "Unirse en Zoom"}
              </a>
            </Button>
          )}
          <Button variant="outline" onClick={() => location.reload()}>Reintentar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {info && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{info.titulo}</h2>
            <p className="text-xs text-muted-foreground">
              ID {info.meetingNumber}
              {info.role === 1 && " · Anfitrión"}
            </p>
          </div>
          {info.joinUrl && (
            <Button variant="ghost" size="sm" asChild>
              <a href={info.role === 1 && info.startUrl ? info.startUrl : info.joinUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 h-3 w-3" /> Abrir en Zoom
              </a>
            </Button>
          )}
        </div>
      )}
      <div className="relative min-h-[600px] w-full overflow-hidden rounded-lg border bg-black">
        <div ref={containerRef} id="zoom-meeting-root" className="h-full w-full" />
        {state !== "in-meeting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {state === "loading" ? "Preparando reunión…" : "Conectando a Zoom…"}
          </div>
        )}
      </div>
    </div>
  );
}

async function waitForRef<T>(ref: React.MutableRefObject<T | null>, timeoutMs = 5000): Promise<T | null> {
  const start = Date.now();
  while (!ref.current) {
    if (Date.now() - start > timeoutMs) return null;
    await new Promise((r) => setTimeout(r, 30));
  }
  return ref.current;
}
