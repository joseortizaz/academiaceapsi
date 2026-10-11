import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ActivarDosPasos } from "@/components/security/ActivarDosPasos";
import { PantallaCargando, PantallaSeguridad } from "@/components/security/PantallaSeguridad";
import { destinoPorRol, destinoSeguro, nivelDeSesion } from "@/lib/mfa";

/** Activación obligatoria para administradores que aún no la tienen. */
export const Route = createFileRoute("/_authenticated/configurar-2fa")({
  staticData: { sitemap: false },
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? destinoSeguro(search.redirect) : undefined,
  }),
  component: ConfigurarDosPasos,
});

function ConfigurarDosPasos() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { redirect } = Route.useSearch();
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
      if (nivel.actual === "aal2") {
        await continuar();
        return;
      }
      if (nivel.siguiente === "aal2") {
        // Ya tiene un autenticador: solo falta el código.
        await navigate({ to: "/verificar-2fa", search: { redirect }, replace: true });
        return;
      }
      setListo(true);
    })();
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!listo) return <PantallaCargando />;

  return (
    <PantallaSeguridad
      titulo="Activa la verificación en dos pasos"
      descripcion="Las cuentas de administración deben usarla. Además de tu contraseña, al entrar se pedirá un código de 6 dígitos de una app en tu teléfono. Solo toma un minuto."
    >
      <ActivarDosPasos
        onActivado={async () => {
          qc.invalidateQueries();
          await continuar();
        }}
      />
    </PantallaSeguridad>
  );
}
