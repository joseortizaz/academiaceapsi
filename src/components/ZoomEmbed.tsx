import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMeetingSdkSignature } from "@/lib/zoom.functions";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

type SigResult = Awaited<ReturnType<ReturnType<typeof useServerFn<typeof getMeetingSdkSignature>>>>;
type State = "loading" | "joining" | "in-meeting" | "fallback";

// El Meeting SDK de Zoom depende de React 18 vía globals (window.React, ReactDOM,
// Redux, ReduxThunk). Este proyecto usa React 19, que removió el interno
// `ReactCurrentOwner` que el SDK necesita, por eso hay que cargar React 18
// desde CDN y exponerlo como global ANTES de importar el SDK.
const ZOOM_SDK_VERSION = "3.13.2";
const CDN_SCRIPTS = [
  { global: "React", url: "https://source.zoom.us/3.13.2/lib/vendor/react.min.js" },
  { global: "ReactDOM", url: "https://source.zoom.us/3.13.2/lib/vendor/react-dom.min.js" },
  { global: "Redux", url: "https://source.zoom.us/3.13.2/lib/vendor/redux.min.js" },
  { global: "ReduxThunk", url: "https://source.zoom.us/3.13.2/lib/vendor/redux-thunk.min.js" },
  { global: "lodash", url: "https://source.zoom.us/3.13.2/lib/vendor/lodash.min.js" },
];

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-zoom-dep="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`No se pudo cargar ${src}`)));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.zoomDep = src;
    s.onload = () => { s.dataset.loaded = "true"; resolve(); };
    s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(s);
  });
}

async function ensureZoomGlobals(): Promise<void> {
  // Cargar dependencias secuencialmente para respetar el orden (React antes de ReactDOM, etc.).
  for (const dep of CDN_SCRIPTS) {
    if (!(window as unknown as Record<string, unknown>)[dep.global]) {
      await loadScript(dep.url);
    }
  }
}

async function loadZoomEmbedded(): Promise<{
  createClient: () => {
    init: (opts: unknown) => Promise<void>;
    join: (opts: unknown) => Promise<void>;
    leave: () => Promise<void>;
  };
  destroyClient: () => void;
}> {
  await ensureZoomGlobals();
  const w = window as unknown as { ZoomMtgEmbedded?: unknown };
  if (!w.ZoomMtgEmbedded) {
    await loadScript(`https://source.zoom.us/${ZOOM_SDK_VERSION}/zoom-meeting-embedded-${ZOOM_SDK_VERSION}.min.js`);
  }
  const ZoomMtgEmbedded = w.ZoomMtgEmbedded as {
    createClient: () => never;
    destroyClient: () => void;
  } | undefined;
  if (!ZoomMtgEmbedded) throw new Error("No se pudo inicializar el SDK de Zoom.");
  return ZoomMtgEmbedded as never;
}

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

        // Cargar el SDK vía CDN con su propio React 18 aislado en window.*
        const ZoomMtgEmbedded = await loadZoomEmbedded();
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
              // Evita la vista de galería por defecto: su algoritmo de cuadrícula
              // genera un canvas con alto interno incorrecto (p. ej. 1646px) que
              // tapa la barra de controles. "speaker" es init-only en el SDK.
              defaultViewType: "speaker",
            },
          },
        });
        if (cancelled) return;

        await client.join({
          signature: sig.signature,
          sdkKey: sig.sdkKey,
          meetingNumber: Number(sig.meetingNumber),
          password: sig.password,
          userName: sig.userName || "Participante",
          userEmail: sig.userEmail || undefined,
          // Requerido por Zoom (desde el 2 de marzo de 2026) para que un usuario no
          // logueado en Zoom pueda actuar como anfitrión (role 1) de una reunión
          // programada. Los asistentes (role 0) se unen de forma anónima sin esto.
          zak: sig.zak || undefined,
        });
        if (cancelled) return;
        setState("in-meeting");
      } catch (e) {
        if (cancelled) return;
        // Log el objeto crudo para poder diagnosticar en consola: Zoom incluye
        // `type`, `reason`, `errorCode` y a veces `method` que aclaran la causa
        // real de un JOIN_MEETING_FAILED (SDK Key de otra cuenta, ZAK inválido,
        // meeting inexistente, app no activada, etc.).
        console.error("[Zoom] Fallo al iniciar reunión embebida:", e, {
          meetingRowId,
          info,
        });
        const msg = stringifyZoomError(e);
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
          const w = window as unknown as { ZoomMtgEmbedded?: { destroyClient: () => void } };
          w.ZoomMtgEmbedded?.destroyClient();
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
      <div className="relative min-h-[600px] max-h-[calc(100dvh-190px)] w-full overflow-hidden rounded-lg border bg-black">
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

// El SDK de Zoom suele rechazar sus promesas con un objeto plano
// (p. ej. { type: "JOIN_MEETING_FAILED", reason: "...", errorCode: 200 })
// en vez de un Error real. `String(e)` en ese caso da "[object Object]",
// que es lo que se veía en el toast. Esto arma un mensaje legible.
function stringifyZoomError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const obj = e as Record<string, unknown>;
    const parts = [obj.type, obj.reason, obj.errorCode != null ? `código ${obj.errorCode}` : null]
      .filter(Boolean)
      .join(" — ");
    if (parts) return parts;
    try {
      return JSON.stringify(obj);
    } catch {
      // fall through
    }
  }
  return String(e);
}

async function waitForRef<T>(ref: React.MutableRefObject<T | null>, timeoutMs = 5000): Promise<T | null> {
  const start = Date.now();
  while (!ref.current) {
    if (Date.now() - start > timeoutMs) return null;
    await new Promise((r) => setTimeout(r, 30));
  }
  return ref.current;
}
