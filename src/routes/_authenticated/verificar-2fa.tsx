import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CodigoVerificacion } from "@/components/security/CodigoVerificacion";
import { PantallaCargando, PantallaSeguridad } from "@/components/security/PantallaSeguridad";
import {
  destinoPorRol,
  destinoSeguro,
  factoresVerificados,
  mensajeErrorMfa,
  nivelDeSesion,
  type FactorTotp,
} from "@/lib/mfa";
import { PRIVACY_EMAIL } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/verificar-2fa")({
  staticData: { sitemap: false },
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? destinoSeguro(search.redirect) : undefined,
  }),
  component: VerificarDosPasos,
});

function VerificarDosPasos() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { redirect } = Route.useSearch();

  const [factores, setFactores] = useState<FactorTotp[]>([]);
  const [factorId, setFactorId] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  const continuar = async () => {
    const { data } = await supabase.auth.getUser();
    const destino = redirect ?? (data.user ? await destinoPorRol(data.user.id) : "/estudiante");
    await navigate({ to: destino as never, replace: true });
  };

  useEffect(() => {
    let activo = true;
    (async () => {
      const nivel = await nivelDeSesion();
      if (!activo) return;
      // Ya verificado, o la cuenta no tiene verificación en dos pasos.
      if (nivel.actual === "aal2" || nivel.siguiente !== "aal2") {
        await continuar();
        return;
      }
      try {
        const lista = await factoresVerificados();
        if (!activo) return;
        setFactores(lista);
        setFactorId(lista[0]?.id ?? "");
      } catch (e) {
        toast.error(mensajeErrorMfa(e));
      }
      setListo(true);
    })();
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verificar = async (valor = codigo) => {
    if (!factorId || valor.length !== 6 || enviando) return;
    setEnviando(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: valor });
      if (error) throw error;
      qc.invalidateQueries();
      await continuar();
    } catch (e) {
      setCodigo("");
      toast.error(mensajeErrorMfa(e));
    } finally {
      setEnviando(false);
    }
  };

  if (!listo) return <PantallaCargando />;

  return (
    <PantallaSeguridad
      titulo="Verificación en dos pasos"
      descripcion="Abre tu app de autenticación y escribe el código de 6 dígitos que aparece para Academia Ceapsi."
      pie={
        <>
          ¿Perdiste el teléfono o cambiaste de equipo? Escribe a administración ({PRIVACY_EMAIL})
          para que restablezcan tu verificación en dos pasos.
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void verificar();
        }}
      >
        {factores.length > 1 && (
          <div className="space-y-2">
            <Label>Dispositivo</Label>
            <Select
              value={factorId}
              onValueChange={(v) => {
                setFactorId(v);
                setCodigo("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {factores.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.friendly_name || "Autenticador"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="codigo-2fa" className="text-base">
            Código
          </Label>
          <CodigoVerificacion
            id="codigo-2fa"
            value={codigo}
            onChange={setCodigo}
            onComplete={(v) => void verificar(v)}
            disabled={enviando}
            autoFocus
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="h-12 w-full text-base"
          disabled={enviando || codigo.length !== 6 || !factorId}
        >
          {enviando ? "Verificando…" : "Verificar y continuar"}
        </Button>
      </form>
    </PantallaSeguridad>
  );
}
