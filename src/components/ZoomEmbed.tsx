import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMeetingSdkSignature } from "@/lib/zoom.functions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import "@zoom/meetingsdk/dist/css/bootstrap.css";
import "@zoom/meetingsdk/dist/css/react-select.css";

export function ZoomEmbed({ meetingRowId }: { meetingRowId: string }) {
  const { user } = useAuth();
  const sigFn = useServerFn(getMeetingSdkSignature);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<"idle" | "joining" | "joined" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let client: { leaveMeeting: () => void } | null = null;
    let cancelled = false;

    async function join() {
      if (!user || !containerRef.current) return;
      setState("joining");
      try {
        const { signature, sdkKey, meetingNumber, password, role } =
          await sigFn({ data: { meetingRowId } });

        const mod = await import("@zoom/meetingsdk/embedded");
        const ZoomMtgEmbedded = mod.default;
        const c = ZoomMtgEmbedded.createClient();
        client = c;

        await c.init({
          zoomAppRoot: containerRef.current!,
          language: "es-ES",
          patchJsMedia: true,
        });

        await c.join({
          sdkKey,
          signature,
          meetingNumber,
          password: password || "",
          userName: `${user.nombre ?? "Usuario"} ${user.apellido ?? ""}`.trim(),
          userEmail: undefined,
          // El role lo determina la firma JWT; aquí solo informativo.
        });
        if (!cancelled) setState("joined");
        if (role === 1) toast.success("Has entrado como anfitrión");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setState("error");
        toast.error("No se pudo unir a la reunión", { description: msg });
      }
    }

    join();
    return () => {
      cancelled = true;
      try { client?.leaveMeeting(); } catch { /* noop */ }
    };
  }, [meetingRowId, user, sigFn]);

  return (
    <div className="space-y-3">
      {state === "joining" && (
        <p className="text-sm text-muted-foreground">Conectando con Zoom…</p>
      )}
      {state === "error" && (
        <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm">
          <p className="font-medium text-red-700">No se pudo conectar.</p>
          <p className="mt-1 text-xs text-red-700">{error}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => location.reload()}>
            Reintentar
          </Button>
        </div>
      )}
      <div ref={containerRef} className="min-h-[600px] w-full overflow-hidden rounded-md border bg-black" />
    </div>
  );
}
