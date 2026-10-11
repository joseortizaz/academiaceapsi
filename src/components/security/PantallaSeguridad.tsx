import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Marco de pantalla completa para los pasos de seguridad al entrar. */
export function PantallaSeguridad({
  titulo,
  descripcion,
  children,
  pie,
}: {
  titulo: string;
  descripcion: ReactNode;
  children: ReactNode;
  pie?: ReactNode;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const cerrarSesion = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/acceder", replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-6 w-6" />
            </div>
            <p className="text-lg font-bold text-primary">Academia Ceapsi RD</p>
          </div>

          <h1 className="text-2xl font-bold sm:text-3xl">{titulo}</h1>
          <div className="mt-3 text-base text-muted-foreground">{descripcion}</div>

          <div className="mt-6">{children}</div>

          {pie && <div className="mt-6 text-sm text-muted-foreground">{pie}</div>}

          <Button variant="ghost" className="mt-4 w-full" onClick={cerrarSesion}>
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function PantallaCargando() {
  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      Cargando…
    </div>
  );
}
