import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { fechaLarga, hoyRD, rd, textoAviso } from "@/lib/mora-textos";

type EstadoMora = {
  etapa: string;
  restringido: boolean;
  monto_vencido: number;
  cuota_antigua_venc: string | null;
  cuota_antigua_saldo: number | null;
  proxima_venc: string | null;
  proxima_saldo: number | null;
};

type ConfigMora = { avisos_activos: boolean; contacto_direccion: string };

/** Estado de mora del alumno conectado y configuración (lectura por RLS). */
export function useMiMora() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["mi-mora", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const db = supabase as any;
      const [estado, config] = await Promise.all([
        db.from("mora_estado").select("*").eq("user_id", user!.id).maybeSingle(),
        db.from("mora_config").select("avisos_activos, contacto_direccion").eq("id", true).maybeSingle(),
      ]);
      // Si las tablas aún no existen (migración sin aplicar), no se muestra nada.
      if (estado.error || config.error) return null;
      return {
        estado: (estado.data ?? null) as EstadoMora | null,
        config: (config.data ?? null) as ConfigMora | null,
      };
    },
  });
}

function diasHasta(iso: string): number {
  const hoy = hoyRD();
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86_400_000);
}

/** Aviso en el área del alumno: restricción, mora o próxima cuota. */
export function MoraBanner() {
  const { data } = useMiMora();
  const estado = data?.estado;
  const config = data?.config;
  if (!estado || !config) return null;

  const contacto = config.contacto_direccion;

  if (estado.restringido) {
    return (
      <div role="alert" className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
        <div className="flex gap-3">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-destructive">Su acceso a los contenidos ha sido restringido</p>
            <p>
              Su acceso a los contenidos ha sido restringido por incumplimiento en el pago. Comuníquese con la
              dirección en <strong>{contacto}</strong> para regularizar su situación. Saldo vencido:{" "}
              <strong>{rd(estado.monto_vencido)}</strong>.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link to="/estudiante/facturacion">Ver mi estado de cuenta</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Los demás avisos solo se muestran cuando la dirección activó los avisos.
  if (!config.avisos_activos) return null;

  if (["gracia", "mora", "por_restringir"].includes(estado.etapa) && estado.cuota_antigua_venc) {
    const grave = estado.etapa === "por_restringir";
    const t = textoAviso(grave ? "aviso3" : "aviso2", {
      nombre: "",
      monto: Number(estado.cuota_antigua_saldo) || 0,
      vencimiento: estado.cuota_antigua_venc,
      saldoVencido: Number(estado.monto_vencido) || 0,
      contacto,
      hoy: hoyRD(),
    });
    return (
      <div
        role="status"
        className={`mb-6 rounded-lg border p-4 ${grave ? "border-destructive/40 bg-destructive/10" : "border-amber-500/40 bg-amber-500/10"}`}
      >
        <div className="flex gap-3">
          <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${grave ? "text-destructive" : "text-amber-700"}`} />
          <div className="space-y-2 text-sm">
            <p className="font-semibold">{t.asunto}</p>
            <p>{t.corto}</p>
            <Button asChild size="sm" variant="outline">
              <Link to="/estudiante/facturacion">Ver mi estado de cuenta</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (estado.proxima_venc && estado.proxima_saldo) {
    const faltan = diasHasta(estado.proxima_venc);
    if (faltan >= 0 && faltan <= 5) {
      return (
        <div role="status" className="mb-6 rounded-lg border border-sky-500/40 bg-sky-500/10 p-4">
          <div className="flex gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
            <p className="text-sm">
              Su próxima cuota de <strong>{rd(estado.proxima_saldo)}</strong> vence el{" "}
              <strong>{fechaLarga(estado.proxima_venc)}</strong>.
            </p>
          </div>
        </div>
      );
    }
  }
  return null;
}

/** Pantalla completa para el reproductor del curso cuando el acceso está restringido. */
export function ContenidoRestringido() {
  const { data } = useMiMora();
  const contacto = data?.config?.contacto_direccion ?? "la dirección";
  return (
    <div className="mx-auto max-w-xl p-8 text-center">
      <Lock className="mx-auto h-10 w-10 text-destructive" />
      <h2 className="mt-4 text-xl font-bold">Acceso a los contenidos restringido</h2>
      <p className="mt-2 text-muted-foreground">
        Su acceso a los contenidos ha sido restringido por incumplimiento en el pago. Comuníquese con la dirección en{" "}
        {contacto} para regularizar su situación.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Button asChild>
          <Link to="/estudiante/facturacion">Ver mi estado de cuenta</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/mis-cursos">Volver a mis cursos</Link>
        </Button>
      </div>
    </div>
  );
}
